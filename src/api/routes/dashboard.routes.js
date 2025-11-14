const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const websocketManager = require('../../services/websocket-manager');

/**
 * API Routes para Dashboard GPS
 */

/**
 * GET /api/dashboard/users
 * Obtener lista de usuarios con sus ubicaciones actuales
 */
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        tu.id,
        tu.tracker_id,
        tu.display_name,
        tu.zenput_email,
        tu.grupo,
        tu.rol,
        tu.active,
        gl.latitude,
        gl.longitude,
        gl.accuracy,
        gl.battery,
        gl.velocity,
        gl.gps_timestamp,
        EXTRACT(EPOCH FROM (NOW() - gl.gps_timestamp))/60 as minutes_ago
      FROM tracking_users tu
      LEFT JOIN LATERAL (
        SELECT *
        FROM gps_locations gl2
        WHERE gl2.user_id = tu.id
        ORDER BY gl2.gps_timestamp DESC
        LIMIT 1
      ) gl ON true
      WHERE tu.active = true
      ORDER BY 
        CASE WHEN gl.gps_timestamp IS NULL THEN 1 ELSE 0 END,
        gl.gps_timestamp DESC
    `);

    res.json({
      users: result.rows,
      timestamp: new Date().toISOString(),
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios dashboard:', error);
    res.status(500).json({ 
      error: 'Error obteniendo usuarios',
      details: error.message 
    });
  }
});

/**
 * GET /api/dashboard/geofences
 * Obtener lista de geofences (sucursales)
 */
router.get('/geofences', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        location_code,
        location_name,
        grupo,
        latitude,
        longitude,
        radius_meters,
        active,
        created_at
      FROM geofences 
      WHERE active = true
      ORDER BY location_name
    `);

    res.json({
      geofences: result.rows,
      timestamp: new Date().toISOString(),
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo geofences:', error);
    res.status(500).json({ 
      error: 'Error obteniendo geofences',
      details: error.message 
    });
  }
});

/**
 * GET /api/dashboard/user/:userId/trail
 * Obtener trail de ubicaciones de un usuario
 */
router.get('/user/:userId/trail', async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query; // Últimas 24 horas por defecto

    const result = await db.query(`
      SELECT 
        latitude,
        longitude,
        accuracy,
        battery,
        velocity,
        gps_timestamp
      FROM gps_locations 
      WHERE user_id = $1
        AND gps_timestamp >= NOW() - INTERVAL '1 hour' * $2
      ORDER BY gps_timestamp ASC
    `, [userId, parseInt(hours)]);

    res.json({
      trail: result.rows,
      userId: parseInt(userId),
      hours: parseInt(hours),
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo trail:', error);
    res.status(500).json({ 
      error: 'Error obteniendo trail',
      details: error.message 
    });
  }
});

/**
 * GET /api/dashboard/stats
 * Obtener estadísticas generales del sistema
 */
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = await db.query(`
      SELECT 
        -- Usuarios
        COUNT(DISTINCT tu.id) as total_users,
        COUNT(DISTINCT CASE WHEN gl.gps_timestamp >= NOW() - INTERVAL '5 minutes' THEN tu.id END) as users_online,
        COUNT(DISTINCT CASE WHEN gl.gps_timestamp >= NOW() - INTERVAL '1 hour' THEN tu.id END) as users_active_hour,
        
        -- Ubicaciones
        COUNT(gl.id) as locations_today,
        AVG(gl.accuracy) as avg_accuracy,
        AVG(gl.battery) as avg_battery,
        
        -- Estado
        COUNT(CASE WHEN gl.battery < 20 THEN 1 END) as battery_low_count,
        COUNT(CASE WHEN gl.battery < 10 THEN 1 END) as battery_critical_count
        
      FROM tracking_users tu
      LEFT JOIN gps_locations gl ON tu.id = gl.user_id 
        AND gl.gps_timestamp >= CURRENT_DATE
      WHERE tu.active = true
    `);

    // Eventos de geofencing de hoy
    const geofenceEvents = await db.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'enter' THEN 1 END) as entries,
        COUNT(CASE WHEN event_type = 'exit' THEN 1 END) as exits
      FROM geofence_events
      WHERE event_timestamp >= CURRENT_DATE
    `);

    const stats = statsQuery.rows[0];
    const events = geofenceEvents.rows[0];

    res.json({
      users: {
        total: parseInt(stats.total_users) || 0,
        online: parseInt(stats.users_online) || 0,
        activeLastHour: parseInt(stats.users_active_hour) || 0,
        batteryLow: parseInt(stats.battery_low_count) || 0,
        batteryCritical: parseInt(stats.battery_critical_count) || 0
      },
      locations: {
        today: parseInt(stats.locations_today) || 0,
        avgAccuracy: Math.round(parseFloat(stats.avg_accuracy) || 0),
        avgBattery: Math.round(parseFloat(stats.avg_battery) || 0)
      },
      geofenceEvents: {
        total: parseInt(events.total_events) || 0,
        entries: parseInt(events.entries) || 0,
        exits: parseInt(events.exits) || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas',
      details: error.message 
    });
  }
});

/**
 * GET /api/dashboard/recent-events
 * Obtener eventos recientes del sistema
 */
router.get('/recent-events', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await db.query(`
      SELECT 
        ge.id,
        ge.event_type,
        ge.event_timestamp,
        ge.latitude,
        ge.longitude,
        tu.display_name as user_name,
        tu.tracker_id,
        g.location_name,
        g.location_code,
        g.grupo
      FROM geofence_events ge
      INNER JOIN tracking_users tu ON ge.user_id = tu.id
      INNER JOIN geofences g ON ge.geofence_id = g.id
      ORDER BY ge.event_timestamp DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      events: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo eventos recientes:', error);
    res.status(500).json({ 
      error: 'Error obteniendo eventos recientes',
      details: error.message 
    });
  }
});

/**
 * GET /api/dashboard/websocket/stats
 * Obtener estadísticas de conexiones WebSocket
 */
router.get('/websocket/stats', async (req, res) => {
  try {
    const wsStats = websocketManager.getStats();
    
    res.json({
      websocket: wsStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo stats WebSocket:', error);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas WebSocket',
      details: error.message 
    });
  }
});

/**
 * POST /api/dashboard/user/:userId/center
 * Enviar comando para centrar mapa en usuario (ejemplo de comando)
 */
router.post('/user/:userId/center', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Obtener ubicación actual del usuario
    const result = await db.query(`
      SELECT 
        tu.display_name,
        gl.latitude,
        gl.longitude
      FROM tracking_users tu
      INNER JOIN LATERAL (
        SELECT *
        FROM gps_locations gl2
        WHERE gl2.user_id = tu.id
        ORDER BY gl2.gps_timestamp DESC
        LIMIT 1
      ) gl ON true
      WHERE tu.id = $1
    `, [parseInt(userId)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o sin ubicación' });
    }

    const user = result.rows[0];
    
    // Broadcast evento para centrar mapa
    websocketManager.broadcastToSubscribers('map_commands', {
      type: 'center_user',
      data: {
        userId: parseInt(userId),
        userName: user.display_name,
        latitude: user.latitude,
        longitude: user.longitude
      },
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Comando enviado para centrar en ${user.display_name}`,
      user: user
    });

  } catch (error) {
    console.error('❌ Error enviando comando centro:', error);
    res.status(500).json({ 
      error: 'Error enviando comando',
      details: error.message 
    });
  }
});

/**
 * GET /api/dashboard/health
 * Health check específico para dashboard
 */
router.get('/health', async (req, res) => {
  try {
    // Verificar conexión a BD
    await db.query('SELECT 1');
    
    // Verificar WebSocket
    const wsStats = websocketManager.getStats();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      websocket: {
        active: true,
        connections: wsStats.totalConnections
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;