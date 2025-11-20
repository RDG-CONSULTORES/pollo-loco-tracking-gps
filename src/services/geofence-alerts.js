const db = require('../config/database');
const { getBot } = require('../telegram/bot');

/**
 * Sistema de alertas de geofence
 * Detecta entrada y salida de sucursales
 */
class GeofenceAlerts {
  constructor() {
    this.isEnabled = true;
    this.lastUserLocations = new Map(); // Cache de últimas ubicaciones por usuario
  }
  
  /**
   * Verificar alertas para nueva ubicación GPS
   */
  async checkGeofenceAlerts(locationData) {
    if (!this.isEnabled) return;
    
    try {
      const { user_id, latitude, longitude, gps_timestamp } = locationData;
      
      // Obtener información del usuario
      const userResult = await db.query(
        'SELECT display_name, tracker_id FROM tracking_users WHERE id = $1',
        [user_id]
      );
      
      if (userResult.rows.length === 0) return;
      
      const user = userResult.rows[0];
      const currentLocation = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
      
      // Obtener todas las sucursales activas
      const storesResult = await db.query(`
        SELECT id, name, latitude, longitude, geofence_radius
        FROM tracking_locations_cache 
        WHERE active = true
      `);
      
      // Verificar cada sucursal
      for (const store of storesResult.rows) {
        const storeLocation = {
          lat: parseFloat(store.latitude),
          lng: parseFloat(store.longitude)
        };
        
        const radius = store.geofence_radius || 100; // Default 100m
        const distance = this.calculateDistance(currentLocation, storeLocation);
        const isInside = distance <= radius;
        
        // Verificar cambio de estado
        const lastState = this.getLastGeofenceState(user_id, store.id);
        
        if (isInside && !lastState.wasInside) {
          // ENTRADA a la sucursal
          const entryEventId = await this.saveGeofenceEvent(user_id, store.id, 'enter', gps_timestamp, distance, currentLocation);
          await this.handleGeofenceEntry(user, store, currentLocation, distance, entryEventId);
          
        } else if (!isInside && lastState.wasInside) {
          // SALIDA de la sucursal
          const exitEventId = await this.saveGeofenceEvent(user_id, store.id, 'exit', gps_timestamp, distance, currentLocation);
          await this.handleGeofenceExit(user, store, currentLocation, distance, lastState.entryTime, exitEventId);
        }
        
        // Actualizar estado en cache
        this.updateGeofenceState(user_id, store.id, isInside, gps_timestamp);
      }
      
    } catch (error) {
      console.error('❌ Error verificando geofence alerts:', error.message);
    }
  }
  
  /**
   * Manejar entrada a sucursal
   */
  async handleGeofenceEntry(user, store, location, distance, eventId = null) {
    const time = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Monterrey' });
    
    const message = `
🟢 *ENTRADA DETECTADA*

👤 *Supervisor:* ${user.display_name} (${user.tracker_id})
🏢 *Sucursal:* ${store.name}
📍 *Ubicación:* ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
📏 *Distancia:* ${Math.round(distance)}m del centro
🕒 *Hora:* ${time}

✅ El supervisor ha llegado a la sucursal.
    `;
    
    console.log(`🟢 ENTRADA: ${user.display_name} → ${store.name} (${Math.round(distance)}m)`);
    
    // Enviar notificación a Telegram con eventId para verificar envío
    await this.sendTelegramAlert(message, eventId);
  }
  
  /**
   * Manejar salida de sucursal
   */
  async handleGeofenceExit(user, store, location, distance, entryTime, eventId = null) {
    const time = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Monterrey' });
    const visitDuration = entryTime ? this.calculateVisitDuration(entryTime, new Date()) : 'Desconocido';
    
    const message = `
🔴 *SALIDA DETECTADA*

👤 *Supervisor:* ${user.display_name} (${user.tracker_id})
🏢 *Sucursal:* ${store.name}
📍 *Ubicación:* ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
📏 *Distancia:* ${Math.round(distance)}m del centro
🕒 *Hora:* ${time}
⏱️ *Duración visita:* ${visitDuration}

⚠️ El supervisor ha salido de la sucursal.
    `;
    
    console.log(`🔴 SALIDA: ${user.display_name} ← ${store.name} (${visitDuration})`);
    
    // Enviar notificación a Telegram con eventId para verificar envío
    await this.sendTelegramAlert(message, eventId);
  }
  
  /**
   * Enviar alerta a Telegram y marcar en BD según resultado real
   */
  async sendTelegramAlert(message, eventId = null) {
    try {
      const bot = getBot();
      if (bot && bot.bot) {
        // Enviar a todos los admins configurados
        const result = await bot.broadcastToAdmins(message, { parse_mode: 'Markdown' });
        
        // Solo marcar como enviado si fue exitoso
        if (result.successful > 0 && eventId) {
          await this.markTelegramSent(eventId);
          console.log(`✅ Telegram enviado exitosamente (${result.successful} admins), marcado en BD`);
          return true;
        } else if (eventId) {
          await this.markTelegramError(eventId, `Broadcast failed: ${result.failed} failed, ${result.successful} successful`);
          console.log(`❌ Telegram falló (${result.failed} fallidos), marcado error en BD`);
          return false;
        }
        
        return result.successful > 0;
      } else {
        console.log('❌ Bot no disponible');
        if (eventId) {
          await this.markTelegramError(eventId, 'Bot no disponible o no inicializado');
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Error enviando alerta Telegram:', error.message);
      if (eventId) {
        await this.markTelegramError(eventId, error.message);
      }
      return false;
    }
  }
  
  /**
   * Obtener último estado de geofence para usuario/sucursal
   */
  getLastGeofenceState(userId, storeId) {
    const key = `${userId}-${storeId}`;
    const cached = this.lastUserLocations.get(key);
    
    return {
      wasInside: cached?.wasInside || false,
      entryTime: cached?.entryTime || null
    };
  }
  
  /**
   * Actualizar estado de geofence en cache
   */
  updateGeofenceState(userId, storeId, isInside, timestamp) {
    const key = `${userId}-${storeId}`;
    const existing = this.lastUserLocations.get(key) || {};
    
    this.lastUserLocations.set(key, {
      wasInside: isInside,
      entryTime: isInside ? (existing.entryTime || timestamp) : null,
      lastUpdate: timestamp
    });
  }
  
  /**
   * Guardar evento de geofence en base de datos
   */
  async saveGeofenceEvent(userId, storeId, eventType, timestamp, distance, location = null) {
    try {
      // Obtener location_code del store
      const storeResult = await db.query(
        'SELECT location_code FROM tracking_locations_cache WHERE id = $1',
        [storeId]
      );
      
      if (storeResult.rows.length === 0) return;
      
      const locationCode = storeResult.rows[0].location_code;
      
      const result = await db.query(`
        INSERT INTO geofence_events (
          user_id, location_code, event_type, event_timestamp, 
          latitude, longitude, distance_from_center, telegram_sent, telegram_sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, NULL)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [userId, locationCode, eventType, timestamp, location?.lat || null, location?.lng || null, Math.round(distance)]);
      
      return result.rows.length > 0 ? result.rows[0].id : null;
      
    } catch (error) {
      console.error('❌ Error guardando evento geofence:', error.message);
      return null;
    }
  }
  
  /**
   * Marcar evento como enviado exitosamente por Telegram
   */
  async markTelegramSent(eventId) {
    try {
      const db = require('../config/database');
      await db.query(`
        UPDATE geofence_events 
        SET telegram_sent = true, telegram_sent_at = NOW()
        WHERE id = $1
      `, [eventId]);
      console.log(`📝 Evento ${eventId} marcado como enviado exitosamente`);
    } catch (error) {
      console.error('❌ Error marcando telegram enviado:', error.message);
    }
  }
  
  /**
   * Marcar error en envío de Telegram
   */
  async markTelegramError(eventId, errorMessage) {
    try {
      const db = require('../config/database');
      await db.query(`
        UPDATE geofence_events 
        SET telegram_sent = false, telegram_error = $2, telegram_sent_at = NULL
        WHERE id = $1
      `, [eventId, errorMessage]);
      console.log(`📝 Evento ${eventId} marcado con error: ${errorMessage}`);
    } catch (error) {
      console.error('❌ Error marcando error telegram:', error.message);
    }
  }
  
  /**
   * Calcular distancia entre dos puntos GPS (Haversine)
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distancia en metros
  }
  
  /**
   * Convertir grados a radianes
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Calcular duración de visita
   */
  calculateVisitDuration(entryTime, exitTime) {
    const diffMs = exitTime.getTime() - new Date(entryTime).getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minutos`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  }
  
  /**
   * Habilitar/deshabilitar alertas
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`🚨 Alertas geofence: ${enabled ? 'HABILITADAS' : 'DESHABILITADAS'}`);
  }
  
  /**
   * Obtener estadísticas de alertas
   */
  async getAlertStats(days = 7) {
    try {
      const result = await db.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          DATE(event_time) as date
        FROM geofence_events 
        WHERE event_time > NOW() - INTERVAL '${days} days'
        GROUP BY event_type, DATE(event_time)
        ORDER BY date DESC, event_type
      `);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo stats de alertas:', error.message);
      return [];
    }
  }
}

// Singleton instance
const geofenceAlerts = new GeofenceAlerts();

module.exports = geofenceAlerts;