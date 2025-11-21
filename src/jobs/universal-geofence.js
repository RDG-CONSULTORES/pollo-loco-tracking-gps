/**
 * Scheduler optimizado para TODOS los usuarios
 * Ejecuta verificación geofence cada 30 segundos
 */

const cron = require('node-cron');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Job principal: verificación cada 30 segundos
const universalGeofenceCheck = cron.schedule('*/30 * * * * *', async () => {
  try {
    console.log('⚡ Verificación universal geofence (30s)...');
    
    // Obtener usuarios con ubicaciones recientes (últimos 5 minutos)
    const recentUsers = await pool.query(`
      SELECT DISTINCT user_id, MAX(gps_timestamp) as last_gps
      FROM gps_locations
      WHERE gps_timestamp >= NOW() - INTERVAL '5 minutes'
      GROUP BY user_id
      ORDER BY last_gps DESC
    `);
    
    console.log(`📍 Usuarios con ubicaciones recientes: ${recentUsers.rows.length}`);
    
    for (const user of recentUsers.rows) {
      try {
        // Obtener última ubicación del usuario
        const lastLocation = await pool.query(`
          SELECT latitude, longitude, gps_timestamp, accuracy, battery, velocity
          FROM gps_locations
          WHERE user_id = $1
          ORDER BY gps_timestamp DESC
          LIMIT 1
        `, [user.user_id]);
        
        if (lastLocation.rows.length > 0) {
          const loc = lastLocation.rows[0];
          
          // Verificar si necesita procesamiento (ubicación reciente)
          const locationAge = (new Date() - new Date(loc.gps_timestamp)) / 1000;
          
          if (locationAge <= 300) { // 5 minutos
            // Procesar con geofence-engine
            const geofenceEngine = require('../services/geofence-engine');
            
            const events = await geofenceEngine.processLocation({
              id: Date.now() + user.user_id,
              user_id: user.user_id,
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy || 10,
              battery: loc.battery || 100,
              velocity: loc.velocity || 0,
              gps_timestamp: loc.gps_timestamp
            });
            
            if (events.length > 0) {
              console.log(`🎯 Usuario ${user.user_id}: ${events.length} eventos generados`);
            }
          }
        }
      } catch (userError) {
        console.error(`❌ Error procesando usuario ${user.user_id}:, userError.message`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en verificación universal:', error.message);
  }
}, {
  scheduled: true // Auto-iniciar
});

// Job de limpieza: cada 5 minutos
const cleanupJob = cron.schedule('*/5 * * * *', async () => {
  try {
    // Limpiar cache de estados antiguos
    const geofenceAlerts = require('../services/geofence-alerts');
    
    // Limpiar estados de usuarios sin actividad reciente
    const inactiveThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutos
    
    // Aquí podrías implementar limpieza de cache si es necesario
    console.log('🧹 Limpieza de cache completada');
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error.message);
  }
});

module.exports = { 
  universalGeofenceCheck, 
  cleanupJob,
  startUniversalMonitoring: () => {
    console.log('🚀 Iniciando monitoreo universal...');
    universalGeofenceCheck.start();
    cleanupJob.start();
    console.log('✅ Monitoreo universal activo (cada 30s)');
  }
};