const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * API Routes para Admin Panel Mobile
 * Optimizado para Telegram Web App
 */

/**
 * GET /api/admin/stats
 * Estadísticas rápidas del dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    // Usuarios activos
    const activeUsersResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM tracking_users 
      WHERE active = true
    `);

    // Total de sucursales
    const totalStoresResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM tracking_locations_cache 
      WHERE active = true
    `);

    // Visitas de hoy
    const visitsResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM geofence_events 
      WHERE DATE(event_timestamp) = CURRENT_DATE 
      AND event_type = 'entry'
    `);

    // Estado del sistema
    const systemActive = await db.getConfig('system_active', 'true');

    res.json({
      activeUsers: parseInt(activeUsersResult.rows[0].count),
      totalStores: parseInt(totalStoresResult.rows[0].count),
      visitsToday: parseInt(visitsResult.rows[0].count),
      systemActive: systemActive === 'true',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting stats:', error.message);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/quick-status
 * Estado rápido del sistema
 */
router.get('/quick-status', async (req, res) => {
  try {
    // Usuarios totales y activos
    const usersResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM tracking_users
    `);

    // Última ubicación recibida
    const lastLocationResult = await db.query(`
      SELECT 
        gl.received_at,
        tu.display_name
      FROM gps_locations gl
      JOIN tracking_users tu ON gl.user_id = tu.id
      ORDER BY gl.received_at DESC
      LIMIT 1
    `);

    // Alertas pendientes (simulado por ahora)
    const pendingAlerts = 0;

    const users = usersResult.rows[0];
    const lastLocation = lastLocationResult.rows[0];

    res.json({
      totalUsers: parseInt(users.total),
      activeUsers: parseInt(users.active),
      lastLocationTime: lastLocation ? 
        new Date(lastLocation.received_at).toLocaleString('es-MX') : null,
      lastLocationUser: lastLocation ? lastLocation.display_name : null,
      pendingAlerts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting quick status:', error.message);
    res.status(500).json({
      error: 'Error obteniendo estado rápido',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/users
 * Lista de usuarios GPS
 */
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        tracker_id,
        display_name,
        zenput_email,
        phone,
        role,
        group_name,
        active,
        last_location_time,
        last_battery_level,
        created_at,
        updated_at
      FROM tracking_users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error getting users:', error.message);
    res.status(500).json({
      error: 'Error obteniendo usuarios',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/users
 * Crear nuevo usuario GPS
 */
router.post('/users', async (req, res) => {
  try {
    const { displayName, zenputEmail, phone, userRole, userGroup } = req.body;

    // Validaciones básicas
    if (!displayName || !zenputEmail || !userRole) {
      return res.status(400).json({
        error: 'Campos requeridos: displayName, zenputEmail, userRole'
      });
    }

    // Auto-generar tracker ID único
    const trackerId = await generateUniqueTrackerId(userRole);

    // Crear usuario
    const result = await db.query(`
      INSERT INTO tracking_users (
        tracker_id,
        display_name,
        zenput_email,
        phone,
        role,
        group_name,
        active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING *
    `, [
      trackerId,
      displayName,
      zenputEmail,
      phone,
      userRole,
      userGroup || 'General'
    ]);

    const newUser = result.rows[0];

    // Generar configuración OwnTracks
    const ownTracksConfig = generateOwnTracksConfig(newUser);

    res.status(201).json({
      user: newUser,
      trackerId,
      ownTracksConfig,
      message: `Usuario ${displayName} creado exitosamente con ID: ${trackerId}`
    });

  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    
    // Manejar errores específicos
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'El email o tracker ID ya existe'
      });
    }

    res.status(500).json({
      error: 'Error creando usuario',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/directors
 * Lista de directores desde sistema de permisos
 */
router.get('/directors', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.*,
        COUNT(DISTINCT og.id) as groups_count,
        COUNT(DISTINCT tu.id) as users_count,
        COUNT(DISTINCT tu.id) FILTER (WHERE tu.active = true) as active_users_count
      FROM directors d
      LEFT JOIN operational_groups og ON d.id = og.director_id AND og.active = true
      LEFT JOIN tracking_users tu ON d.id = tu.director_id
      WHERE d.active = true
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);

    const directors = result.rows.map(director => ({
      ...director,
      groups_count: parseInt(director.groups_count) || 0,
      users_count: parseInt(director.users_count) || 0,
      active_users_count: parseInt(director.active_users_count) || 0
    }));

    res.json(directors);

  } catch (error) {
    console.error('❌ Error getting directors:', error.message);
    res.status(500).json({
      error: 'Error obteniendo directores',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/groups
 * Lista de grupos operativos
 */
router.get('/groups', async (req, res) => {
  try {
    // Obtener grupos únicos de usuarios existentes
    const result = await db.query(`
      SELECT DISTINCT group_name as name
      FROM tracking_users
      WHERE group_name IS NOT NULL
      ORDER BY group_name
    `);

    const defaultGroups = [
      { id: 'general', name: 'General' },
      { id: 'norte', name: 'Zona Norte' },
      { id: 'sur', name: 'Zona Sur' },
      { id: 'centro', name: 'Zona Centro' },
      { id: 'metropolitana', name: 'Zona Metropolitana' }
    ];

    const existingGroups = result.rows.map((row, index) => ({
      id: `existing_${index}`,
      name: row.name
    }));

    res.json([...defaultGroups, ...existingGroups]);

  } catch (error) {
    console.error('❌ Error getting groups:', error.message);
    res.status(500).json({
      error: 'Error obteniendo grupos',
      details: error.message
    });
  }
});

/**
 * Funciones auxiliares
 */

/**
 * Generar tracker ID único basado en rol
 */
async function generateUniqueTrackerId(role) {
  const prefix = {
    'director': 'DIR',
    'gerente': 'GER', 
    'supervisor': 'SUP',
    'auditor': 'AUD',
    'usuario': 'USR'
  }[role] || 'USR';

  let trackerId;
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    trackerId = `${prefix}${counter.toString().padStart(2, '0')}`;
    
    const result = await db.query(
      'SELECT id FROM tracking_users WHERE tracker_id = $1',
      [trackerId]
    );
    
    if (result.rows.length === 0) {
      isUnique = true;
    } else {
      counter++;
    }
  }

  return trackerId;
}

/**
 * Generar configuración OwnTracks
 */
function generateOwnTracksConfig(user) {
  const serverUrl = process.env.WEB_APP_URL || 'https://pollo-loco-tracking-gps-production.up.railway.app';
  
  return {
    _type: "configuration",
    waypoints: [],
    settings: {
      _type: "configuration",
      tid: user.tracker_id,
      url: `${serverUrl}/api/owntracks/location`,
      deviceId: user.tracker_id,
      clientId: user.tracker_id,
      username: `pollolocogps_${user.tracker_id.toLowerCase()}`,
      password: generateSecurePassword(),
      host: serverUrl.replace('https://', '').replace('http://', ''),
      port: 443,
      ws: false,
      tls: true,
      auth: true,
      cleanSession: true,
      keepalive: 60,
      locatorInterval: 300,
      moveModeLocatorInterval: 60,
      monitoring: 1,
      ranging: true,
      ignoreStaleLocations: 168
    },
    metadata: {
      created: new Date().toISOString(),
      user: user.display_name,
      email: user.zenput_email,
      role: user.role,
      instructions: "Configuración automática para OwnTracks. Importa este archivo en la app OwnTracks."
    }
  };
}

/**
 * Generar password seguro
 */
function generateSecurePassword() {
  return 'plgps_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

module.exports = router;