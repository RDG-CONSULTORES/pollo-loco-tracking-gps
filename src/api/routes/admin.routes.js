const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * Middleware: Verificar autenticación (simplificado para demo)
 * En producción, implementar JWT o autenticación más robusta
 */
router.use((req, res, next) => {
  // TODO: Implementar autenticación real
  // Por ahora, permitir acceso directo desde Telegram Web App
  next();
});

/**
 * GET /api/admin/users
 * Obtener lista de usuarios de tracking
 */
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        tracker_id,
        zenput_email,
        zenput_user_id,
        display_name,
        phone,
        active,
        created_at,
        updated_at
      FROM tracking_users
      ORDER BY display_name
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users
 * Crear nuevo usuario de tracking
 */
router.post('/users', async (req, res) => {
  try {
    const {
      tracker_id,
      zenput_email,
      zenput_user_id,
      display_name,
      phone
    } = req.body;
    
    // Validaciones
    if (!tracker_id || !zenput_email || !display_name) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: tracker_id, zenput_email, display_name'
      });
    }
    
    // Verificar que tracker_id no exista
    const existingUser = await db.query(
      'SELECT id FROM tracking_users WHERE tracker_id = $1',
      [tracker_id]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: `Tracker ID '${tracker_id}' ya existe`
      });
    }
    
    // Crear usuario
    const result = await db.query(`
      INSERT INTO tracking_users 
      (tracker_id, zenput_email, zenput_user_id, display_name, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [tracker_id, zenput_email, zenput_user_id, display_name, phone]);
    
    const newUser = result.rows[0];
    
    // Log de auditoría
    await logAdminAction('create_user', 'tracking_users', newUser.id, null, JSON.stringify(newUser));
    
    console.log(`✅ Usuario creado: ${tracker_id} (${display_name})`);
    
    res.status(201).json(newUser);
    
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:tracker_id
 * Actualizar usuario de tracking
 */
router.put('/users/:tracker_id', async (req, res) => {
  try {
    const { tracker_id } = req.params;
    const { active, display_name, phone, zenput_email } = req.body;
    
    // Obtener usuario actual para auditoría
    const currentResult = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1',
      [tracker_id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        error: `Usuario '${tracker_id}' no encontrado`
      });
    }
    
    const currentUser = currentResult.rows[0];
    
    // Construir query dinámico
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(active);
    }
    
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(display_name);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (zenput_email !== undefined) {
      updates.push(`zenput_email = $${paramIndex++}`);
      values.push(zenput_email);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(tracker_id);
    
    const query = `
      UPDATE tracking_users 
      SET ${updates.join(', ')}
      WHERE tracker_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    const updatedUser = result.rows[0];
    
    // Log de auditoría
    await logAdminAction('update_user', 'tracking_users', tracker_id, 
      JSON.stringify(currentUser), JSON.stringify(updatedUser));
    
    console.log(`✅ Usuario actualizado: ${tracker_id}`);
    
    res.json(updatedUser);
    
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/config
 * Obtener configuración del sistema
 */
router.get('/config', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT key, value, data_type, description
      FROM tracking_config
      ORDER BY key
    `);
    
    const config = {};
    result.rows.forEach(row => {
      config[row.key] = {
        value: row.value,
        type: row.data_type,
        description: row.description
      };
    });
    
    res.json(config);
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/config/:key
 * Actualizar configuración
 */
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        error: 'Valor requerido'
      });
    }
    
    // Obtener valor actual
    const currentResult = await db.query(
      'SELECT value FROM tracking_config WHERE key = $1',
      [key]
    );
    
    const oldValue = currentResult.rows[0]?.value;
    
    const success = await db.setConfig(key, value, 'admin_api');
    
    if (success) {
      // Log de auditoría
      await logAdminAction('update_config', 'tracking_config', key, oldValue, value);
      
      res.json({ 
        key, 
        value, 
        old_value: oldValue,
        updated_at: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'Error actualizando configuración' });
    }
    
  } catch (error) {
    console.error('❌ Error actualizando configuración:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/visits/today
 * Visitas de hoy para panel admin
 */
router.get('/visits/today', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        v.id,
        v.tracker_id,
        tu.display_name as supervisor_name,
        v.location_code,
        lc.name as location_name,
        lc.group_name,
        v.entrada_at,
        v.salida_at,
        v.duracion_minutos,
        v.visit_type,
        v.is_valid
      FROM tracking_visits v
      LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
      LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code
      WHERE DATE(v.entrada_at) = CURRENT_DATE
      ORDER BY v.entrada_at DESC
      LIMIT 50
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo visitas admin:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stats/dashboard
 * Estadísticas para dashboard
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    const stats = {};
    
    // Usuarios activos
    const usersResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM tracking_users
    `);
    stats.users = usersResult.rows[0];
    
    // Sucursales
    const locationsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM tracking_locations_cache
    `);
    stats.locations = locationsResult.rows[0];
    
    // Visitas hoy
    const visitsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE salida_at IS NOT NULL) as completed,
        COUNT(*) FILTER (WHERE salida_at IS NULL) as open
      FROM tracking_visits
      WHERE DATE(entrada_at) = CURRENT_DATE
    `);
    stats.visits_today = visitsResult.rows[0];
    
    // Sistema activo
    const systemActive = await db.getConfig('system_active', 'false');
    stats.system_status = systemActive === 'true' ? 'active' : 'paused';
    
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas dashboard:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/logs
 * Obtener logs de auditoría
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT 
        id,
        admin_user,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        timestamp
      FROM tracking_admin_log
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    res.json({
      logs: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo logs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/actions/cleanup
 * Limpiar datos antiguos
 */
router.post('/actions/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    
    const locationProcessor = require('../../services/location-processor');
    const visitDetector = require('../../services/visit-detector');
    
    const results = {
      old_locations: await locationProcessor.cleanupOldLocations(days),
      invalid_visits: await visitDetector.cleanupInvalidVisits()
    };
    
    // Log de auditoría
    await logAdminAction('cleanup', 'system', 'maintenance', null, JSON.stringify(results));
    
    res.json({
      status: 'completed',
      results
    });
    
  } catch (error) {
    console.error('❌ Error en cleanup:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Log de auditoría
 */
async function logAdminAction(action, entityType, entityId, oldValue, newValue, adminUser = 'api') {
  try {
    await db.query(`
      INSERT INTO tracking_admin_log 
      (admin_user, action, entity_type, entity_id, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [adminUser, action, entityType, entityId, oldValue, newValue]);
  } catch (error) {
    console.error('❌ Error logging admin action:', error.message);
  }
}

module.exports = router;