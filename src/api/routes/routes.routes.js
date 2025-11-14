const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const routeEngine = require('../../services/route-engine');
const routeOptimizer = require('../../services/route-optimizer');

/**
 * API Routes para Sistema de Rutas
 * Cálculo, optimización y ejecución de rutas inteligentes
 */

/**
 * POST /api/routes/calculate
 * Calcular ruta optimizada entre sucursales
 */
router.post('/calculate', async (req, res) => {
  try {
    const {
      userId,
      startLocation,
      sucursales,
      algorithm = 'nearestNeighbor',
      strategy = 'balanced',
      useRealRoads = false,
      constraints = {},
      preferences = {}
    } = req.body;

    // Validaciones
    if (!sucursales || !Array.isArray(sucursales) || sucursales.length === 0) {
      return res.status(400).json({
        error: 'Se requiere un array de sucursales',
        code: 'MISSING_SUCURSALES'
      });
    }

    if (sucursales.length > 10) {
      return res.status(400).json({
        error: 'Máximo 10 sucursales por ruta',
        code: 'TOO_MANY_SUCURSALES'
      });
    }

    console.log(`🛣️ Calculando ruta para ${sucursales.length} sucursales...`);

    let result;
    
    if (useRealRoads || strategy !== 'distance') {
      // Usar optimizador inteligente con APIs externas
      result = await routeOptimizer.createOptimizedRoute({
        userId,
        startLocation,
        sucursales,
        strategy,
        useRealRoads,
        preferences: {
          ...preferences,
          constraints
        }
      });
    } else {
      // Usar motor básico de rutas
      result = await routeEngine.calculateOptimalRoute({
        startLocation,
        sucursales,
        algorithm,
        constraints,
        preferences
      });
    }

    if (result.success) {
      res.json({
        success: true,
        route: result.route,
        metrics: result.metrics,
        recommendations: result.recommendations || [],
        routeId: result.routeId,
        algorithm: algorithm,
        strategy: strategy,
        calculatedAt: new Date().toISOString(),
        improvements: result.improvements || null
      });
    } else {
      res.status(500).json({
        error: 'Error calculando ruta',
        details: result.error,
        fallbackRoute: result.fallbackRoute || null
      });
    }

  } catch (error) {
    console.error('❌ Error en /api/routes/calculate:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * POST /api/routes/quick
 * Ruta rápida usando ubicación actual del usuario
 */
router.post('/quick', async (req, res) => {
  try {
    const {
      userId,
      sucursales,
      maxSucursales = 5,
      maxDistanceKm = 50
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Se requiere userId' });
    }

    // Obtener ubicación actual del usuario
    const locationResult = await db.query(`
      SELECT latitude, longitude
      FROM gps_locations gl
      INNER JOIN tracking_users tu ON gl.user_id = tu.id
      WHERE tu.id = $1
      ORDER BY gl.gps_timestamp DESC
      LIMIT 1
    `, [userId]);

    if (locationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No se encontró ubicación actual del usuario'
      });
    }

    const userLocation = locationResult.rows[0];
    
    // Encontrar sucursales cercanas si no se especificaron
    let targetSucursales = sucursales;
    
    if (!targetSucursales || targetSucursales.length === 0) {
      const nearbyResult = await db.query(`
        SELECT 
          id,
          location_name,
          latitude,
          longitude,
          (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
           cos(radians(longitude) - radians($2)) + sin(radians($1)) * 
           sin(radians(latitude)))) AS distance_km
        FROM geofences
        WHERE active = true
        ORDER BY distance_km
        LIMIT $3
      `, [userLocation.latitude, userLocation.longitude, maxSucursales]);

      targetSucursales = nearbyResult.rows
        .filter(s => s.distance_km <= maxDistanceKm)
        .map(s => s.id);
    }

    if (targetSucursales.length === 0) {
      return res.status(404).json({
        error: 'No se encontraron sucursales cercanas'
      });
    }

    // Calcular ruta rápida
    const result = await routeEngine.calculateOptimalRoute({
      startLocation: {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      },
      sucursales: targetSucursales,
      algorithm: 'nearestNeighbor', // Más rápido
      preferences: { quickRoute: true }
    });

    res.json({
      success: true,
      route: result.route,
      metrics: result.metrics,
      userLocation: userLocation,
      sucursalesFound: targetSucursales.length,
      type: 'quick_route'
    });

  } catch (error) {
    console.error('❌ Error en /api/routes/quick:', error);
    res.status(500).json({
      error: 'Error generando ruta rápida',
      details: error.message
    });
  }
});

/**
 * GET /api/routes/saved
 * Obtener rutas guardadas
 */
router.get('/saved', async (req, res) => {
  try {
    const { userId, limit = 20, status = 'all' } = req.query;

    let query = `
      SELECT 
        cr.id,
        cr.waypoints,
        cr.metrics,
        cr.algorithm,
        cr.status,
        cr.total_sucursales,
        cr.created_at,
        tu.display_name as user_name
      FROM calculated_routes cr
      LEFT JOIN tracking_users tu ON cr.user_id = tu.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      query += ` AND cr.user_id = $${params.length}`;
    }

    if (status !== 'all') {
      params.push(status);
      query += ` AND cr.status = $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY cr.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);

    res.json({
      routes: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo rutas guardadas:', error);
    res.status(500).json({
      error: 'Error obteniendo rutas',
      details: error.message
    });
  }
});

/**
 * GET /api/routes/:routeId
 * Obtener detalles de una ruta específica
 */
router.get('/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;

    const result = await db.query(`
      SELECT 
        cr.*,
        tu.display_name as user_name,
        ro.strategy,
        ro.recommendations,
        ro.quality_score
      FROM calculated_routes cr
      LEFT JOIN tracking_users tu ON cr.user_id = tu.id
      LEFT JOIN route_optimizations ro ON cr.id = ro.base_route->>'routeId'
      WHERE cr.id = $1
    `, [routeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Ruta no encontrada'
      });
    }

    const route = result.rows[0];

    // Obtener ejecuciones de esta ruta
    const executionsResult = await db.query(`
      SELECT 
        id,
        status,
        actual_start_time,
        actual_end_time,
        efficiency_score,
        completed_waypoints
      FROM route_executions
      WHERE route_id = $1
      ORDER BY created_at DESC
    `, [routeId]);

    res.json({
      route: route,
      executions: executionsResult.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo ruta:', error);
    res.status(500).json({
      error: 'Error obteniendo ruta',
      details: error.message
    });
  }
});

/**
 * POST /api/routes/:routeId/execute
 * Iniciar ejecución de una ruta
 */
router.post('/:routeId/execute', async (req, res) => {
  try {
    const { routeId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Se requiere userId' });
    }

    // Verificar que la ruta existe
    const routeResult = await db.query(`
      SELECT id, waypoints, metrics
      FROM calculated_routes
      WHERE id = $1
    `, [routeId]);

    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }

    // Verificar que no hay una ejecución activa para este usuario
    const activeResult = await db.query(`
      SELECT id FROM route_executions
      WHERE user_id = $1 AND status IN ('pending', 'active', 'paused')
    `, [userId]);

    if (activeResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Ya tienes una ruta activa en progreso'
      });
    }

    // Crear nueva ejecución
    const executionResult = await db.query(`
      INSERT INTO route_executions (
        route_id,
        user_id,
        status,
        actual_start_time,
        created_at
      ) VALUES ($1, $2, 'active', NOW(), NOW())
      RETURNING id
    `, [routeId, userId]);

    const executionId = executionResult.rows[0].id;

    res.json({
      success: true,
      executionId: executionId,
      status: 'active',
      message: 'Ejecución de ruta iniciada',
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error iniciando ejecución:', error);
    res.status(500).json({
      error: 'Error iniciando ejecución de ruta',
      details: error.message
    });
  }
});

/**
 * POST /api/routes/execution/:executionId/update
 * Actualizar progreso de ejecución de ruta
 */
router.post('/execution/:executionId/update', async (req, res) => {
  try {
    const { executionId } = req.params;
    const {
      currentWaypointIndex,
      completedWaypoints,
      status,
      actualLocation,
      deviations,
      delays
    } = req.body;

    const updates = [];
    const params = [executionId];

    if (currentWaypointIndex !== undefined) {
      params.push(currentWaypointIndex);
      updates.push(`current_waypoint_index = $${params.length}`);
    }

    if (completedWaypoints !== undefined) {
      params.push(completedWaypoints);
      updates.push(`completed_waypoints = $${params.length}`);
    }

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      
      if (status === 'completed') {
        updates.push(`actual_end_time = NOW()`);
      }
    }

    if (deviations) {
      params.push(JSON.stringify(deviations));
      updates.push(`route_deviations = $${params.length}`);
    }

    if (delays) {
      params.push(JSON.stringify(delays));
      updates.push(`delays = $${params.length}`);
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE route_executions 
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ejecución no encontrada' });
    }

    res.json({
      success: true,
      execution: result.rows[0],
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error actualizando ejecución:', error);
    res.status(500).json({
      error: 'Error actualizando ejecución',
      details: error.message
    });
  }
});

/**
 * GET /api/routes/patterns
 * Obtener patrones de rutas aprendidos
 */
router.get('/patterns', async (req, res) => {
  try {
    const { area, limit = 10 } = req.query;

    let query = `
      SELECT 
        id,
        pattern_name,
        description,
        geographic_area,
        average_distance_km,
        average_duration_minutes,
        success_rate,
        times_used,
        last_used_at
      FROM route_patterns
      WHERE active = true
    `;
    const params = [];

    if (area) {
      params.push(area);
      query += ` AND geographic_area = $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY success_rate DESC, times_used DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);

    res.json({
      patterns: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo patrones:', error);
    res.status(500).json({
      error: 'Error obteniendo patrones de rutas',
      details: error.message
    });
  }
});

/**
 * GET /api/routes/analytics/efficiency
 * Análisis de eficiencia de rutas
 */
router.get('/analytics/efficiency', async (req, res) => {
  try {
    const { userId, days = 30, limit = 20 } = req.query;

    let query = `
      SELECT * FROM route_efficiency_analysis
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      query += ` AND user_id = $${params.length}`;
    }

    params.push(parseInt(days));
    query += ` AND route_planned_at >= NOW() - INTERVAL '1 day' * $${params.length}`;

    params.push(parseInt(limit));
    query += ` ORDER BY route_planned_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);

    // Calcular estadísticas agregadas
    const stats = {
      totalRoutes: result.rows.length,
      avgEfficiency: result.rows.reduce((sum, row) => 
        sum + (row.efficiency_percentage || 0), 0) / result.rows.length || 0,
      completedRoutes: result.rows.filter(r => r.status === 'completed').length
    };

    res.json({
      analytics: result.rows,
      statistics: stats,
      period: `${days} días`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en análisis de eficiencia:', error);
    res.status(500).json({
      error: 'Error en análisis de eficiencia',
      details: error.message
    });
  }
});

/**
 * POST /api/routes/feedback
 * Registrar feedback del usuario sobre una ruta
 */
router.post('/feedback', async (req, res) => {
  try {
    const {
      routeId,
      executionId,
      rating,
      notes,
      suggestions
    } = req.body;

    if (!routeId || !rating) {
      return res.status(400).json({
        error: 'Se requiere routeId y rating'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating debe ser entre 1 y 5'
      });
    }

    // Actualizar el rating en la optimización si existe
    await db.query(`
      UPDATE route_optimizations 
      SET user_feedback = $1, user_notes = $2
      WHERE base_route->>'routeId' = $3
    `, [rating, notes, routeId.toString()]);

    // Actualizar ejecución si se proporciona
    if (executionId) {
      await db.query(`
        UPDATE route_executions
        SET user_notes = $1
        WHERE id = $2
      `, [notes, executionId]);
    }

    res.json({
      success: true,
      message: 'Feedback registrado correctamente',
      rating: rating,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error registrando feedback:', error);
    res.status(500).json({
      error: 'Error registrando feedback',
      details: error.message
    });
  }
});

module.exports = router;