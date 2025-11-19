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
          await this.handleGeofenceEntry(user, store, currentLocation, distance);
          await this.saveGeofenceEvent(user_id, store.id, 'entry', gps_timestamp, distance);
          
        } else if (!isInside && lastState.wasInside) {
          // SALIDA de la sucursal
          await this.handleGeofenceExit(user, store, currentLocation, distance, lastState.entryTime);
          await this.saveGeofenceEvent(user_id, store.id, 'exit', gps_timestamp, distance);
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
  async handleGeofenceEntry(user, store, location, distance) {
    const time = new Date().toLocaleTimeString('es-MX');
    
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
    
    // Enviar notificación a Telegram
    await this.sendTelegramAlert(message);
  }
  
  /**
   * Manejar salida de sucursal
   */
  async handleGeofenceExit(user, store, location, distance, entryTime) {
    const time = new Date().toLocaleTimeString('es-MX');
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
    
    // Enviar notificación a Telegram
    await this.sendTelegramAlert(message);
  }
  
  /**
   * Enviar alerta a Telegram
   */
  async sendTelegramAlert(message) {
    try {
      const bot = getBot();
      if (bot && bot.bot) {
        // Enviar a todos los admins configurados
        await bot.broadcastToAdmins(message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error('❌ Error enviando alerta Telegram:', error.message);
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
  async saveGeofenceEvent(userId, storeId, eventType, timestamp, distance) {
    try {
      // Obtener location_code del store
      const storeResult = await db.query(
        'SELECT location_code FROM tracking_locations_cache WHERE id = $1',
        [storeId]
      );
      
      if (storeResult.rows.length === 0) return;
      
      const locationCode = storeResult.rows[0].location_code;
      
      await db.query(`
        INSERT INTO geofence_events (
          user_id, location_code, event_type, event_timestamp, 
          distance_from_center, telegram_sent, telegram_sent_at
        )
        VALUES ($1, $2, $3, $4, $5, true, NOW())
        ON CONFLICT DO NOTHING
      `, [userId, locationCode, eventType, timestamp, Math.round(distance)]);
      
    } catch (error) {
      console.error('❌ Error guardando evento geofence:', error.message);
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