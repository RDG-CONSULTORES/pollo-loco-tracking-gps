const db = require('../config/database');
const configGenerator = require('./owntracks-config-generator');

/**
 * Sistema de Tracking Adaptativo Inteligente
 * Ajusta automáticamente la configuración de OwnTracks basado en:
 * - Nivel de batería
 * - Tipo de conexión de red  
 * - Precisión GPS
 * - Patrones de movimiento
 * - Horarios laborales
 */
class AdaptiveTracking {
  constructor() {
    this.adaptationRules = {
      // Reglas basadas en batería
      battery: {
        critical: { threshold: 10, profile: 'battery_saver', interval: 600 },
        low: { threshold: 20, profile: 'conservative', interval: 300 },
        medium: { threshold: 50, profile: 'normal', interval: 60 },
        high: { threshold: 100, profile: 'active', interval: 30 }
      },
      
      // Reglas basadas en precisión GPS
      accuracy: {
        poor: { threshold: 100, profile: 'conservative', increase_interval: true },
        fair: { threshold: 50, profile: 'normal', increase_interval: false },
        good: { threshold: 20, profile: 'active', increase_interval: false },
        excellent: { threshold: 5, profile: 'active', increase_interval: false }
      },
      
      // Reglas basadas en movimiento
      movement: {
        stationary: { threshold: 5, multiplier: 3 },    // 3x interval si no se mueve
        slow: { threshold: 20, multiplier: 2 },         // 2x interval si se mueve lento
        normal: { threshold: 50, multiplier: 1 },       // Interval normal
        fast: { threshold: 100, multiplier: 0.5 }       // 0.5x interval si se mueve rápido
      },
      
      // Reglas basadas en horarios
      schedule: {
        working_hours: { start: 8, end: 18, profile: 'normal' },
        extended_hours: { start: 6, end: 20, profile: 'conservative' },
        night_hours: { start: 20, end: 6, profile: 'battery_saver' }
      }
    };
    
    this.lastAdaptations = new Map(); // Cache para evitar adaptaciones frecuentes
    this.adaptationCooldown = 5 * 60 * 1000; // 5 minutos entre adaptaciones
  }

  /**
   * Procesar ubicación y determinar si necesita adaptación
   * @param {Object} locationData - Datos de ubicación GPS
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async processLocationForAdaptation(locationData) {
    try {
      const userId = locationData.user_id;
      const trackerId = await this.getTrackerIdByUserId(userId);
      
      if (!trackerId) {
        return { adapted: false, reason: 'user_not_found' };
      }
      
      console.log(`🧠 [ADAPTIVE] Processing location for adaptation: ${trackerId}`);
      
      // Verificar cooldown
      if (this.isInCooldown(trackerId)) {
        return { adapted: false, reason: 'cooldown_active' };
      }
      
      // Analizar condiciones actuales
      const conditions = await this.analyzeConditions(locationData, trackerId);
      
      // Determinar si necesita adaptación
      const adaptation = await this.determineAdaptation(conditions, trackerId);
      
      if (adaptation.shouldAdapt) {
        // Aplicar adaptación
        const result = await this.applyAdaptation(trackerId, adaptation);
        
        // Registrar adaptación
        this.lastAdaptations.set(trackerId, Date.now());
        
        return {
          adapted: true,
          reason: adaptation.reason,
          newProfile: adaptation.profile,
          conditions: conditions,
          ...result
        };
      }
      
      return {
        adapted: false,
        reason: 'no_adaptation_needed',
        conditions: conditions
      };
      
    } catch (error) {
      console.error('❌ [ADAPTIVE] Error processing adaptation:', error);
      return { adapted: false, error: error.message };
    }
  }

  /**
   * Analizar condiciones actuales del dispositivo/usuario
   * @param {Object} locationData - Datos de ubicación
   * @param {string} trackerId - ID del tracker
   * @returns {Promise<Object>} - Condiciones analizadas
   */
  async analyzeConditions(locationData, trackerId) {
    try {
      // Datos de la ubicación actual
      const battery = locationData.battery || null;
      const accuracy = locationData.accuracy || null;
      const timestamp = locationData.gps_timestamp || new Date();
      
      // Analizar movimiento reciente
      const movement = await this.analyzeMovement(locationData.user_id, timestamp);
      
      // Analizar horario actual
      const schedule = this.analyzeSchedule(timestamp);
      
      // Analizar tendencias recientes
      const trends = await this.analyzeTrends(locationData.user_id);
      
      return {
        battery: {
          level: battery,
          category: this.categorizeBattery(battery)
        },
        accuracy: {
          meters: accuracy,
          category: this.categorizeAccuracy(accuracy)
        },
        movement: movement,
        schedule: schedule,
        trends: trends,
        timestamp: timestamp
      };
      
    } catch (error) {
      console.error('❌ [ADAPTIVE] Error analyzing conditions:', error);
      return {};
    }
  }

  /**
   * Analizar patrones de movimiento recientes
   * @param {number} userId - ID del usuario
   * @param {Date} currentTime - Tiempo actual
   * @returns {Promise<Object>} - Análisis de movimiento
   */
  async analyzeMovement(userId, currentTime) {
    try {
      // Obtener ubicaciones de la última hora
      const result = await db.query(`
        SELECT 
          latitude, longitude, velocity, gps_timestamp,
          LAG(latitude) OVER (ORDER BY gps_timestamp) as prev_lat,
          LAG(longitude) OVER (ORDER BY gps_timestamp) as prev_lon,
          LAG(gps_timestamp) OVER (ORDER BY gps_timestamp) as prev_time
        FROM gps_locations 
        WHERE user_id = $1 
          AND gps_timestamp >= $2
        ORDER BY gps_timestamp DESC
        LIMIT 10
      `, [userId, new Date(currentTime.getTime() - 60 * 60 * 1000)]); // Última hora
      
      if (result.rows.length < 2) {
        return {
          category: 'stationary',
          averageVelocity: 0,
          totalDistance: 0,
          locations: result.rows.length
        };
      }
      
      let totalDistance = 0;
      let totalVelocity = 0;
      let velocityCount = 0;
      
      for (const row of result.rows) {
        if (row.prev_lat && row.prev_lon) {
          // Calcular distancia entre puntos
          const distance = this.calculateDistance(
            row.prev_lat, row.prev_lon,
            row.latitude, row.longitude
          );
          totalDistance += distance;
        }
        
        if (row.velocity && row.velocity > 0) {
          totalVelocity += row.velocity;
          velocityCount++;
        }
      }
      
      const averageVelocity = velocityCount > 0 ? totalVelocity / velocityCount : 0;
      
      // Categorizar movimiento
      let category = 'stationary';
      if (averageVelocity > 50) {
        category = 'fast';
      } else if (averageVelocity > 20) {
        category = 'normal';
      } else if (averageVelocity > 5) {
        category = 'slow';
      }
      
      return {
        category: category,
        averageVelocity: Math.round(averageVelocity),
        totalDistance: Math.round(totalDistance),
        locations: result.rows.length
      };
      
    } catch (error) {
      console.error('❌ [ADAPTIVE] Error analyzing movement:', error);
      return { category: 'stationary', averageVelocity: 0, totalDistance: 0 };
    }
  }

  /**
   * Analizar horario actual
   * @param {Date} timestamp - Timestamp actual
   * @returns {Object} - Análisis de horario
   */
  analyzeSchedule(timestamp) {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay(); // 0 = Domingo
    
    let category = 'night_hours';
    if (hour >= 8 && hour < 18 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      category = 'working_hours';
    } else if (hour >= 6 && hour < 20) {
      category = 'extended_hours';
    }
    
    return {
      category: category,
      hour: hour,
      dayOfWeek: dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    };
  }

  /**
   * Analizar tendencias recientes del usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} - Tendencias analizadas
   */
  async analyzeTrends(userId) {
    try {
      const result = await db.query(`
        SELECT 
          AVG(battery) as avg_battery,
          AVG(accuracy) as avg_accuracy,
          COUNT(*) as location_count,
          MAX(gps_timestamp) as last_location
        FROM gps_locations 
        WHERE user_id = $1 
          AND gps_timestamp >= NOW() - INTERVAL '24 hours'
      `, [userId]);
      
      const trends = result.rows[0];
      
      return {
        avgBattery: trends.avg_battery ? Math.round(parseFloat(trends.avg_battery)) : null,
        avgAccuracy: trends.avg_accuracy ? Math.round(parseFloat(trends.avg_accuracy)) : null,
        locationCount: parseInt(trends.location_count) || 0,
        lastLocation: trends.last_location,
        frequency: this.calculateLocationFrequency(parseInt(trends.location_count) || 0)
      };
      
    } catch (error) {
      console.error('❌ [ADAPTIVE] Error analyzing trends:', error);
      return {};
    }
  }

  /**
   * Determinar si se necesita adaptación
   * @param {Object} conditions - Condiciones analizadas
   * @param {string} trackerId - ID del tracker
   * @returns {Promise<Object>} - Decisión de adaptación
   */
  async determineAdaptation(conditions, trackerId) {
    try {
      const reasons = [];
      let suggestedProfile = 'normal';
      let priority = 0;
      
      // Evaluar batería (prioridad alta)
      if (conditions.battery.level !== null) {
        if (conditions.battery.level <= 10) {
          reasons.push('critical_battery');
          suggestedProfile = 'battery_saver';
          priority = Math.max(priority, 10);
        } else if (conditions.battery.level <= 20) {
          reasons.push('low_battery');
          suggestedProfile = 'conservative';
          priority = Math.max(priority, 8);
        }
      }
      
      // Evaluar precisión GPS
      if (conditions.accuracy.meters && conditions.accuracy.meters > 100) {
        reasons.push('poor_gps_accuracy');
        suggestedProfile = 'conservative';
        priority = Math.max(priority, 6);
      }
      
      // Evaluar movimiento
      if (conditions.movement.category === 'stationary' && priority < 5) {
        reasons.push('stationary_movement');
        suggestedProfile = 'conservative';
        priority = Math.max(priority, 5);
      } else if (conditions.movement.category === 'fast' && priority < 4) {
        reasons.push('high_movement');
        suggestedProfile = 'active';
        priority = Math.max(priority, 4);
      }
      
      // Evaluar horario
      if (conditions.schedule.category === 'night_hours' && priority < 3) {
        reasons.push('night_hours');
        suggestedProfile = 'battery_saver';
        priority = Math.max(priority, 3);
      }
      
      // Evaluar tendencias
      if (conditions.trends.avgBattery && conditions.trends.avgBattery < 30 && priority < 2) {
        reasons.push('battery_trend_declining');
        suggestedProfile = 'conservative';
        priority = Math.max(priority, 2);
      }
      
      // Obtener perfil actual
      const currentProfile = await this.getCurrentProfile(trackerId);
      
      // Determinar si necesita cambio
      const shouldAdapt = reasons.length > 0 && 
                         suggestedProfile !== currentProfile && 
                         priority >= 5; // Solo adaptar para cambios importantes
      
      return {
        shouldAdapt: shouldAdapt,
        profile: suggestedProfile,
        currentProfile: currentProfile,
        reasons: reasons,
        priority: priority,
        conditions: conditions
      };
      
    } catch (error) {
      console.error('❌ [ADAPTIVE] Error determining adaptation:', error);
      return { shouldAdapt: false, error: error.message };
    }
  }

  /**
   * Aplicar adaptación generando nueva configuración
   * @param {string} trackerId - ID del tracker
   * @param {Object} adaptation - Adaptación a aplicar
   * @returns {Promise<Object>} - Resultado de la aplicación
   */
  async applyAdaptation(trackerId, adaptation) {
    try {
      console.log(`🔄 [ADAPTIVE] Applying adaptation for ${trackerId}: ${adaptation.currentProfile} → ${adaptation.profile}`);
      
      // Generar nueva configuración
      const newConfig = await configGenerator.generateConfig(trackerId, {
        forcedProfile: adaptation.profile,
        adaptationReason: adaptation.reasons.join(', ')
      });
      
      // Log de adaptación
      await this.logAdaptation(trackerId, adaptation, newConfig);
      
      // Opcionalmente notificar al dispositivo
      // TODO: Implementar WebSocket push notification
      
      return {
        success: true,
        newConfiguration: newConfig,
        adaptationApplied: adaptation.profile,
        message: `Configuration adapted to ${adaptation.profile} profile`
      };
      
    } catch (error) {
      console.error('❌ [ADAPTIVE] Error applying adaptation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Funciones auxiliares
   */
  
  async getTrackerIdByUserId(userId) {
    try {
      const result = await db.query(`
        SELECT tracker_id FROM tracking_users WHERE id = $1
      `, [userId]);
      
      return result.rows[0]?.tracker_id || null;
    } catch (error) {
      console.error('❌ Error getting tracker ID:', error);
      return null;
    }
  }
  
  isInCooldown(trackerId) {
    const lastAdaptation = this.lastAdaptations.get(trackerId);
    return lastAdaptation && (Date.now() - lastAdaptation) < this.adaptationCooldown;
  }
  
  categorizeBattery(battery) {
    if (!battery) return 'unknown';
    if (battery <= 10) return 'critical';
    if (battery <= 20) return 'low';
    if (battery <= 50) return 'medium';
    return 'high';
  }
  
  categorizeAccuracy(accuracy) {
    if (!accuracy) return 'unknown';
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 20) return 'good';
    if (accuracy <= 50) return 'fair';
    return 'poor';
  }
  
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }
  
  calculateLocationFrequency(count) {
    // Frecuencia basada en ubicaciones en 24h
    if (count > 1440) return 'very_high'; // >1 por minuto
    if (count > 720) return 'high';       // ~2 por minuto
    if (count > 144) return 'normal';     // ~10 por hora
    if (count > 24) return 'low';         // ~1 por hora
    return 'very_low';
  }
  
  async getCurrentProfile(trackerId) {
    try {
      // Obtener último perfil del usuario
      const user = await configGenerator.getUserData(trackerId);
      if (user) {
        return await configGenerator.determineTrackingProfile(user);
      }
      return 'normal';
    } catch (error) {
      console.error('❌ Error getting current profile:', error);
      return 'normal';
    }
  }
  
  async logAdaptation(trackerId, adaptation, newConfig) {
    try {
      await db.query(`
        INSERT INTO tracking_adaptation_log (
          tracker_id, 
          old_profile, 
          new_profile, 
          reasons, 
          priority, 
          conditions,
          timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        trackerId,
        adaptation.currentProfile,
        adaptation.profile,
        JSON.stringify(adaptation.reasons),
        adaptation.priority,
        JSON.stringify(adaptation.conditions)
      ]);
    } catch (error) {
      console.error('❌ Error logging adaptation:', error);
    }
  }
}

module.exports = new AdaptiveTracking();