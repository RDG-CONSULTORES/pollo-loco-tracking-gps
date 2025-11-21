/**
 * Motor específico para rellenar gaps de OwnTracks
 * Problema: OwnTracks puede tener gaps de 5+ minutos
 * Solución: Estimación inteligente de posiciones intermedias
 */

const { Pool } = require('pg');
const cron = require('node-cron');

class GapFillEngine {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  
  /**
   * Detectar y rellenar gaps grandes en tracking
   */
  async fillTrackingGaps() {
    try {
      console.log('🕳️ Detectando gaps en tracking...');
      
      // Buscar usuarios con gaps grandes (>3 minutos)
      const gaps = await this.pool.query(`
        WITH location_gaps AS (
          SELECT 
            user_id,
            latitude,
            longitude,
            gps_timestamp,
            LAG(gps_timestamp) OVER (PARTITION BY user_id ORDER BY gps_timestamp) as prev_timestamp,
            LAG(latitude) OVER (PARTITION BY user_id ORDER BY gps_timestamp) as prev_lat,
            LAG(longitude) OVER (PARTITION BY user_id ORDER BY gps_timestamp) as prev_lng,
            EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (PARTITION BY user_id ORDER BY gps_timestamp))) as gap_seconds
          FROM gps_locations
          WHERE gps_timestamp >= NOW() - INTERVAL '30 minutes'
        )
        SELECT *
        FROM location_gaps
        WHERE gap_seconds > 180  -- Gaps >3 minutos
          AND gap_seconds < 1800 -- Gaps <30 minutos (razonables)
        ORDER BY gap_seconds DESC
      `);
      
      console.log(`🔍 Encontrados ${gaps.rows.length} gaps significativos`);
      
      for (const gap of gaps.rows) {
        await this.processGap(gap);
      }
      
    } catch (error) {
      console.error('❌ Error rellenando gaps:', error.message);
    }
  }
  
  /**
   * Procesar gap específico y crear estimaciones
   */
  async processGap(gap) {
    try {
      const gapMinutes = Math.round(gap.gap_seconds / 60);
      console.log(`📍 Usuario ${gap.user_id}: Gap de ${gapMinutes} minutos`);
      
      // Crear puntos estimados cada minuto durante el gap
      const estimatedPoints = [];
      const totalSeconds = gap.gap_seconds;
      const intervalSeconds = Math.min(60, totalSeconds / 5); // Max 5 puntos
      
      for (let t = intervalSeconds; t < totalSeconds; t += intervalSeconds) {
        const ratio = t / totalSeconds;
        
        // Interpolación lineal simple
        const estimatedLat = gap.prev_lat + (gap.latitude - gap.prev_lat) * ratio;
        const estimatedLng = gap.prev_lng + (gap.longitude - gap.prev_lng) * ratio;
        const estimatedTime = new Date(new Date(gap.prev_timestamp).getTime() + (t * 1000));
        
        estimatedPoints.push({
          user_id: gap.user_id,
          latitude: estimatedLat,
          longitude: estimatedLng,
          gps_timestamp: estimatedTime,
          estimated: true
        });
      }
      
      // Procesar puntos estimados con geofence engine
      const geofenceEngine = require('../services/geofence-engine');
      
      for (const point of estimatedPoints) {
        const events = await geofenceEngine.processLocation({
          id: Date.now() + Math.random(),
          user_id: point.user_id,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: 50, // Menos preciso porque es estimado
          battery: 100,
          gps_timestamp: point.gps_timestamp,
          estimated: true
        });
        
        if (events.length > 0) {
          console.log(`🎯 Gap-fill usuario ${point.user_id}: ${events.length} eventos estimados`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error procesando gap usuario ${gap.user_id}:`, error.message);
    }
  }
}

// Job para rellenar gaps - cada 2 minutos
const gapFillEngine = new GapFillEngine();

const gapFillJob = cron.schedule('*/2 * * * *', async () => {
  await gapFillEngine.fillTrackingGaps();
}, {
  scheduled: true
});

console.log('🕳️ Motor gap-fill iniciado - cada 2 minutos');

module.exports = { gapFillEngine, gapFillJob };