const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAdmin, requireDirectorOrAdmin, basicAuth, filterDataByUserAccess } = require('../../middleware/permissions');

/**
 * API Routes para Gestión de Directores
 * Sistema jerárquico de permisos
 */

// Middleware de autenticación básica (temporal)
router.use(basicAuth);

/**
 * GET /api/directors
 * Lista de directores con sus estadísticas
 */
router.get('/', requireDirectorOrAdmin(), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.*,
        COUNT(DISTINCT og.id) as groups_count,
        COUNT(DISTINCT tu.id) as users_count,
        COUNT(DISTINCT tu.id) FILTER (WHERE tu.active = true) as active_users_count,
        ARRAY_AGG(DISTINCT og.name) FILTER (WHERE og.name IS NOT NULL) as group_names
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
      active_users_count: parseInt(director.active_users_count) || 0,
      group_names: director.group_names || []
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
 * GET /api/directors/:id
 * Detalle de un director específico
 */
router.get('/:id', requireDirectorOrAdmin(), async (req, res) => {
  try {
    const directorId = parseInt(req.params.id);
    
    if (isNaN(directorId)) {
      return res.status(400).json({
        error: 'ID de director inválido'
      });
    }
    
    const result = await db.query(`
      SELECT 
        d.*,
        COUNT(DISTINCT og.id) as groups_count,
        COUNT(DISTINCT tu.id) as users_count,
        COUNT(DISTINCT tu.id) FILTER (WHERE tu.active = true) as active_users_count
      FROM directors d
      LEFT JOIN operational_groups og ON d.id = og.director_id AND og.active = true
      LEFT JOIN tracking_users tu ON d.id = tu.director_id
      WHERE d.id = $1 AND d.active = true
      GROUP BY d.id
    `, [directorId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    const director = result.rows[0];
    
    // Obtener grupos asignados
    const groupsResult = await db.query(`
      SELECT og.*, dg.assigned_at
      FROM operational_groups og
      JOIN director_groups dg ON og.id = dg.group_id
      WHERE dg.director_id = $1 AND og.active = true
      ORDER BY og.name
    `, [directorId]);
    
    // Obtener usuarios bajo este director
    const usersResult = await db.query(`
      SELECT 
        id,
        tracker_id,
        display_name,
        zenput_email,
        role,
        group_name,
        active,
        last_location_time
      FROM tracking_users
      WHERE director_id = $1
      ORDER BY display_name
    `, [directorId]);
    
    const response = {
      ...director,
      groups_count: parseInt(director.groups_count) || 0,
      users_count: parseInt(director.users_count) || 0,
      active_users_count: parseInt(director.active_users_count) || 0,
      groups: groupsResult.rows,
      users: usersResult.rows
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error getting director detail:', error.message);
    res.status(500).json({
      error: 'Error obteniendo detalle del director',
      details: error.message
    });
  }
});

/**
 * POST /api/directors
 * Crear nuevo director
 */
router.post('/', requireAdmin(), async (req, res) => {
  try {
    const { name, email, phone, telegramChatId, region } = req.body;
    
    // Validaciones básicas
    if (!name || !email || !region) {
      return res.status(400).json({
        error: 'Campos requeridos: name, email, region'
      });
    }
    
    // Verificar que el email no existe
    const existingResult = await db.query(
      'SELECT id FROM directors WHERE email = $1',
      [email]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un director con este email'
      });
    }
    
    // Crear director
    const result = await db.query(`
      INSERT INTO directors (
        name, 
        email, 
        phone, 
        telegram_chat_id, 
        region, 
        created_by, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [
      name, 
      email, 
      phone || null, 
      telegramChatId || null, 
      region, 
      req.user.id
    ]);
    
    const newDirector = result.rows[0];
    
    res.status(201).json({
      director: newDirector,
      message: `Director ${name} creado exitosamente para región ${region}`
    });
    
  } catch (error) {
    console.error('❌ Error creating director:', error.message);
    
    // Manejar errores específicos
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      error: 'Error creando director',
      details: error.message
    });
  }
});

/**
 * PUT /api/directors/:id
 * Actualizar director existente
 */
router.put('/:id', requireAdmin(), async (req, res) => {
  try {
    const directorId = parseInt(req.params.id);
    const { name, email, phone, telegramChatId, region, active } = req.body;
    
    if (isNaN(directorId)) {
      return res.status(400).json({
        error: 'ID de director inválido'
      });
    }
    
    // Verificar que el director existe
    const existingResult = await db.query(
      'SELECT id FROM directors WHERE id = $1',
      [directorId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    // Si se cambia email, verificar que no existe
    if (email) {
      const emailCheckResult = await db.query(
        'SELECT id FROM directors WHERE email = $1 AND id != $2',
        [email, directorId]
      );
      
      if (emailCheckResult.rows.length > 0) {
        return res.status(409).json({
          error: 'Ya existe un director con este email'
        });
      }
    }
    
    // Construir query dinámicamente
    const updateFields = [];
    const values = [];
    let valueIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${valueIndex++}`);
      values.push(name);
    }
    
    if (email !== undefined) {
      updateFields.push(`email = $${valueIndex++}`);
      values.push(email);
    }
    
    if (phone !== undefined) {
      updateFields.push(`phone = $${valueIndex++}`);
      values.push(phone);
    }
    
    if (telegramChatId !== undefined) {
      updateFields.push(`telegram_chat_id = $${valueIndex++}`);
      values.push(telegramChatId);
    }
    
    if (region !== undefined) {
      updateFields.push(`region = $${valueIndex++}`);
      values.push(region);
    }
    
    if (active !== undefined) {
      updateFields.push(`active = $${valueIndex++}`);
      values.push(active);
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(directorId);
    
    const query = `
      UPDATE directors 
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    const updatedDirector = result.rows[0];
    
    res.json({
      director: updatedDirector,
      message: `Director ${updatedDirector.name} actualizado exitosamente`
    });
    
  } catch (error) {
    console.error('❌ Error updating director:', error.message);
    res.status(500).json({
      error: 'Error actualizando director',
      details: error.message
    });
  }
});

/**
 * POST /api/directors/:id/assign-groups
 * Asignar grupos operativos a un director
 */
router.post('/:id/assign-groups', requireAdmin(), async (req, res) => {
  try {
    const directorId = parseInt(req.params.id);
    const { groupIds } = req.body;
    
    if (isNaN(directorId)) {
      return res.status(400).json({
        error: 'ID de director inválido'
      });
    }
    
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({
        error: 'Se requiere un array de IDs de grupos'
      });
    }
    
    // Verificar que el director existe
    const directorResult = await db.query(
      'SELECT id, name FROM directors WHERE id = $1 AND active = true',
      [directorId]
    );
    
    if (directorResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    const director = directorResult.rows[0];
    
    // Verificar que todos los grupos existen
    const groupsResult = await db.query(`
      SELECT id, name FROM operational_groups 
      WHERE id = ANY($1) AND active = true
    `, [groupIds]);
    
    if (groupsResult.rows.length !== groupIds.length) {
      return res.status(400).json({
        error: 'Algunos grupos no existen o están inactivos'
      });
    }
    
    // Iniciar transacción
    await db.query('BEGIN');
    
    try {
      // Eliminar asignaciones previas
      await db.query(
        'DELETE FROM director_groups WHERE director_id = $1',
        [directorId]
      );
      
      // Crear nuevas asignaciones
      for (const groupId of groupIds) {
        await db.query(`
          INSERT INTO director_groups (director_id, group_id, assigned_by, assigned_at)
          VALUES ($1, $2, $3, NOW())
        `, [directorId, groupId, req.user.id]);
      }
      
      // Actualizar director_id en operational_groups
      await db.query(`
        UPDATE operational_groups 
        SET director_id = $1 
        WHERE id = ANY($2)
      `, [directorId, groupIds]);
      
      await db.query('COMMIT');
      
      const assignedGroups = groupsResult.rows;
      
      res.json({
        director: director,
        assignedGroups: assignedGroups,
        message: `${assignedGroups.length} grupos asignados a ${director.name}`
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error assigning groups to director:', error.message);
    res.status(500).json({
      error: 'Error asignando grupos al director',
      details: error.message
    });
  }
});

/**
 * GET /api/directors/:id/dashboard
 * Dashboard específico para un director
 */
router.get('/:id/dashboard', requireDirectorOrAdmin(), async (req, res) => {
  try {
    const directorId = parseInt(req.params.id);
    
    if (isNaN(directorId)) {
      return res.status(400).json({
        error: 'ID de director inválido'
      });
    }
    
    // Verificar acceso: solo admin o el director mismo
    if (req.user.role_level !== 1 && req.user.director_id !== directorId) {
      return res.status(403).json({
        error: 'Acceso denegado: solo puedes ver tu propio dashboard'
      });
    }
    
    // Stats del director
    const statsResult = await db.query(`
      SELECT 
        COUNT(DISTINCT tu.id) as total_users,
        COUNT(DISTINCT tu.id) FILTER (WHERE tu.active = true) as active_users,
        COUNT(DISTINCT og.id) as total_groups,
        d.region
      FROM directors d
      LEFT JOIN operational_groups og ON d.id = og.director_id AND og.active = true
      LEFT JOIN tracking_users tu ON d.id = tu.director_id
      WHERE d.id = $1 AND d.active = true
      GROUP BY d.id, d.region
    `, [directorId]);
    
    if (statsResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    const stats = statsResult.rows[0];
    
    // Última actividad GPS
    const lastActivityResult = await db.query(`
      SELECT 
        gl.received_at,
        tu.display_name,
        tu.tracker_id
      FROM gps_locations gl
      JOIN tracking_users tu ON gl.user_id = tu.id
      WHERE tu.director_id = $1
      ORDER BY gl.received_at DESC
      LIMIT 1
    `, [directorId]);
    
    // Visitas de hoy en su región
    const visitsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM geofence_events ge
      JOIN tracking_users tu ON ge.user_id = tu.id
      WHERE tu.director_id = $1
      AND DATE(ge.event_timestamp) = CURRENT_DATE
      AND ge.event_type = 'entry'
    `, [directorId]);
    
    const lastActivity = lastActivityResult.rows[0];
    const visitsToday = parseInt(visitsResult.rows[0].count);
    
    res.json({
      director_id: directorId,
      region: stats.region,
      stats: {
        totalUsers: parseInt(stats.total_users) || 0,
        activeUsers: parseInt(stats.active_users) || 0,
        totalGroups: parseInt(stats.total_groups) || 0,
        visitsToday: visitsToday
      },
      lastActivity: lastActivity ? {
        time: lastActivity.received_at,
        user: lastActivity.display_name,
        trackerId: lastActivity.tracker_id
      } : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting director dashboard:', error.message);
    res.status(500).json({
      error: 'Error obteniendo dashboard del director',
      details: error.message
    });
  }
});

/**
 * DELETE /api/directors/:id
 * Eliminar director (soft delete)
 */
router.delete('/:id', requireAdmin(), async (req, res) => {
  try {
    const directorId = parseInt(req.params.id);
    
    if (isNaN(directorId)) {
      return res.status(400).json({
        error: 'ID de director inválido'
      });
    }
    
    // Verificar que el director existe
    const existingResult = await db.query(
      'SELECT id, name FROM directors WHERE id = $1',
      [directorId]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    const director = existingResult.rows[0];
    
    // Soft delete
    await db.query(`
      UPDATE directors 
      SET active = false, updated_at = NOW()
      WHERE id = $1
    `, [directorId]);
    
    res.json({
      message: `Director ${director.name} desactivado exitosamente`
    });
    
  } catch (error) {
    console.error('❌ Error deleting director:', error.message);
    res.status(500).json({
      error: 'Error eliminando director',
      details: error.message
    });
  }
});

module.exports = router;