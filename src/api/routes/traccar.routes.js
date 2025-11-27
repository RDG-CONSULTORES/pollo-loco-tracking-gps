/**
 * TRACCAR INTEGRATION ROUTES
 * Endpoints compatibles con protocolo Traccar Client/Manager
 * Compatible con OwnTracks existente - Sistema dual
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * POST /?id=device_id
 * Endpoint compatible con Traccar Client (Osmand format)
 * Recibe GPS de Traccar Client apps (Android/iOS)
 */
router.post('/', async (req, res) => {
  try {
    console.log('📡 TRACCAR: Datos recibidos:', req.body, req.query);
    
    const { 
      lat, lon, timestamp, speed, bearing, altitude, accuracy,
      battery, charge, location, provider
    } = req.body;
    
    const { id: deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({ 
        error: 'Device ID requerido en query ?id=device_id' 
      });
    }
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Latitud y longitud requeridas' 
      });
    }
    
    // Buscar usuario por device_id (puede ser tracker_id)
    const userQuery = await db.query(`
      SELECT id, tracker_id, display_name, role
      FROM tracking_users 
      WHERE tracker_id = $1 OR (CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::integer ELSE false END)
    `, [deviceId]);
    
    if (userQuery.rows.length === 0) {
      console.log(`⚠️ Usuario no encontrado: ${deviceId}`);
      return res.status(404).json({ 
        error: `Device ${deviceId} no registrado` 
      });
    }
    
    const user = userQuery.rows[0];
    
    // Guardar en gps_locations (misma tabla que OwnTracks)
    const locationData = {
      user_id: user.id,
      tracker_id: deviceId, // Mantener ID original
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      accuracy: parseFloat(accuracy) || 10,
      battery_level: parseInt(battery) || 100,
      velocity: parseFloat(speed) || 0,
      altitude: parseFloat(altitude) || 0,
      heading: parseFloat(bearing) || 0,
      gps_timestamp: timestamp ? new Date(timestamp * 1000) : new Date(),
      protocol: 'traccar' // Distinguir protocolo
    };
    
    const insertResult = await db.query(`
      INSERT INTO gps_locations (
        user_id, latitude, longitude, accuracy, 
        battery_level, timestamp, protocol, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      locationData.user_id,
      locationData.latitude,
      locationData.longitude,
      locationData.accuracy,
      locationData.battery_level,
      locationData.gps_timestamp,
      locationData.protocol
    ]);
    
    console.log(`✅ TRACCAR: Ubicación guardada para ${user.display_name} (${deviceId})`);
    
    // Procesar con geofence engine (mismo que OwnTracks)
    try {
      const geofenceEngine = require('../../services/geofence-engine');
      
      const events = await geofenceEngine.processLocation({
        id: insertResult.rows[0].id,
        user_id: user.id,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        battery: locationData.battery_level,
        velocity: locationData.velocity,
        gps_timestamp: locationData.gps_timestamp,
        protocol: 'traccar'
      });
      
      if (events.length > 0) {
        console.log(`🎯 TRACCAR: ${events.length} eventos generados para ${user.display_name}`);
      }
      
    } catch (geofenceError) {
      console.error('❌ Error procesando geofences:', geofenceError.message);
    }
    
    // Respuesta compatible con Traccar
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error en endpoint Traccar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /?id=device_id
 * Endpoint para verificar configuración (usado por Traccar Manager)
 */
router.get('/', async (req, res) => {
  try {
    const { id: deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({ 
        error: 'Device ID requerido en query ?id=device_id' 
      });
    }
    
    // Verificar si el device existe
    const userQuery = await db.query(`
      SELECT id, tracker_id, display_name, role, active, created_at
      FROM tracking_users 
      WHERE tracker_id = $1 OR (CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::integer ELSE false END)
    `, [deviceId]);
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ 
        error: `Device ${deviceId} no encontrado` 
      });
    }
    
    const user = userQuery.rows[0];
    
    // Obtener última ubicación
    const lastLocation = await db.query(`
      SELECT latitude, longitude, gps_timestamp, battery_level, accuracy
      FROM gps_locations 
      WHERE user_id = $1 
      ORDER BY gps_timestamp DESC 
      LIMIT 1
    `, [user.id]);
    
    res.json({
      success: true,
      device: {
        id: deviceId,
        name: user.display_name,
        status: user.active ? 'active' : 'inactive',
        protocol: 'traccar',
        lastUpdate: lastLocation.rows.length > 0 ? lastLocation.rows[0].gps_timestamp : null,
        lastPosition: lastLocation.rows.length > 0 ? {
          latitude: lastLocation.rows[0].latitude,
          longitude: lastLocation.rows[0].longitude,
          accuracy: lastLocation.rows[0].accuracy,
          battery: lastLocation.rows[0].battery_level
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error verificando device Traccar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;