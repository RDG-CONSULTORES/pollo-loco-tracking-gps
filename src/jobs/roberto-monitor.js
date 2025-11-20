/**
 * Job específico para monitorear Roberto más frecuentemente
 */
const cron = require('node-cron');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Ejecutar cada 15 segundos para Roberto (solo testing)
const robertoMonitorJob = cron.schedule('*/15 * * * * *', async () => {
  try {
    console.log('⚡ Verificando Roberto (cada 15s)...');
    
    // Obtener última ubicación
    const lastLocation = await pool.query(`
      SELECT latitude, longitude, gps_timestamp, accuracy
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    if (lastLocation.rows.length > 0) {
      const loc = lastLocation.rows[0];
      const now = new Date();
      const locationTime = new Date(loc.gps_timestamp);
      const ageMinutes = (now - locationTime) / 60000;
      
      if (ageMinutes <= 2) {
        console.log(`✅ Roberto: Ubicación reciente (${Math.round(ageMinutes * 10) / 10}min)`);
        
        // Forzar verificación de geofence
        const geofenceEngine = require('../services/geofence-engine');
        await geofenceEngine.processLocation({
          id: Date.now(),
          user_id: 5,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          battery: 100,
          gps_timestamp: loc.gps_timestamp
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error en Roberto monitor:', error.message);
  }
}, {
  scheduled: false // Inicialmente deshabilitado
});

module.exports = { robertoMonitorJob };