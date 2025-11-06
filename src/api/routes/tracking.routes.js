const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const locationProcessor = require('../../services/location-processor');
const visitDetector = require('../../services/visit-detector');

/**
 * GET /api/tracking/locations/current
 * Ubicaciones actuales de todos los usuarios
 */
router.get('/locations/current', async (req, res) => {
  try {
    const locations = await locationProcessor.getCurrentLocations();
    
    res.json({
      status: 'success',
      count: locations.length,
      locations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo ubicaciones actuales:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * GET /api/tracking/visits/today
 * Visitas del día actual
 */
router.get('/visits/today', async (req, res) => {
  try {
    const { tracker_id } = req.query;
    
    const visits = await visitDetector.getTodayVisits(tracker_id);
    
    res.json({
      status: 'success',
      count: visits.length,
      visits,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo visitas del día:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * GET /api/tracking/visits/date/:date
 * Visitas de una fecha específica (YYYY-MM-DD)
 */
router.get('/visits/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { tracker_id } = req.query;
    
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        status: 'error',
        error: 'Formato de fecha inválido. Use YYYY-MM-DD'
      });
    }
    
    let query = `
      SELECT 
        v.*,
        lc.name as location_name,
        lc.group_name,
        tu.display_name as supervisor_name
      FROM tracking_visits v
      LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code
      LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
      WHERE DATE(v.entrada_at) = $1
    `;
    
    const params = [date];
    
    if (tracker_id) {
      query += ' AND v.tracker_id = $2';
      params.push(tracker_id);
    }
    
    query += ' ORDER BY v.entrada_at DESC';
    
    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      count: result.rows.length,
      visits: result.rows,
      date,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo visitas por fecha:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * GET /api/tracking/stats/daily
 * Estadísticas diarias
 */
router.get('/stats/daily', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const stats = await getDailyStats(date);
    
    res.json({
      status: 'success',
      stats,
      date,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas diarias:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * GET /api/tracking/coverage
 * Cobertura de sucursales
 */
router.get('/coverage', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const coverage = await getCoverage(date);
    
    res.json({
      status: 'success',
      coverage,
      date,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo cobertura:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * GET /api/tracking/users/:tracker_id/history
 * Historial de ubicaciones de un usuario
 */
router.get('/users/:tracker_id/history', async (req, res) => {
  try {
    const { tracker_id } = req.params;
    const { date = new Date().toISOString().split('T')[0], limit = 100 } = req.query;
    
    const result = await db.query(`
      SELECT 
        latitude,
        longitude,
        accuracy,
        battery,
        velocity,
        gps_timestamp,
        EXTRACT(EPOCH FROM (NOW() - gps_timestamp))/60 as minutes_ago
      FROM tracking_locations
      WHERE tracker_id = $1
        AND DATE(gps_timestamp) = $2
      ORDER BY gps_timestamp DESC
      LIMIT $3
    `, [tracker_id, date, parseInt(limit)]);
    
    res.json({
      status: 'success',
      tracker_id,
      count: result.rows.length,
      locations: result.rows,
      date,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo historial de usuario:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * GET /api/tracking/locations/:location_code/visitors
 * Visitantes de una sucursal específica
 */
router.get('/locations/:location_code/visitors', async (req, res) => {
  try {
    const { location_code } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const result = await db.query(`
      SELECT 
        v.tracker_id,
        tu.display_name as supervisor_name,
        v.entrada_at,
        v.salida_at,
        v.duracion_minutos,
        v.visit_type,
        lc.name as location_name
      FROM tracking_visits v
      LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
      LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code
      WHERE v.location_code = $1
        AND DATE(v.entrada_at) = $2
        AND v.is_valid = true
      ORDER BY v.entrada_at DESC
    `, [location_code, date]);
    
    res.json({
      status: 'success',
      location_code,
      count: result.rows.length,
      visitors: result.rows,
      date,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo visitantes:', error.message);
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

/**
 * Obtener estadísticas diarias
 */
async function getDailyStats(date) {
  const result = await db.query(`
    SELECT 
      COUNT(DISTINCT v.tracker_id) as supervisores_activos,
      COUNT(DISTINCT v.location_code) as sucursales_visitadas,
      COUNT(*) as total_visitas,
      COUNT(*) FILTER (WHERE v.salida_at IS NOT NULL) as visitas_completadas,
      COUNT(*) FILTER (WHERE v.salida_at IS NULL) as visitas_abiertas,
      ROUND(AVG(v.duracion_minutos)::numeric, 0) as duracion_promedio,
      SUM(v.duracion_minutos) as tiempo_total_min,
      COUNT(*) FILTER (WHERE v.duracion_minutos < 30) as visitas_cortas,
      COUNT(*) FILTER (WHERE v.duracion_minutos BETWEEN 30 AND 90) as visitas_normales,
      COUNT(*) FILTER (WHERE v.duracion_minutos > 90) as visitas_largas
    FROM tracking_visits v
    WHERE DATE(v.entrada_at) = $1
      AND v.is_valid = true
  `, [date]);
  
  const stats = result.rows[0];
  
  // Calcular cobertura
  const coverageResult = await db.query(`
    SELECT COUNT(*) as total_sucursales
    FROM tracking_locations_cache
    WHERE active = true
  `);
  
  const totalSucursales = parseInt(coverageResult.rows[0].total_sucursales);
  stats.cobertura_porcentaje = totalSucursales > 0 ? 
    Math.round((stats.sucursales_visitadas / totalSucursales) * 100) : 0;
  
  // Convertir números
  Object.keys(stats).forEach(key => {
    if (stats[key] !== null && !isNaN(stats[key])) {
      stats[key] = parseInt(stats[key]);
    }
  });
  
  return stats;
}

/**
 * Obtener cobertura detallada
 */
async function getCoverage(date) {
  // Sucursales visitadas
  const visitedResult = await db.query(`
    SELECT DISTINCT
      lc.location_code,
      lc.name,
      lc.group_name,
      COUNT(v.id) as visitas,
      COUNT(DISTINCT v.tracker_id) as supervisores
    FROM tracking_locations_cache lc
    INNER JOIN tracking_visits v ON lc.location_code = v.location_code
    WHERE DATE(v.entrada_at) = $1
      AND v.is_valid = true
    GROUP BY lc.location_code, lc.name, lc.group_name
    ORDER BY visitas DESC
  `, [date]);
  
  // Sucursales no visitadas
  const notVisitedResult = await db.query(`
    SELECT 
      location_code,
      name,
      group_name
    FROM tracking_locations_cache
    WHERE active = true
      AND location_code NOT IN (
        SELECT DISTINCT location_code 
        FROM tracking_visits 
        WHERE DATE(entrada_at) = $1
      )
    ORDER BY name
  `, [date]);
  
  return {
    visited: visitedResult.rows,
    not_visited: notVisitedResult.rows,
    summary: {
      total_locations: visitedResult.rows.length + notVisitedResult.rows.length,
      visited_count: visitedResult.rows.length,
      not_visited_count: notVisitedResult.rows.length,
      coverage_percentage: Math.round(
        (visitedResult.rows.length / (visitedResult.rows.length + notVisitedResult.rows.length)) * 100
      )
    }
  };
}

module.exports = router;