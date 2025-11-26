const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * ENDPOINT FRESCO SIN CACHE - COORDENADAS DIRECTAS DEL CSV
 * Ruta: /api/fresh-coordinates
 * Purpose: Bypass cualquier cache y mostrar coordenadas correctas
 */

/**
 * GET /api/fresh-coordinates/geofences
 * Coordenadas frescas directas de la base de datos
 */
router.get('/geofences', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Header para prevenir cache
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Fresh-Coordinates': 'true',
      'X-Timestamp': new Date().toISOString()
    });
    
    console.log(`🆕 FRESH COORDINATES REQUEST: ${new Date().toISOString()}`);
    
    // Query DIRECTA sin cache - fuerza nueva conexión
    const result = await db.query(`
      SELECT 
        g.id,
        CONCAT('224700', CASE WHEN b.branch_number < 10 THEN '0' ELSE '' END, b.branch_number::TEXT) as location_code,
        CONCAT(b.branch_number, ' - ', b.name) as location_name,
        COALESCE(b.group_name, 'Sin Grupo') as grupo,
        g.center_lat::DECIMAL(15,12) as latitude,
        g.center_lng::DECIMAL(15,12) as longitude,
        g.radius_meters,
        g.active,
        g.created_at,
        g.updated_at,
        b.branch_number,
        NOW() as query_timestamp
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.active = true AND g.active = true
      ORDER BY b.branch_number
    `);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ FRESH COORDINATES: ${result.rows.length} geofences, ${responseTime}ms`);
    
    // Log específico para Pino Suarez
    const pinoSuarez = result.rows.find(r => r.location_name.includes('Pino Suarez'));
    if (pinoSuarez) {
      console.log(`📍 FRESH Pino Suarez: ${pinoSuarez.latitude}, ${pinoSuarez.longitude}`);
    }
    
    res.json({
      success: true,
      source: 'FRESH_COORDINATES_NO_CACHE',
      geofences: result.rows.map(row => ({
        id: row.id,
        location_code: row.location_code,
        location_name: row.location_name,
        grupo: row.grupo,
        latitude: row.latitude.toString(),
        longitude: row.longitude.toString(),
        radius_meters: row.radius_meters,
        active: row.active,
        created_at: row.created_at
      })),
      meta: {
        count: result.rows.length,
        generated_at: new Date().toISOString(),
        response_time_ms: responseTime,
        query_timestamp: result.rows[0]?.query_timestamp,
        cache_disabled: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error en fresh coordinates:', error.message);
    res.status(500).json({
      success: false,
      source: 'FRESH_COORDINATES_ERROR',
      error: 'Error obteniendo coordenadas frescas',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/fresh-coordinates/test
 * Test específico de coordenadas problemáticas
 */
router.get('/test', async (req, res) => {
  try {
    console.log(`🧪 FRESH TEST REQUEST: ${new Date().toISOString()}`);
    
    // Coordenadas específicas que Roberto quiere verificar
    const testBranches = [
      'Pino Suarez',
      'Cadereyta', 
      'Huasteca',
      'Gomez Morin',
      'Anahuac'
    ];
    
    const results = [];
    
    for (const branchName of testBranches) {
      const result = await db.query(`
        SELECT 
          b.branch_number, b.name, 
          b.latitude as branch_lat, b.longitude as branch_lng,
          g.center_lat as geofence_lat, g.center_lng as geofence_lng,
          g.created_at, b.city, b.state
        FROM branches b
        LEFT JOIN geofences g ON g.branch_id = b.id
        WHERE b.active = true AND b.name ILIKE $1
        ORDER BY b.branch_number
      `, [`%${branchName}%`]);
      
      if (result.rows.length > 0) {
        results.push(...result.rows);
      }
    }
    
    res.json({
      success: true,
      source: 'FRESH_TEST_NO_CACHE',
      test_branches: results.map(row => ({
        branch_number: row.branch_number,
        name: row.name,
        city: row.city,
        state: row.state,
        branch_coordinates: `${parseFloat(row.branch_lat).toFixed(8)}, ${parseFloat(row.branch_lng).toFixed(8)}`,
        geofence_coordinates: row.geofence_lat ? `${parseFloat(row.geofence_lat).toFixed(8)}, ${parseFloat(row.geofence_lng).toFixed(8)}` : 'No geofence',
        coordinates_match: row.geofence_lat ? 
          (Math.abs(parseFloat(row.branch_lat) - parseFloat(row.geofence_lat)) < 0.000001 && 
           Math.abs(parseFloat(row.branch_lng) - parseFloat(row.geofence_lng)) < 0.000001) : false,
        created_at: row.created_at
      })),
      meta: {
        count: results.length,
        generated_at: new Date().toISOString(),
        cache_disabled: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error en fresh test:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;