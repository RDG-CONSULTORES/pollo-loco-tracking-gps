const db = require('../config/database');
const geofenceManager = require('./geofence-manager');
const timeFilters = require('../utils/time-filters');
const { isValidCoordinate, isValidAccuracy } = require('../config/constants');

/**
 * Procesador principal de ubicaciones GPS
 */
class LocationProcessor {
  
  /**
   * Procesar ubicación recibida de OwnTracks
   */
  async processLocation(payload) {
    try {
      const {
        tid,      // Tracker ID
        lat,      // Latitud
        lon,      // Longitud
        tst,      // Timestamp Unix
        acc,      // Precisión
        batt,     // Batería
        vel,      // Velocidad
        cog,      // Dirección
        alt,      // Altitud
        _type     // Tipo de mensaje OwnTracks
      } = payload;
      
      console.log(`📍 Procesando ubicación: ${tid} @ ${lat}, ${lon}`);
      
      // 1. Validaciones básicas
      const validationResult = await this.validateLocation(payload);
      if (!validationResult.valid) {
        return { 
          processed: false, 
          skipped: true, 
          reason: validationResult.reason 
        };
      }
      
      // 2. Convertir timestamp
      const gpsTimestamp = new Date(tst * 1000);
      
      // 3. Obtener usuario
      const user = await this.getUserByTrackerId(tid);
      if (!user) {
        console.log(`❌ Usuario no encontrado: ${tid}`);
        return { 
          processed: false, 
          skipped: true, 
          reason: 'user_not_found' 
        };
      }
      
      // 4. Validar que usuario esté activo
      if (!user.active) {
        console.log(`⏸️ Usuario pausado: ${tid} (${user.display_name})`);
        return { 
          processed: false, 
          skipped: true, 
          reason: 'user_paused' 
        };
      }
      
      // 5. Verificar horario laboral
      if (!timeFilters.isWorkingHours(gpsTimestamp)) {
        console.log(`⏰ Fuera de horario laboral: ${gpsTimestamp.toISOString()}`);
        return { 
          processed: false, 
          skipped: true, 
          reason: 'outside_working_hours' 
        };
      }
      
      // 6. Validar precisión GPS
      const accuracyThreshold = await db.getConfig('gps_accuracy_threshold', 100);
      if (acc && acc > parseInt(accuracyThreshold)) {
        console.log(`📍 Precisión muy baja: ${acc}m (threshold: ${accuracyThreshold}m)`);
        return { 
          processed: false, 
          skipped: true, 
          reason: 'low_accuracy' 
        };
      }
      
      // 7. Verificar si sistema está activo
      const systemActive = await db.getConfig('system_active', 'true');
      if (systemActive !== 'true') {
        console.log('⏸️ Sistema pausado globalmente');
        return { 
          processed: false, 
          skipped: true, 
          reason: 'system_paused' 
        };
      }
      
      // 8. Evitar ubicaciones duplicadas recientes
      const isDuplicate = await this.checkDuplicateLocation(user.id, lat, lon, gpsTimestamp);
      if (isDuplicate) {
        console.log(`🔄 Ubicación duplicada ignorada: ${tid}`);
        return { 
          processed: false, 
          skipped: true, 
          reason: 'duplicate_location' 
        };
      }
      
      // 9. Guardar ubicación en BD
      const savedLocation = await this.saveLocation({
        tracker_id: tid,   // Pasar tracker_id string
        user_id: user.id,  // Use database ID instead of tracker_id string
        lat,
        lon,
        acc,
        alt,
        batt,
        vel,
        cog,
        gpsTimestamp,
        payload
      });
      
      if (!savedLocation) {
        console.error(`❌ Error guardando ubicación: ${tid}`);
        return { 
          processed: false, 
          error: 'database_save_failed' 
        };
      }
      
      console.log(`✅ Ubicación guardada: ${tid} @ ${lat}, ${lon} (${user.display_name})`);
      
      // 10. Procesar geofencing - detectar entradas/salidas de sucursales
      const geofenceEngine = require('./geofence-engine');
      const geofenceEvents = await geofenceEngine.processLocation({
        id: savedLocation.id,
        user_id: user.id,
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        battery: batt,
        gps_timestamp: gpsTimestamp
      });
      
      if (geofenceEvents.length > 0) {
        console.log(`🎯 Geofence events detected: ${geofenceEvents.map(e => `${e.event_type} ${e.location_code}`).join(', ')}`);
        
        // Enviar alertas Telegram para eventos geofence
        const geofenceAlerts = require('./geofence-alerts');
        await geofenceAlerts.checkGeofenceAlerts({
          user_id: user.id,
          latitude: lat,
          longitude: lon,
          gps_timestamp: gpsTimestamp
        });
        
        // Enviar eventos de geofencing a clientes WebSocket
        const websocketManager = require('./websocket-manager');
        geofenceEvents.forEach(event => {
          websocketManager.broadcastGeofenceEvent(event);
        });
      }
      
      // Broadcast location update a clientes WebSocket
      const websocketManager = require('./websocket-manager');
      websocketManager.broadcastLocationUpdate({
        id: savedLocation.id,
        user_id: user.id,
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        battery: batt,
        velocity: vel,
        gps_timestamp: gpsTimestamp
      }, user);
      
      // 11. Procesar tracking adaptativo - optimizar configuración automáticamente
      const adaptiveTracking = require('./adaptive-tracking');
      const adaptationResult = await adaptiveTracking.processLocationForAdaptation({
        id: savedLocation.id,
        user_id: user.id,
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        battery: batt,
        velocity: vel,
        gps_timestamp: gpsTimestamp
      });
      
      if (adaptationResult.adapted) {
        console.log(`🧠 Configuration adapted for ${tid}: ${adaptationResult.reason} → ${adaptationResult.newProfile}`);
      }
      
      return { 
        processed: true,
        location_id: savedLocation.id,
        user: user.display_name
      };
      
    } catch (error) {
      console.error('❌ Error procesando ubicación:', error.message);
      return { 
        processed: false, 
        error: error.message 
      };
    }
  }
  
  /**
   * Validar payload de ubicación
   */
  async validateLocation(payload) {
    const { tid, lat, lon, tst, _type } = payload;
    
    // Verificar campos requeridos
    if (!tid) {
      return { valid: false, reason: 'missing_tracker_id' };
    }
    
    if (lat === undefined || lon === undefined) {
      return { valid: false, reason: 'missing_coordinates' };
    }
    
    if (!tst) {
      return { valid: false, reason: 'missing_timestamp' };
    }
    
    // Validar tipo de mensaje OwnTracks
    if (_type && _type !== 'location') {
      return { valid: false, reason: 'invalid_message_type' };
    }
    
    // Validar coordenadas
    if (!isValidCoordinate(lat, lon)) {
      console.log(`❌ Coordenadas inválidas: ${lat}, ${lon}`);
      return { valid: false, reason: 'invalid_coordinates' };
    }
    
    // Validar timestamp
    const timestamp = new Date(tst * 1000);
    const now = new Date();
    const maxAge = 2 * 60 * 60 * 1000; // 2 horas
    
    if (timestamp > now) {
      return { valid: false, reason: 'future_timestamp' };
    }
    
    if ((now - timestamp) > maxAge) {
      return { valid: false, reason: 'timestamp_too_old' };
    }
    
    return { valid: true };
  }
  
  /**
   * Obtener usuario por tracker ID
   */
  async getUserByTrackerId(trackerId) {
    try {
      const result = await db.query(
        'SELECT * FROM tracking_users WHERE tracker_id = $1',
        [trackerId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error(`❌ Error obteniendo usuario ${trackerId}:`, error.message);
      return null;
    }
  }
  
  /**
   * Verificar ubicaciones duplicadas recientes
   */
  async checkDuplicateLocation(userId, lat, lon, timestamp) {
    try {
      const result = await db.query(`
        SELECT id FROM gps_locations 
        WHERE user_id = $1
          AND latitude = $2
          AND longitude = $3
          AND gps_timestamp >= $4
        LIMIT 1
      `, [userId, lat, lon, new Date(timestamp.getTime() - 5 * 60 * 1000)]); // 5 minutos
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Error verificando duplicados:', error.message);
      return false;
    }
  }
  
  /**
   * Guardar ubicación en base de datos
   */
  async saveLocation(data) {
    try {
      // 1. Guardar ubicación GPS
      const result = await db.query(`
        INSERT INTO gps_locations 
        (tracker_id, user_id, latitude, longitude, accuracy, altitude, 
         heading, speed, timestamp, battery_level, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `, [
        this.generateUUIDFromTrackerId(data.tracker_id),  // Convertir tracker_id a UUID válido
        data.user_id,
        data.lat,
        data.lon,
        data.acc,
        data.alt,
        data.cog,      // heading
        data.vel,      // speed
        data.gpsTimestamp,  // timestamp
        data.batt      // battery_level
      ]);
      
      // 2. Actualizar estado del usuario en tracking_users
      await db.query(`
        UPDATE tracking_users 
        SET 
          last_location_time = $1,
          last_battery_level = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [
        data.gpsTimestamp,
        data.batt || null,
        data.user_id
      ]);
      
      console.log(`📱 Usuario actualizado: last_location_time=${data.gpsTimestamp}, battery=${data.batt}%`);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error guardando ubicación:', error.message);
      console.error('❌ Full error details:', error);
      return null;
    }
  }
  
  /**
   * Obtener ubicaciones actuales de todos los usuarios
   */
  async getCurrentLocations() {
    try {
      const result = await db.query(`
        SELECT * FROM v_tracking_current_locations
        ORDER BY minutes_ago ASC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo ubicaciones actuales:', error.message);
      return [];
    }
  }
  
  /**
   * Limpiar ubicaciones antiguas
   */
  async cleanupOldLocations(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const result = await db.query(`
        DELETE FROM tracking_locations 
        WHERE gps_timestamp < $1
      `, [cutoffDate]);
      
      console.log(`🧹 Ubicaciones limpiadas: ${result.rowCount} registros eliminados`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Error limpiando ubicaciones:', error.message);
      return 0;
    }
  }
  
  /**
   * Generar UUID consistente desde tracker_id string
   * Esto asegura que "RD01" siempre genere el mismo UUID
   */
  generateUUIDFromTrackerId(trackerId) {
    const crypto = require('crypto');
    // Crear hash MD5 del tracker_id y convertirlo a formato UUID válido
    const hash = crypto.createHash('md5').update(trackerId).digest('hex');
    // Formatear como UUID: 8-4-4-4-12 caracteres
    return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  }
}

module.exports = new LocationProcessor();