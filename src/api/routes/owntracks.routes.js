const express = require('express');
const router = express.Router();
const locationProcessor = require('../../services/location-processor');

/**
 * POST /api/owntracks/location
 * Endpoint principal para recibir ubicaciones de OwnTracks
 */
router.post('/location', async (req, res) => {
  try {
    const payload = req.body;
    const timestamp = new Date().toISOString();
    
    // Enhanced logging
    console.log(`\n📱 [${timestamp}] OwnTracks request received`);
    console.log(`📡 Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📍 Payload:`, JSON.stringify(payload, null, 2));
    console.log(`🔍 Content-Type:`, req.get('Content-Type'));
    console.log(`📏 Content-Length:`, req.get('Content-Length'));
    
    // Validación básica del payload
    if (!payload || typeof payload !== 'object') {
      console.log(`❌ Invalid payload type: ${typeof payload}`);
      return res.status(400).json({
        error: 'Payload inválido',
        received: typeof payload,
        timestamp
      });
    }
    
    // Log de ubicación recibida con detalles
    console.log(`📍 Processing location from ${payload.tid || 'unknown'} at ${payload.lat}, ${payload.lon}`);
    
    // Procesar ubicación
    console.log(`🔄 Sending to location processor...`);
    const result = await locationProcessor.processLocation(payload);
    console.log(`✅ Location processor result:`, JSON.stringify(result, null, 2));
    
    // Respuesta basada en resultado
    if (result.processed) {
      res.json({
        status: 'success',
        message: 'Ubicación procesada correctamente',
        tracker_id: payload.tid,
        user: result.user,
        timestamp: new Date().toISOString()
      });
    } else if (result.skipped) {
      res.json({
        status: 'skipped',
        reason: result.reason,
        message: getSkippedMessage(result.reason),
        tracker_id: payload.tid,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'error',
        error: result.error || 'Error desconocido procesando ubicación',
        tracker_id: payload.tid,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error en endpoint OwnTracks:', error.message);
    
    res.status(500).json({
      status: 'error',
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/owntracks/status
 * Estado del sistema de tracking
 */
router.get('/status', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Verificar estado del sistema
    const systemActive = await db.getConfig('system_active', 'false');
    const workHoursStart = await db.getConfig('work_hours_start', '07:00');
    const workHoursEnd = await db.getConfig('work_hours_end', '21:00');
    
    // Obtener estadísticas básicas
    const stats = await getSystemStats();
    
    res.json({
      status: 'ok',
      system: {
        active: systemActive === 'true',
        work_hours: {
          start: workHoursStart,
          end: workHoursEnd
        }
      },
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo status:', error.message);
    
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/owntracks/ping
 * Simple ping endpoint to test connectivity
 */
router.get('/ping', (req, res) => {
  console.log(`🏓 Ping received from ${req.ip} at ${new Date().toISOString()}`);
  res.json({
    status: 'pong',
    message: 'OwnTracks endpoint is reachable',
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
});

/**
 * POST /api/owntracks/test
 * Endpoint para testing (solo en desarrollo)
 */
router.post('/test', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint no disponible en producción' });
  }
  
  try {
    const { tid, lat, lon } = req.body;
    
    if (!tid || lat === undefined || lon === undefined) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos: tid, lat, lon'
      });
    }
    
    // Crear payload de prueba
    const testPayload = {
      _type: 'location',
      tid: tid,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      tst: Math.floor(Date.now() / 1000),
      acc: 10,
      batt: 75,
      vel: 0,
      cog: 0
    };
    
    console.log(`🧪 Test location: ${tid} @ ${lat}, ${lon}`);
    
    const result = await locationProcessor.processLocation(testPayload);
    
    res.json({
      status: 'test_completed',
      input: testPayload,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en test endpoint:', error.message);
    
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Obtener mensaje descriptivo para ubicación omitida
 */
function getSkippedMessage(reason) {
  const messages = {
    'outside_working_hours': 'Fuera de horario laboral',
    'low_accuracy': 'Precisión GPS muy baja',
    'user_not_found': 'Usuario no encontrado',
    'user_paused': 'Usuario pausado',
    'system_paused': 'Sistema pausado',
    'invalid_coordinates': 'Coordenadas inválidas',
    'duplicate_location': 'Ubicación duplicada',
    'missing_tracker_id': 'Falta ID de tracker',
    'missing_coordinates': 'Faltan coordenadas',
    'missing_timestamp': 'Falta timestamp',
    'invalid_message_type': 'Tipo de mensaje inválido',
    'future_timestamp': 'Timestamp en el futuro',
    'timestamp_too_old': 'Timestamp muy antiguo'
  };
  
  return messages[reason] || 'Razón desconocida';
}

/**
 * Obtener estadísticas básicas del sistema
 */
async function getSystemStats() {
  try {
    const db = require('../../config/database');
    
    // Usuarios activos
    const activeUsers = await db.query(`
      SELECT COUNT(*) as count 
      FROM tracking_users 
      WHERE active = true
    `);
    
    // Ubicaciones recibidas hoy
    const locationsToday = await db.query(`
      SELECT COUNT(*) as count 
      FROM tracking_locations 
      WHERE DATE(gps_timestamp) = CURRENT_DATE
    `);
    
    // Visitas hoy
    const visitsToday = await db.query(`
      SELECT COUNT(*) as count 
      FROM tracking_visits 
      WHERE DATE(entry_time) = CURRENT_DATE
    `);
    
    return {
      active_users: parseInt(activeUsers.rows[0].count),
      locations_today: parseInt(locationsToday.rows[0].count),
      visits_today: parseInt(visitsToday.rows[0].count)
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
    return {
      active_users: 0,
      locations_today: 0,
      visits_today: 0,
      error: error.message
    };
  }
}

module.exports = router;