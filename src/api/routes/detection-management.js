/**
 * Endpoints para gestión automática de detección
 */

const express = require('express');
const router = express.Router();
const { realTimeProcessor } = require('../../middleware/realtime-processor');
const { universalGeofenceCheck } = require('../../jobs/universal-geofence');

// Status general del sistema
router.get('/detection-status', async (req, res) => {
  try {
    const stats = realTimeProcessor.getStats();
    
    res.json({
      success: true,
      realTimeProcessor: stats,
      universalScheduler: {
        active: universalGeofenceCheck.scheduled || false,
        nextRun: 'Every 30 seconds',
        status: 'Active cron job running'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Forzar verificación de todos los usuarios activos
router.post('/force-check-all', async (req, res) => {
  try {
    console.log('🔄 Forzando verificación todos los usuarios...');
    
    const db = require('../config/database');
    
    // Obtener todos los usuarios activos con ubicaciones recientes
    const users = await db.query(`
      SELECT DISTINCT user_id
      FROM gps_locations
      WHERE gps_timestamp >= NOW() - INTERVAL '10 minutes'
    `);
    
    let processed = 0;
    let errors = 0;
    
    for (const user of users.rows) {
      try {
        await realTimeProcessor.processLocationImmediate({
          user_id: user.user_id,
          force: true
        });
        processed++;
      } catch (error) {
        errors++;
      }
    }
    
    res.json({
      success: true,
      message: 'Verificación forzada completada',
      processed,
      errors,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configurar frecuencia de detección
router.post('/set-detection-frequency', async (req, res) => {
  try {
    const { frequency } = req.body; // en segundos
    
    if (frequency < 15) {
      return res.status(400).json({ 
        success: false, 
        error: 'Frecuencia mínima: 15 segundos' 
      });
    }
    
    // Aquí podrías implementar cambio dinámico de frecuencia
    // Por ahora retornamos la configuración actual
    
    res.json({
      success: true,
      message: 'Frecuencia configurada',
      currentFrequency: 30,
      requestedFrequency: frequency
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;