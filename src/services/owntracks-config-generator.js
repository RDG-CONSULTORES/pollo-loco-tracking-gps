const db = require('../config/database');

/**
 * Generador de Configuración Automática para OwnTracks
 * Crea configuraciones inteligentes y adaptativas para cada supervisor
 */
class OwnTracksConfigGenerator {
  constructor() {
    this.defaultConfig = {
      // Configuración base para tracking inteligente
      monitoring: 2,              // Significant location changes
      locatorInterval: 60,        // 1 minuto cuando se mueve
      locatorDisplacement: 10,    // 10 metros mínimo de movimiento
      moveModeLocatorInterval: 30, // 30 segundos en modo movimiento
      pubRetain: true,            // Retener mensajes para confiabilidad
      pubQos: 1,                  // QoS level 1 para confiabilidad
      ranging: true,              // Habilitar ranging para geofences
      tid: "XX",                  // Tracker ID (será reemplazado)
      
      // Configuraciones de batería y rendimiento
      ignoreInaccurateLocations: 200, // Ignorar ubicaciones > 200m precisión
      ignoreStaleLocations: 0,    // No ignorar ubicaciones viejas
      locatorPriority: 2,         // Balance de precisión/batería
      cleanSession: false,        // Mantener sesión para confiabilidad
      
      // Configuraciones de red
      keepalive: 60,              // Keep alive cada minuto
      willRetain: true,           // Retener will message
      autostart: true,            // Auto-iniciar tracking
      
      // Configuraciones específicas de geofencing
      setupDone: true,            // Configuración completada
      experimental: true          // Habilitar características experimentales
    };
    
    // Perfiles de tracking adaptativos
    this.trackingProfiles = {
      // Supervisor muy activo - máxima frecuencia
      active: {
        locatorInterval: 30,
        moveModeLocatorInterval: 20,
        locatorDisplacement: 5
      },
      
      // Supervisor normal - configuración balanceada  
      normal: {
        locatorInterval: 60,
        moveModeLocatorInterval: 30,
        locatorDisplacement: 10
      },
      
      // Supervisor poco activo - conservar batería
      conservative: {
        locatorInterval: 120,
        moveModeLocatorInterval: 60,
        locatorDisplacement: 20
      },
      
      // Modo de batería baja - mínima frecuencia
      battery_saver: {
        locatorInterval: 300,
        moveModeLocatorInterval: 180,
        locatorDisplacement: 50,
        locatorPriority: 0  // Baja precisión para ahorrar batería
      }
    };
  }

  /**
   * Generar configuración completa para un usuario
   * @param {string} trackerId - ID del tracker del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Configuración de OwnTracks
   */
  async generateConfig(trackerId, options = {}) {
    try {
      console.log(`⚙️ [CONFIG] Generating OwnTracks config for ${trackerId}`);
      
      // 1. Obtener datos del usuario
      const user = await this.getUserData(trackerId);
      if (!user) {
        throw new Error(`User not found: ${trackerId}`);
      }

      // 2. Determinar perfil de tracking
      const profile = await this.determineTrackingProfile(user);
      
      // 3. Obtener waypoints (sucursales)
      const waypoints = await this.generateWaypoints(user);
      
      // 4. Obtener regiones (geofences)
      const regions = await this.generateRegions(user);
      
      // 5. Crear configuración base
      const config = {
        _type: "configuration",
        ...this.defaultConfig,
        ...this.trackingProfiles[profile],
        
        // Información del usuario
        tid: trackerId,
        username: user.display_name,
        
        // Configuración de servidor
        host: this.getServerHost(),
        port: 443,
        tls: true,
        ws: true,
        url: this.getWebSocketUrl(),
        
        // Waypoints y regiones
        waypoints: waypoints,
        regions: regions,
        
        // Metadatos
        generated: new Date().toISOString(),
        version: "2.0",
        profile: profile,
        ...options
      };
      
      console.log(`✅ [CONFIG] Generated ${profile} profile config for ${trackerId}`);
      console.log(`📍 [CONFIG] Added ${waypoints.length} waypoints and ${regions.length} regions`);
      
      return config;
      
    } catch (error) {
      console.error('❌ [CONFIG] Error generating config:', error);
      throw error;
    }
  }

  /**
   * Determinar perfil de tracking basado en actividad del usuario
   * @param {Object} user - Datos del usuario
   * @returns {Promise<string>} - Nombre del perfil
   */
  async determineTrackingProfile(user) {
    try {
      // Analizar actividad reciente del usuario
      const activityResult = await db.query(`
        SELECT 
          COUNT(*) as total_locations,
          COUNT(*) FILTER (WHERE gps_timestamp >= NOW() - INTERVAL '7 days') as recent_locations,
          AVG(EXTRACT(EPOCH FROM (NOW() - gps_timestamp))/3600) as avg_hours_since_last,
          COUNT(DISTINCT DATE(gps_timestamp)) as active_days
        FROM gps_locations 
        WHERE user_id = $1 
          AND gps_timestamp >= NOW() - INTERVAL '30 days'
      `, [user.id]);

      const activity = activityResult.rows[0];
      
      // Analizar eventos de geofencing
      const geofenceResult = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT location_code) as unique_locations_visited
        FROM geofence_events 
        WHERE user_id = $1 
          AND event_timestamp >= NOW() - INTERVAL '7 days'
      `, [user.id]);

      const geofenceActivity = geofenceResult.rows[0];
      
      // Calcular score de actividad
      const recentLocations = parseInt(activity.recent_locations) || 0;
      const activeDays = parseInt(activity.active_days) || 0;
      const geofenceEvents = parseInt(geofenceActivity.total_events) || 0;
      const locationsVisited = parseInt(geofenceActivity.unique_locations_visited) || 0;
      
      // Algoritmo de scoring
      let score = 0;
      score += recentLocations > 100 ? 3 : recentLocations > 50 ? 2 : recentLocations > 10 ? 1 : 0;
      score += activeDays > 5 ? 2 : activeDays > 2 ? 1 : 0;
      score += geofenceEvents > 20 ? 3 : geofenceEvents > 10 ? 2 : geofenceEvents > 5 ? 1 : 0;
      score += locationsVisited > 10 ? 2 : locationsVisited > 5 ? 1 : 0;
      
      // Determinar perfil
      let profile;
      if (score >= 8) {
        profile = 'active';
      } else if (score >= 5) {
        profile = 'normal';
      } else if (score >= 2) {
        profile = 'conservative';
      } else {
        profile = 'normal'; // Default para nuevos usuarios
      }
      
      console.log(`📊 [CONFIG] Activity score for ${user.tracker_id}: ${score} → ${profile}`);
      console.log(`📊 [CONFIG] Stats: ${recentLocations} recent, ${activeDays} active days, ${geofenceEvents} geofence events`);
      
      return profile;
      
    } catch (error) {
      console.error('❌ [CONFIG] Error determining profile:', error);
      return 'normal'; // Fallback
    }
  }

  /**
   * Generar waypoints de sucursales para el usuario
   * @param {Object} user - Datos del usuario
   * @returns {Promise<Array>} - Array de waypoints
   */
  async generateWaypoints(user) {
    try {
      // Obtener sucursales relevantes (basado en grupo o todas)
      const result = await db.query(`
        SELECT 
          sg.location_code,
          sg.store_name,
          sg.group_name,
          sg.latitude,
          sg.longitude,
          sg.radius_meters
        FROM sucursal_geofences sg
        WHERE sg.active = true
        ORDER BY sg.group_name, sg.store_name
        LIMIT 50
      `);
      
      const waypoints = result.rows.map(sucursal => ({
        _type: "waypoint",
        desc: sucursal.store_name,
        lat: parseFloat(sucursal.latitude),
        lon: parseFloat(sucursal.longitude),
        rad: sucursal.radius_meters,
        tst: Math.floor(Date.now() / 1000),
        
        // Metadatos adicionales
        group: sucursal.group_name,
        locationCode: sucursal.location_code
      }));
      
      console.log(`📍 [CONFIG] Generated ${waypoints.length} waypoints for ${user.tracker_id}`);
      return waypoints;
      
    } catch (error) {
      console.error('❌ [CONFIG] Error generating waypoints:', error);
      return [];
    }
  }

  /**
   * Generar regiones (geofences) para monitoreo automático
   * @param {Object} user - Datos del usuario
   * @returns {Promise<Array>} - Array de regiones
   */
  async generateRegions(user) {
    try {
      // Obtener top sucursales visitadas por el usuario
      const result = await db.query(`
        SELECT 
          sg.location_code,
          sg.store_name,
          sg.latitude,
          sg.longitude,
          sg.radius_meters,
          COUNT(ge.id) as visit_count
        FROM sucursal_geofences sg
        LEFT JOIN geofence_events ge ON sg.location_code = ge.location_code 
          AND ge.user_id = $1 
          AND ge.event_timestamp >= NOW() - INTERVAL '30 days'
        WHERE sg.active = true
        GROUP BY sg.location_code, sg.store_name, sg.latitude, sg.longitude, sg.radius_meters
        ORDER BY visit_count DESC, sg.store_name
        LIMIT 20
      `, [user.id]);
      
      const regions = result.rows.map((sucursal, index) => ({
        _type: "region",
        desc: sucursal.store_name,
        lat: parseFloat(sucursal.latitude),
        lon: parseFloat(sucursal.longitude),
        rad: sucursal.radius_meters,
        tst: Math.floor(Date.now() / 1000),
        
        // Configuración de notificaciones
        notify: 1,  // Notificar entrada y salida
        share: 0,   // No compartir automáticamente
        
        // ID único para la región
        rid: `${sucursal.location_code}_${index}`
      }));
      
      console.log(`🔐 [CONFIG] Generated ${regions.length} monitoring regions for ${user.tracker_id}`);
      return regions;
      
    } catch (error) {
      console.error('❌ [CONFIG] Error generating regions:', error);
      return [];
    }
  }

  /**
   * Obtener datos del usuario por tracker ID
   * @param {string} trackerId - ID del tracker
   * @returns {Promise<Object|null>} - Datos del usuario
   */
  async getUserData(trackerId) {
    try {
      const result = await db.query(`
        SELECT * FROM tracking_users WHERE tracker_id = $1 AND active = true
      `, [trackerId]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      console.error('❌ [CONFIG] Error getting user data:', error);
      return null;
    }
  }

  /**
   * Obtener host del servidor para configuración
   * @returns {string} - Host del servidor
   */
  getServerHost() {
    // Extraer host de la URL de la app
    const appUrl = process.env.WEB_APP_URL || 'https://pollo-loco-tracking-gps-production.up.railway.app';
    return appUrl.replace('https://', '').replace('http://', '');
  }

  /**
   * Obtener URL de WebSocket para OwnTracks
   * @returns {string} - URL del WebSocket
   */
  getWebSocketUrl() {
    const host = this.getServerHost();
    return `wss://${host}/api/owntracks/location`;
  }

  /**
   * Generar configuración adaptativa basada en contexto
   * @param {string} trackerId - ID del tracker
   * @param {string} context - Contexto: 'work', 'travel', 'battery_low'
   * @returns {Promise<Object>} - Configuración adaptada
   */
  async generateAdaptiveConfig(trackerId, context = 'work') {
    const baseConfig = await this.generateConfig(trackerId);
    
    const adaptations = {
      work: {
        // Horario laboral - tracking normal
        locatorInterval: 60,
        moveModeLocatorInterval: 30
      },
      
      travel: {
        // Viajando - tracking más frecuente
        locatorInterval: 30,
        moveModeLocatorInterval: 15,
        locatorDisplacement: 5
      },
      
      battery_low: {
        // Batería baja - conservar energía
        locatorInterval: 300,
        moveModeLocatorInterval: 180,
        locatorDisplacement: 50,
        locatorPriority: 0
      },
      
      night: {
        // Horario nocturno - mínimo tracking
        locatorInterval: 600,
        moveModeLocatorInterval: 300,
        locatorDisplacement: 100
      }
    };
    
    return {
      ...baseConfig,
      ...adaptations[context],
      context: context,
      adaptedAt: new Date().toISOString()
    };
  }

  /**
   * Validar configuración antes de envío
   * @param {Object} config - Configuración a validar
   * @returns {Object} - Resultado de validación
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];
    
    // Validaciones requeridas
    if (!config.tid) errors.push('Missing tracker ID');
    if (!config.host) errors.push('Missing server host');
    if (!config._type) errors.push('Missing configuration type');
    
    // Validaciones de rendimiento
    if (config.locatorInterval < 15) {
      warnings.push('Very frequent tracking may drain battery quickly');
    }
    
    if (config.locatorDisplacement < 5) {
      warnings.push('Very low displacement threshold may cause excessive updates');
    }
    
    if (config.regions && config.regions.length > 50) {
      warnings.push('Too many regions may impact performance');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = new OwnTracksConfigGenerator();