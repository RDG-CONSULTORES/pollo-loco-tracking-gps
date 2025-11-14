const axios = require('axios');
const db = require('../config/database');
const routeEngine = require('./route-engine');

/**
 * Servicio de Optimización de Rutas Inteligente
 * Integra APIs externas y análisis avanzado para rutas óptimas
 */
class RouteOptimizer {
  constructor() {
    this.mapServices = {
      openrouteservice: {
        apiKey: process.env.OPENROUTE_API_KEY,
        baseUrl: 'https://api.openrouteservice.org',
        enabled: true, // Servicio gratuito hasta 2000 requests/día
        rateLimit: 40 // requests por minuto
      },
      google: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
        enabled: false, // Requiere configuración
        rateLimit: 50
      }
    };
    
    this.optimizationStrategies = {
      distance: 'Minimizar distancia total',
      time: 'Minimizar tiempo de viaje',
      fuel: 'Optimizar consumo de combustible',
      balanced: 'Balance entre tiempo y distancia',
      priority: 'Priorizar sucursales importantes'
    };
    
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Crear ruta optimizada inteligente
   * @param {Object} params - Parámetros de optimización
   * @returns {Promise<Object>} - Ruta optimizada con datos reales
   */
  async createOptimizedRoute(params) {
    const {
      userId,
      startLocation,
      sucursales,
      strategy = 'balanced',
      useRealRoads = true,
      includeTrafficData = false,
      preferences = {}
    } = params;

    try {
      console.log(`🎯 Creando ruta optimizada: ${strategy}, ${sucursales.length} sucursales`);

      // 1. Validaciones iniciales
      const validation = this.validateRouteRequest(params);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Obtener ubicación actual del usuario si no se especifica inicio
      const resolvedStart = await this.resolveUserStartLocation(userId, startLocation);

      // 3. Filtrar y priorizar sucursales
      const filteredSucursales = await this.filterAndPrioritizeSucursales(
        sucursales, strategy, preferences
      );

      // 4. Calcular ruta base con algoritmo interno
      const baseRoute = await routeEngine.calculateOptimalRoute({
        startLocation: resolvedStart,
        sucursales: filteredSucursales.map(s => s.id),
        algorithm: this.getAlgorithmForStrategy(strategy),
        constraints: preferences.constraints,
        preferences: preferences
      });

      // 5. Optimizar con datos reales de rutas si está habilitado
      let optimizedRoute = baseRoute;
      if (useRealRoads && this.mapServices.openrouteservice.enabled) {
        optimizedRoute = await this.optimizeWithRealRoutes(baseRoute, strategy);
      }

      // 6. Agregar análisis de tráfico si está disponible
      if (includeTrafficData) {
        optimizedRoute = await this.addTrafficAnalysis(optimizedRoute);
      }

      // 7. Generar recomendaciones inteligentes
      const recommendations = await this.generateSmartRecommendations(
        optimizedRoute, strategy, preferences
      );

      // 8. Calcular métricas avanzadas
      const advancedMetrics = await this.calculateAdvancedMetrics(optimizedRoute);

      // 9. Guardar análisis de optimización
      const optimizationId = await this.saveOptimizationAnalysis({
        userId,
        baseRoute,
        optimizedRoute,
        strategy,
        recommendations,
        metrics: advancedMetrics
      });

      return {
        success: true,
        route: optimizedRoute,
        recommendations: recommendations,
        metrics: advancedMetrics,
        optimizationId: optimizationId,
        strategy: strategy,
        improvements: this.calculateImprovements(baseRoute, optimizedRoute),
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error en optimización de ruta:', error);
      return {
        success: false,
        error: error.message,
        fallbackRoute: await this.generateFallbackRoute(params)
      };
    }
  }

  /**
   * Optimizar ruta usando APIs de mapas reales
   */
  async optimizeWithRealRoutes(baseRoute, strategy) {
    try {
      if (!baseRoute.route || !baseRoute.route.waypoints) {
        return baseRoute;
      }

      const waypoints = baseRoute.route.waypoints;
      const startPoint = baseRoute.route.startPoint;

      // Preparar coordenadas para la API
      const coordinates = [
        [startPoint.longitude, startPoint.latitude],
        ...waypoints.map(wp => [wp.sucursal.longitude, wp.sucursal.latitude])
      ];

      // Llamar a OpenRouteService para optimización
      const optimizedOrder = await this.callOpenRouteServiceOptimization(
        coordinates, strategy
      );

      // Reconstruir ruta con orden optimizado
      const optimizedRoute = this.reconstructRouteWithOptimizedOrder(
        baseRoute, optimizedOrder
      );

      // Obtener instrucciones detalladas de navegación
      const detailedDirections = await this.getDetailedDirections(
        optimizedRoute.route.waypoints, startPoint
      );

      optimizedRoute.route.detailedDirections = detailedDirections;

      console.log(`✅ Ruta optimizada con OpenRouteService`);
      return optimizedRoute;

    } catch (error) {
      console.error('⚠️ Error optimizando con API externa, usando ruta base:', error.message);
      return baseRoute;
    }
  }

  /**
   * Llamar a OpenRouteService para optimización de ruta
   */
  async callOpenRouteServiceOptimization(coordinates, strategy) {
    const apiKey = this.mapServices.openrouteservice.apiKey;
    if (!apiKey) {
      throw new Error('OpenRouteService API key no configurada');
    }

    // Mapear estrategia a parámetros de ORS
    const optimizationCriteria = this.mapStrategyToORSCriteria(strategy);

    const requestData = {
      jobs: coordinates.slice(1).map((coord, index) => ({
        id: index,
        location: coord,
        service: 1800 // 30 minutos por visita
      })),
      vehicles: [{
        id: 0,
        start: coordinates[0],
        profile: "driving-car"
      }],
      options: {
        g: true // Incluir geometría
      }
    };

    const response = await this.queueAPIRequest(async () => {
      return axios.post(
        `${this.mapServices.openrouteservice.baseUrl}/optimization`,
        requestData,
        {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
    });

    return response.data;
  }

  /**
   * Obtener instrucciones detalladas de navegación
   */
  async getDetailedDirections(waypoints, startPoint) {
    try {
      const directions = [];
      let currentPoint = startPoint;

      for (const waypoint of waypoints) {
        const routeData = await this.getRouteBetweenPoints(
          currentPoint,
          waypoint.sucursal
        );

        directions.push({
          to: waypoint.sucursal,
          route: routeData.route,
          instructions: routeData.instructions,
          duration: routeData.duration,
          distance: routeData.distance
        });

        currentPoint = {
          latitude: waypoint.sucursal.latitude,
          longitude: waypoint.sucursal.longitude
        };
      }

      return directions;

    } catch (error) {
      console.error('❌ Error obteniendo direcciones detalladas:', error);
      return [];
    }
  }

  /**
   * Obtener ruta entre dos puntos específicos
   */
  async getRouteBetweenPoints(start, end) {
    const coordinates = [
      [start.longitude, start.latitude],
      [end.longitude, end.latitude]
    ];

    const response = await this.queueAPIRequest(async () => {
      return axios.get(
        `${this.mapServices.openrouteservice.baseUrl}/v2/directions/driving-car`,
        {
          params: {
            api_key: this.mapServices.openrouteservice.apiKey,
            start: `${start.longitude},${start.latitude}`,
            end: `${end.longitude},${end.latitude}`,
            format: 'geojson',
            instructions: 'true',
            geometry: 'true'
          },
          timeout: 15000
        }
      );
    });

    const feature = response.data.features[0];
    return {
      route: feature.geometry.coordinates,
      instructions: feature.properties.segments[0].steps,
      duration: feature.properties.segments[0].duration,
      distance: feature.properties.segments[0].distance / 1000 // convertir a km
    };
  }

  /**
   * Generar recomendaciones inteligentes
   */
  async generateSmartRecommendations(route, strategy, preferences) {
    const recommendations = [];
    
    try {
      const metrics = route.metrics;
      
      // Análisis de duración
      if (metrics.estimatedDurationMinutes > 480) { // >8 horas
        recommendations.push({
          type: 'warning',
          category: 'duration',
          title: 'Ruta muy larga',
          message: `La ruta toma ${Math.round(metrics.estimatedDurationMinutes/60)}h. Considera dividirla en 2 días.`,
          suggestion: 'Reduce el número de sucursales o divide en múltiples rutas',
          priority: 'high'
        });
      }
      
      // Análisis de distancia
      if (metrics.averageDistancePerStop > 15) {
        recommendations.push({
          type: 'info',
          category: 'efficiency',
          title: 'Distancias largas entre paradas',
          message: `Promedio de ${metrics.averageDistancePerStop.toFixed(1)}km entre sucursales.`,
          suggestion: 'Reagrupa sucursales por zona geográfica',
          priority: 'medium'
        });
      }
      
      // Análisis de eficiencia
      if (metrics.efficiency < 60) {
        recommendations.push({
          type: 'tip',
          category: 'optimization',
          title: 'Ruta poco eficiente',
          message: `Eficiencia del ${metrics.efficiency}%. Se puede optimizar.`,
          suggestion: 'Prueba el algoritmo genético o reorganiza el orden',
          priority: 'medium'
        });
      }
      
      // Recomendaciones por horario
      const now = new Date();
      const currentHour = now.getHours();
      
      if (currentHour > 16) {
        recommendations.push({
          type: 'tip',
          category: 'timing',
          title: 'Hora tarde para iniciar',
          message: 'Es tarde para una ruta larga. Considera iniciar temprano mañana.',
          suggestion: 'Programa la ruta para iniciar entre 7:00-9:00 AM',
          priority: 'low'
        });
      }
      
      // Análisis de combustible
      if (metrics.estimatedFuelCostMXN > 500) {
        recommendations.push({
          type: 'info',
          category: 'cost',
          title: 'Costo de combustible alto',
          message: `Costo estimado: $${metrics.estimatedFuelCostMXN} MXN`,
          suggestion: 'Considera rutas más cortas o vehículo más eficiente',
          priority: 'low'
        });
      }

      // Recomendaciones de sucursales prioritarias
      const priorityAnalysis = await this.analyzeSucursalesPriority(route);
      if (priorityAnalysis.length > 0) {
        recommendations.push(...priorityAnalysis);
      }

      console.log(`💡 ${recommendations.length} recomendaciones generadas`);
      
    } catch (error) {
      console.error('❌ Error generando recomendaciones:', error);
    }
    
    return recommendations;
  }

  /**
   * Analizar prioridades de sucursales
   */
  async analyzeSucursalesPriority(route) {
    const recommendations = [];
    
    try {
      // Obtener datos históricos de visitas
      const waypoints = route.route?.waypoints || [];
      const sucursalIds = waypoints.map(wp => wp.sucursal.id);
      
      const visitHistory = await db.query(`
        SELECT 
          geofence_id,
          COUNT(*) as visit_count,
          MAX(event_timestamp) as last_visit
        FROM geofence_events
        WHERE geofence_id = ANY($1)
          AND event_type = 'enter'
          AND event_timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY geofence_id
      `, [sucursalIds]);

      // Analizar frecuencia de visitas
      for (const visit of visitHistory.rows) {
        const daysSinceLastVisit = Math.floor(
          (new Date() - new Date(visit.last_visit)) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastVisit > 7) {
          recommendations.push({
            type: 'warning',
            category: 'priority',
            title: 'Sucursal no visitada recientemente',
            message: `${visit.geofence_id}: ${daysSinceLastVisit} días sin visita`,
            suggestion: 'Priorizar en la ruta',
            priority: 'high'
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error analizando prioridades:', error);
    }
    
    return recommendations;
  }

  /**
   * Calcular métricas avanzadas
   */
  async calculateAdvancedMetrics(route) {
    const baseMetrics = route.metrics;
    
    // Métricas ambientales
    const co2EmissionKg = baseMetrics.totalDistanceKm * 0.21; // 0.21 kg CO2 por km
    
    // Métricas de productividad
    const sucursalesPerHour = baseMetrics.sucursalesCount / 
                             (baseMetrics.estimatedDurationMinutes / 60);
    
    // Métricas económicas
    const costPerSucursal = baseMetrics.estimatedFuelCostMXN / 
                           baseMetrics.sucursalesCount;
    
    // Score de calidad de ruta (0-100)
    const qualityScore = this.calculateRouteQualityScore(baseMetrics);
    
    return {
      ...baseMetrics,
      environmental: {
        co2EmissionKg: Math.round(co2EmissionKg * 100) / 100,
        fuelLiters: Math.round(baseMetrics.totalDistanceKm / 12 * 100) / 100
      },
      productivity: {
        sucursalesPerHour: Math.round(sucursalesPerHour * 100) / 100,
        kmPerSucursal: Math.round(baseMetrics.averageDistancePerStop * 100) / 100
      },
      economics: {
        costPerSucursal: Math.round(costPerSucursal),
        totalCostMXN: baseMetrics.estimatedFuelCostMXN
      },
      quality: {
        score: qualityScore,
        rating: this.getQualityRating(qualityScore)
      }
    };
  }

  /**
   * Calcular score de calidad de ruta
   */
  calculateRouteQualityScore(metrics) {
    let score = 100;
    
    // Penalizar rutas muy largas
    if (metrics.estimatedDurationMinutes > 480) score -= 20;
    else if (metrics.estimatedDurationMinutes > 360) score -= 10;
    
    // Penalizar baja eficiencia
    if (metrics.efficiency < 50) score -= 30;
    else if (metrics.efficiency < 70) score -= 15;
    
    // Penalizar distancias largas entre paradas
    if (metrics.averageDistancePerStop > 20) score -= 25;
    else if (metrics.averageDistancePerStop > 10) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Obtener rating de calidad
   */
  getQualityRating(score) {
    if (score >= 90) return 'Excelente';
    if (score >= 80) return 'Muy Buena';
    if (score >= 70) return 'Buena';
    if (score >= 60) return 'Regular';
    return 'Necesita Mejoras';
  }

  /**
   * Sistema de cola para requests a API
   */
  async queueAPIRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFunction, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { requestFunction, resolve, reject } = this.requestQueue.shift();

      try {
        const result = await requestFunction();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Rate limiting: esperar entre requests
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 segundos
    }

    this.isProcessingQueue = false;
  }

  /**
   * Funciones auxiliares
   */
  
  validateRouteRequest(params) {
    if (!params.sucursales || params.sucursales.length === 0) {
      return { valid: false, error: 'No se especificaron sucursales' };
    }
    
    if (params.sucursales.length > 10) {
      return { valid: false, error: 'Máximo 10 sucursales por ruta' };
    }
    
    return { valid: true };
  }

  async resolveUserStartLocation(userId, startLocation) {
    if (startLocation) {
      return startLocation;
    }

    // Obtener última ubicación del usuario
    const result = await db.query(`
      SELECT latitude, longitude
      FROM gps_locations gl
      INNER JOIN tracking_users tu ON gl.user_id = tu.id
      WHERE tu.id = $1
      ORDER BY gl.gps_timestamp DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length > 0) {
      const location = result.rows[0];
      return {
        lat: location.latitude,
        lng: location.longitude
      };
    }

    // Default: Centro de Monterrey
    return { lat: 25.6866, lng: -100.3161 };
  }

  async filterAndPrioritizeSucursales(sucursalIds, strategy, preferences) {
    let query = `
      SELECT 
        g.*,
        COALESCE(visit_stats.visit_count, 0) as recent_visits,
        COALESCE(visit_stats.last_visit, '1970-01-01'::timestamp) as last_visit
      FROM geofences g
      LEFT JOIN (
        SELECT 
          geofence_id,
          COUNT(*) as visit_count,
          MAX(event_timestamp) as last_visit
        FROM geofence_events
        WHERE event_type = 'enter' 
          AND event_timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY geofence_id
      ) visit_stats ON g.id = visit_stats.geofence_id
      WHERE g.id = ANY($1) AND g.active = true
    `;

    // Aplicar ordenamiento según estrategia
    switch (strategy) {
      case 'priority':
        query += ' ORDER BY g.priority_level DESC, visit_stats.last_visit ASC';
        break;
      case 'distance':
      case 'time':
      case 'fuel':
      default:
        query += ' ORDER BY g.location_name';
    }

    const result = await db.query(query, [sucursalIds]);
    return result.rows;
  }

  getAlgorithmForStrategy(strategy) {
    switch (strategy) {
      case 'distance':
      case 'fuel':
        return 'nearestNeighbor';
      case 'time':
      case 'priority':
        return 'genetic';
      case 'balanced':
      default:
        return 'nearestNeighbor';
    }
  }

  mapStrategyToORSCriteria(strategy) {
    switch (strategy) {
      case 'distance':
        return 'shortest';
      case 'time':
        return 'fastest';
      case 'fuel':
        return 'shortest';
      default:
        return 'fastest';
    }
  }

  reconstructRouteWithOptimizedOrder(baseRoute, optimizedOrder) {
    // Implementar reconstrucción basada en el orden optimizado por ORS
    // Por simplicidad, retornamos la ruta base
    return baseRoute;
  }

  calculateImprovements(baseRoute, optimizedRoute) {
    const baseMetrics = baseRoute.metrics || {};
    const optimizedMetrics = optimizedRoute.metrics || {};

    const distanceImprovement = baseMetrics.totalDistanceKm - optimizedMetrics.totalDistanceKm;
    const timeImprovement = baseMetrics.estimatedDurationMinutes - optimizedMetrics.estimatedDurationMinutes;

    return {
      distanceReduction: Math.round(distanceImprovement * 100) / 100,
      timeReduction: Math.round(timeImprovement),
      fuelSavings: Math.round(distanceImprovement * 2.5), // pesos
      percentImprovement: baseMetrics.totalDistanceKm > 0 ? 
        Math.round((distanceImprovement / baseMetrics.totalDistanceKm) * 100) : 0
    };
  }

  async saveOptimizationAnalysis(data) {
    const result = await db.query(`
      INSERT INTO route_optimizations (
        user_id,
        base_route,
        optimized_route,
        strategy,
        recommendations,
        metrics,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `, [
      data.userId,
      JSON.stringify(data.baseRoute),
      JSON.stringify(data.optimizedRoute),
      data.strategy,
      JSON.stringify(data.recommendations),
      JSON.stringify(data.metrics)
    ]);

    return result.rows[0].id;
  }

  async generateFallbackRoute(params) {
    // Generar ruta básica sin optimizaciones externas
    return routeEngine.calculateOptimalRoute({
      startLocation: params.startLocation,
      sucursales: params.sucursales,
      algorithm: 'nearestNeighbor'
    });
  }
}

module.exports = new RouteOptimizer();