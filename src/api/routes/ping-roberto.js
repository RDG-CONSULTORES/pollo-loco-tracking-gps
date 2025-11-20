/**
 * Endpoint para forzar verificación manual de Roberto
 * GET /api/ping-roberto
 */

const express = require('express');
const router = express.Router();
const geofenceEngine = require('../services/geofence-engine');
const db = require('../config/database');

router.get('/ping-roberto', async (req, res) => {
  try {
    console.log('🔄 Ping manual Roberto...');
    
    // Obtener última ubicación
    const result = await db.query(`
      SELECT latitude, longitude, gps_timestamp, accuracy, battery
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'No hay ubicaciones' });
    }
    
    const loc = result.rows[0];
    
    // Forzar procesamiento
    const events = await geofenceEngine.processLocation({
      id: Date.now(),
      user_id: 5,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy || 10,
      battery: loc.battery || 100,
      gps_timestamp: loc.gps_timestamp
    });
    
    console.log(`✅ Ping Roberto: ${events.length} eventos generados`);
    
    res.json({
      success: true,
      location: loc,
      events: events.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error ping Roberto:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;