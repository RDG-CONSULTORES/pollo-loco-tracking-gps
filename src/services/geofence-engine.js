const db = require('../config/database');

/**
 * Motor de Geofencing para Pollo Loco GPS Tracking
 * Detecta entradas y salidas de sucursales automáticamente
 */
class GeofenceEngine {
  constructor() {
    this.config = {
      enabled: true,
      defaultRadius: 150, // metros
      maxSearchRadius: 200, // metros para buscar geofences cercanos
      telegramAlerts: true
    };
    
    // Cache para optimizar consultas
    this.geofencesCache = new Map();
    this.userStateCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheExpiryMs = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Procesar nueva ubicación GPS y detectar eventos de geofencing
   * @param {Object} locationData - Datos de ubicación GPS
   * @returns {Promise<Array>} - Array de eventos detectados
   */
  async processLocation(locationData) {
    try {
      console.log(`📍 [GEOFENCE] Processing location for user ${locationData.user_id}`);
      
      // Verificar si el geofencing está habilitado
      if (!await this.isGeofencingEnabled()) {
        console.log('⏸️ [GEOFENCE] Geofencing disabled, skipping...');
        return [];
      }

      const events = [];
      
      // 1. Obtener geofences cercanos
      const nearbyGeofences = await this.getNearbyGeofences(
        locationData.latitude, 
        locationData.longitude
      );
      
      console.log(`🔍 [GEOFENCE] Found ${nearbyGeofences.length} nearby geofences`);
      
      // 2. Procesar cada geofence
      for (const geofence of nearbyGeofences) {
        const event = await this.processGeofence(locationData, geofence);
        if (event) {
          events.push(event);
        }
      }
      
      console.log(`⚡ [GEOFENCE] Generated ${events.length} events`);
      return events;
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error processing location:', error);
      return [];
    }
  }

  /**
   * Procesar un geofence específico para detectar entrada/salida
   * @param {Object} locationData - Datos GPS del usuario
   * @param {Object} geofence - Datos del geofence
   * @returns {Promise<Object|null>} - Evento detectado o null
   */
  async processGeofence(locationData, geofence) {
    try {
      const userId = locationData.user_id;
      const locationCode = geofence.location_code;
      const distance = geofence.distance_meters;
      const isInside = geofence.is_inside;
      
      // Obtener estado actual del usuario en este geofence
      const currentState = await this.getUserGeofenceState(userId, locationCode);
      const wasInside = currentState ? currentState.is_inside : false;
      
      console.log(`🎯 [GEOFENCE] User ${userId} at ${geofence.store_name}: distance=${Math.round(distance)}m, was_inside=${wasInside}, is_inside=${isInside}`);
      
      // Detectar evento
      let eventType = null;
      
      if (!wasInside && isInside) {
        eventType = 'enter';
        console.log(`🟢 [GEOFENCE] ENTER detected: User ${userId} entered ${geofence.store_name}`);
      } else if (wasInside && !isInside) {
        eventType = 'exit';
        console.log(`🔴 [GEOFENCE] EXIT detected: User ${userId} exited ${geofence.store_name}`);
      }
      
      if (!eventType) {
        // No hay cambio de estado, solo actualizar timestamp si está dentro
        if (isInside && wasInside) {
          await this.updateUserState(userId, locationCode, true, null);
        }
        return null;
      }
      
      // Crear evento en la base de datos
      const event = await this.createGeofenceEvent({
        user_id: userId,
        location_code: locationCode,
        event_type: eventType,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        distance_from_center: distance,
        accuracy_meters: locationData.accuracy,
        battery_percentage: locationData.battery,
        raw_location_id: null // Set to null to avoid foreign key issues
      });
      
      // Actualizar estado del usuario
      await this.updateUserState(userId, locationCode, isInside, event.id);
      
      // Programar envío de alerta Telegram
      if (await this.isTelegramAlertsEnabled()) {
        this.scheduleTeleg(event, geofence).catch(err => {
          console.error('❌ [GEOFENCE] Error scheduling telegram alert:', err);
        });
      }
      
      return event;
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error processing geofence:', error);
      return null;
    }
  }

  /**
   * Obtener geofences cercanos a una ubicación
   * @param {number} latitude - Latitud
   * @param {number} longitude - Longitud  
   * @returns {Promise<Array>} - Array de geofences cercanos
   */
  async getNearbyGeofences(latitude, longitude) {
    try {
      const result = await db.query(`
        SELECT * FROM get_nearby_geofences($1, $2, $3)
      `, [latitude, longitude, this.config.maxSearchRadius]);
      
      return result.rows;
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error getting nearby geofences:', error);
      return [];
    }
  }

  /**
   * Obtener estado actual del usuario en un geofence
   * @param {number} userId - ID del usuario
   * @param {string} locationCode - Código de la sucursal
   * @returns {Promise<Object|null>} - Estado del usuario
   */
  async getUserGeofenceState(userId, locationCode) {
    try {
      const result = await db.query(`
        SELECT * FROM user_sucursal_state 
        WHERE user_id = $1 AND location_code = $2
      `, [userId, locationCode]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error getting user state:', error);
      return null;
    }
  }

  /**
   * Crear evento de geofencing en la base de datos
   * @param {Object} eventData - Datos del evento
   * @returns {Promise<Object>} - Evento creado
   */
  async createGeofenceEvent(eventData) {
    try {
      const result = await db.query(`
        INSERT INTO geofence_events (
          user_id, location_code, event_type, latitude, longitude,
          distance_from_center, accuracy_meters, battery_percentage,
          raw_location_id, event_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `, [
        eventData.user_id,
        eventData.location_code, 
        eventData.event_type,
        eventData.latitude,
        eventData.longitude,
        eventData.distance_from_center,
        eventData.accuracy_meters,
        eventData.battery_percentage,
        eventData.raw_location_id
      ]);
      
      const event = result.rows[0];
      console.log(`✅ [GEOFENCE] Event created: ${event.event_type} - ID ${event.id}`);
      
      return event;
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error creating event:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado del usuario en geofence
   * @param {number} userId - ID del usuario
   * @param {string} locationCode - Código de sucursal
   * @param {boolean} isInside - Si está dentro o fuera
   * @param {number} eventId - ID del último evento
   */
  async updateUserState(userId, locationCode, isInside, eventId) {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;
      
      updateFields.push(`is_inside = $${paramIndex++}`);
      values.push(isInside);
      
      if (isInside && eventId) {
        updateFields.push(`last_enter_event_id = $${paramIndex++}`);
        updateFields.push(`last_enter_time = NOW()`);
        values.push(eventId);
      } else if (!isInside && eventId) {
        updateFields.push(`last_exit_event_id = $${paramIndex++}`);
        updateFields.push(`last_exit_time = NOW()`);
        values.push(eventId);
      }
      
      updateFields.push(`updated_at = NOW()`);
      
      values.push(userId, locationCode);
      
      const result = await db.query(`
        INSERT INTO user_sucursal_state (user_id, location_code, is_inside, ${isInside ? 'last_enter_event_id, last_enter_time' : 'last_exit_event_id, last_exit_time'})
        VALUES ($${values.length - 1}, $${values.length}, $1, ${isInside ? `$2, NOW()` : `$2, NOW()`})
        ON CONFLICT (user_id, location_code)
        DO UPDATE SET ${updateFields.join(', ')}
      `, values);
      
      console.log(`📊 [GEOFENCE] User state updated: ${userId} ${isInside ? 'inside' : 'outside'} ${locationCode}`);
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error updating user state:', error);
    }
  }

  /**
   * Programar envío de alerta por Telegram
   * @param {Object} event - Evento de geofencing
   * @param {Object} geofence - Datos del geofence
   */
  async scheduleTeleg(event, geofence) {
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const GeofenceAlerts = require('../telegram/services/geofence-alerts');
      const geofenceAlerts = new GeofenceAlerts();
      
      // Obtener datos del usuario
      const userResult = await db.query(`
        SELECT * FROM tracking_users WHERE id = $1
      `, [event.user_id]);
      
      if (userResult.rows.length === 0) {
        console.error('❌ [GEOFENCE] User not found for telegram alert:', event.user_id);
        return;
      }
      
      const user = userResult.rows[0];
      
      // Enviar alerta
      await geofenceAlerts.sendAlert(event, user, geofence);
      
      // Marcar como enviado
      await db.query(`
        UPDATE geofence_events 
        SET telegram_sent = true, telegram_sent_at = NOW()
        WHERE id = $1
      `, [event.id]);
      
      console.log(`📱 [GEOFENCE] Telegram alert sent for event ${event.id}`);
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error sending telegram alert:', error);
      
      // Marcar error en la base de datos
      await db.query(`
        UPDATE geofence_events 
        SET telegram_error = $1
        WHERE id = $2
      `, [error.message, event.id]).catch(() => {});
    }
  }

  /**
   * Verificar si el geofencing está habilitado
   * @returns {Promise<boolean>}
   */
  async isGeofencingEnabled() {
    try {
      const enabled = await db.getConfig('geofencing_enabled', 'true');
      return enabled === 'true';
    } catch (error) {
      console.error('❌ [GEOFENCE] Error checking if enabled:', error);
      return true; // Default enabled
    }
  }

  /**
   * Verificar si las alertas de Telegram están habilitadas
   * @returns {Promise<boolean>}
   */
  async isTelegramAlertsEnabled() {
    try {
      const enabled = await db.getConfig('geofence_telegram_alerts', 'true');
      return enabled === 'true';
    } catch (error) {
      console.error('❌ [GEOFENCE] Error checking telegram alerts:', error);
      return true; // Default enabled
    }
  }

  /**
   * Obtener estadísticas de geofencing
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE event_type = 'enter') as entries,
          COUNT(*) FILTER (WHERE event_type = 'exit') as exits,
          COUNT(*) FILTER (WHERE DATE(event_timestamp) = CURRENT_DATE) as today_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT location_code) as unique_locations
        FROM geofence_events
        WHERE event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
      `);
      
      const activeUsers = await db.query(`
        SELECT COUNT(*) as count
        FROM user_sucursal_state uss
        INNER JOIN tracking_users tu ON uss.user_id = tu.id
        WHERE uss.is_inside = true AND tu.active = true
      `);
      
      return {
        ...result.rows[0],
        users_currently_inside: activeUsers.rows[0].count,
        last_updated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error getting stats:', error);
      return {};
    }
  }

  /**
   * Limpiar eventos antiguos (mantenimiento)
   * @param {number} daysToKeep - Días de eventos a mantener
   * @returns {Promise<number>} - Cantidad de eventos eliminados
   */
  async cleanupOldEvents(daysToKeep = 30) {
    try {
      const result = await db.query(`
        DELETE FROM geofence_events 
        WHERE event_timestamp < NOW() - INTERVAL '${daysToKeep} days'
        AND telegram_sent = true
      `);
      
      console.log(`🧹 [GEOFENCE] Cleaned ${result.rowCount} old events (older than ${daysToKeep} days)`);
      return result.rowCount;
      
    } catch (error) {
      console.error('❌ [GEOFENCE] Error cleaning old events:', error);
      return 0;
    }
  }
}

module.exports = new GeofenceEngine();