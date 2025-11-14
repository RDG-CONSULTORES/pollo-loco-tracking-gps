const db = require('../config/database');

/**
 * Motor de Cálculo y Optimización de Rutas
 * Sistema inteligente para planificar rutas eficientes entre sucursales
 */
class RouteEngine {
  constructor() {
    this.earthRadiusKm = 6371; // Radio de la Tierra en km
    this.averageSpeedKmh = 40; // Velocidad promedio en ciudad (km/h)
    
    // Configuración de optimización
    this.config = {
      maxSucursalesPerRoute: 8,    // Máximo sucursales por ruta
      maxDistanceKm: 100,          // Distancia máxima total por ruta
      maxDurationMinutes: 480,     // Duración máxima por ruta (8 horas)
      preferredStartTime: 8,       // Hora preferida de inicio (8:00 AM)
      preferredEndTime: 18,        // Hora preferida de fin (6:00 PM)
      timePerVisitMinutes: 30,     // Tiempo promedio por visita
      algorithms: {
        nearestNeighbor: true,
        genetic: true,
        antColony: false  // Para implementación futura
      }
    };
  }

  /**
   * Calcular ruta optimizada entre múltiples sucursales
   * @param {Object} params - Parámetros de la ruta
   * @returns {Promise<Object>} - Ruta optimizada
   */
  async calculateOptimalRoute(params) {
    const {
      startLocation,      // { lat, lng } o sucursal_id
      sucursales,        // Array de IDs de sucursales a visitar
      algorithm = 'nearestNeighbor',
      constraints = {},
      preferences = {}
    } = params;

    try {
      console.log(`🛣️ Calculando ruta óptima para ${sucursales.length} sucursales...`);

      // 1. Obtener datos de sucursales
      const sucursalesData = await this.getSucursalesData(sucursales);
      
      // 2. Validar punto de inicio
      const startPoint = await this.resolveStartLocation(startLocation);
      
      // 3. Crear matriz de distancias
      const distanceMatrix = await this.buildDistanceMatrix(startPoint, sucursalesData);
      
      // 4. Aplicar algoritmo de optimización
      let optimizedRoute;
      switch (algorithm) {
        case 'genetic':
          optimizedRoute = await this.geneticAlgorithmTSP(distanceMatrix, sucursalesData, constraints);
          break;
        case 'nearestNeighbor':
        default:
          optimizedRoute = await this.nearestNeighborTSP(distanceMatrix, sucursalesData, constraints);
      }
      
      // 5. Calcular métricas de la ruta
      const routeMetrics = await this.calculateRouteMetrics(optimizedRoute, distanceMatrix);
      
      // 6. Generar instrucciones detalladas
      const directions = await this.generateDirections(optimizedRoute);
      
      // 7. Guardar ruta en base de datos
      const savedRoute = await this.saveRoute({
        ...optimizedRoute,
        ...routeMetrics,
        directions,
        algorithm,
        constraints,
        preferences
      });

      console.log(`✅ Ruta calculada: ${routeMetrics.totalDistanceKm.toFixed(1)}km, ${routeMetrics.estimatedDurationMinutes}min`);

      return {
        success: true,
        route: optimizedRoute,
        metrics: routeMetrics,
        directions: directions,
        routeId: savedRoute.id,
        algorithm: algorithm,
        calculatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error calculando ruta:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Algoritmo del Vecino Más Cercano (Nearest Neighbor TSP)
   * Rápido y eficiente para rutas pequeñas-medianas
   */
  async nearestNeighborTSP(distanceMatrix, sucursales, constraints = {}) {
    const visited = new Set();
    const route = [];
    let currentIndex = 0; // Empezar desde el punto inicial
    
    visited.add(0);
    
    while (visited.size < distanceMatrix.length) {
      let nearestDistance = Infinity;
      let nearestIndex = -1;
      
      // Encontrar la sucursal más cercana no visitada
      for (let i = 0; i < distanceMatrix.length; i++) {
        if (!visited.has(i) && distanceMatrix[currentIndex][i] < nearestDistance) {
          // Aplicar restricciones si las hay
          if (this.isValidNextStop(sucursales[i - 1], constraints)) {
            nearestDistance = distanceMatrix[currentIndex][i];
            nearestIndex = i;
          }
        }
      }
      
      if (nearestIndex !== -1) {
        visited.add(nearestIndex);
        if (nearestIndex > 0) { // No agregar el punto de inicio como destino
          route.push({
            sucursal: sucursales[nearestIndex - 1],
            distance: nearestDistance,
            cumulativeDistance: this.calculateCumulativeDistance(route, nearestDistance)
          });
        }
        currentIndex = nearestIndex;
      } else {
        break; // No hay más sucursales válidas
      }
    }
    
    return {
      waypoints: route,
      startPoint: { type: 'start', coordinates: distanceMatrix.startPoint },
      algorithm: 'nearestNeighbor'
    };
  }

  /**
   * Algoritmo Genético para TSP
   * Más preciso para rutas complejas con muchas restricciones
   */
  async geneticAlgorithmTSP(distanceMatrix, sucursales, constraints = {}) {
    const populationSize = 50;
    const generations = 100;
    const mutationRate = 0.01;
    const eliteSize = 10;
    
    console.log(`🧬 Ejecutando algoritmo genético: ${populationSize} población, ${generations} generaciones`);
    
    // Crear población inicial
    let population = this.createInitialPopulation(populationSize, sucursales.length);
    
    // Evolucionar por n generaciones
    for (let gen = 0; gen < generations; gen++) {
      // Evaluar fitness
      const fitness = population.map(individual => 
        1 / this.calculateRouteFitness(individual, distanceMatrix)
      );
      
      // Seleccionar elite
      const elite = this.selectElite(population, fitness, eliteSize);
      
      // Crear nueva generación
      const newPopulation = [...elite];
      
      while (newPopulation.length < populationSize) {
        const parent1 = this.tournamentSelection(population, fitness);
        const parent2 = this.tournamentSelection(population, fitness);
        const offspring = this.crossover(parent1, parent2);
        
        if (Math.random() < mutationRate) {
          this.mutate(offspring);
        }
        
        newPopulation.push(offspring);
      }
      
      population = newPopulation;
    }
    
    // Encontrar mejor solución
    const fitness = population.map(individual => 
      1 / this.calculateRouteFitness(individual, distanceMatrix)
    );
    const bestIndex = fitness.indexOf(Math.max(...fitness));
    const bestRoute = population[bestIndex];
    
    // Convertir a formato de ruta
    return this.formatGeneticRoute(bestRoute, sucursales, distanceMatrix);
  }

  /**
   * Calcular matriz de distancias entre todas las ubicaciones
   */
  async buildDistanceMatrix(startPoint, sucursales) {
    const locations = [startPoint, ...sucursales];
    const matrix = [];
    
    for (let i = 0; i < locations.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < locations.length; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          matrix[i][j] = this.calculateHaversineDistance(
            locations[i].latitude, locations[i].longitude,
            locations[j].latitude, locations[j].longitude
          );
        }
      }
    }
    
    matrix.startPoint = startPoint;
    return matrix;
  }

  /**
   * Calcular distancia Haversine entre dos puntos
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return this.earthRadiusKm * c;
  }

  /**
   * Calcular métricas completas de la ruta
   */
  async calculateRouteMetrics(route, distanceMatrix) {
    const waypoints = route.waypoints || [];
    
    let totalDistanceKm = 0;
    let totalDrivingTimeMinutes = 0;
    let totalVisitTimeMinutes = waypoints.length * this.config.timePerVisitMinutes;
    
    // Sumar distancias y tiempos
    waypoints.forEach(waypoint => {
      totalDistanceKm += waypoint.distance || 0;
      totalDrivingTimeMinutes += (waypoint.distance || 0) / this.averageSpeedKmh * 60;
    });
    
    const estimatedDurationMinutes = totalDrivingTimeMinutes + totalVisitTimeMinutes;
    const estimatedFuelCostMXN = totalDistanceKm * 2.5; // Estimación 2.5 pesos por km
    
    // Calcular eficiencia
    const efficiency = this.calculateRouteEfficiency(totalDistanceKm, waypoints.length);
    
    return {
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalDrivingTimeMinutes: Math.round(totalDrivingTimeMinutes),
      totalVisitTimeMinutes,
      estimatedDurationMinutes: Math.round(estimatedDurationMinutes),
      estimatedFuelCostMXN: Math.round(estimatedFuelCostMXN),
      efficiency: efficiency,
      sucursalesCount: waypoints.length,
      averageDistancePerStop: waypoints.length > 0 ? totalDistanceKm / waypoints.length : 0
    };
  }

  /**
   * Calcular eficiencia de la ruta (0-100%)
   */
  calculateRouteEfficiency(totalDistanceKm, sucursalesCount) {
    if (sucursalesCount === 0) return 0;
    
    // Distancia teórica mínima (línea recta promedio)
    const theoreticalMinDistance = sucursalesCount * 2; // 2km promedio entre sucursales
    const efficiency = Math.max(0, Math.min(100, 
      (theoreticalMinDistance / totalDistanceKm) * 100
    ));
    
    return Math.round(efficiency);
  }

  /**
   * Generar instrucciones detalladas de navegación
   */
  async generateDirections(route) {
    const directions = [];
    const waypoints = route.waypoints || [];
    
    let stepNumber = 1;
    let currentLocation = route.startPoint;
    
    for (const waypoint of waypoints) {
      const sucursal = waypoint.sucursal;
      const distance = waypoint.distance;
      const estimatedMinutes = Math.round(distance / this.averageSpeedKmh * 60);
      
      directions.push({
        step: stepNumber++,
        type: 'drive',
        instruction: `Dirigirse a ${sucursal.location_name}`,
        from: currentLocation,
        to: {
          latitude: sucursal.latitude,
          longitude: sucursal.longitude,
          name: sucursal.location_name,
          address: sucursal.address || 'N/A'
        },
        distance: `${distance.toFixed(1)} km`,
        estimatedTime: `${estimatedMinutes} min`,
        coordinates: {
          lat: sucursal.latitude,
          lng: sucursal.longitude
        }
      });
      
      directions.push({
        step: stepNumber++,
        type: 'visit',
        instruction: `Visitar sucursal ${sucursal.location_code}`,
        location: sucursal.location_name,
        estimatedTime: `${this.config.timePerVisitMinutes} min`,
        notes: `Realizar auditoría/supervisión en ${sucursal.location_name}`
      });
      
      currentLocation = {
        latitude: sucursal.latitude,
        longitude: sucursal.longitude,
        name: sucursal.location_name
      };
    }
    
    return directions;
  }

  /**
   * Obtener datos de sucursales desde la base de datos
   */
  async getSucursalesData(sucursalIds) {
    const result = await db.query(`
      SELECT 
        id,
        location_code,
        location_name,
        grupo,
        latitude,
        longitude,
        address,
        active,
        priority_level
      FROM geofences 
      WHERE id = ANY($1) AND active = true
      ORDER BY priority_level DESC, location_name
    `, [sucursalIds]);
    
    return result.rows;
  }

  /**
   * Resolver ubicación de inicio
   */
  async resolveStartLocation(startLocation) {
    if (typeof startLocation === 'object' && startLocation.lat && startLocation.lng) {
      return {
        latitude: startLocation.lat,
        longitude: startLocation.lng,
        name: 'Ubicación de inicio',
        type: 'custom'
      };
    }
    
    if (typeof startLocation === 'number') {
      // Es un ID de sucursal
      const result = await db.query(`
        SELECT latitude, longitude, location_name
        FROM geofences 
        WHERE id = $1 AND active = true
      `, [startLocation]);
      
      if (result.rows.length > 0) {
        const sucursal = result.rows[0];
        return {
          latitude: sucursal.latitude,
          longitude: sucursal.longitude,
          name: sucursal.location_name,
          type: 'sucursal'
        };
      }
    }
    
    // Default: Centro de Monterrey
    return {
      latitude: 25.6866,
      longitude: -100.3161,
      name: 'Centro de Monterrey',
      type: 'default'
    };
  }

  /**
   * Validar si una parada es válida según las restricciones
   */
  isValidNextStop(sucursal, constraints) {
    // Verificar horarios de operación
    if (constraints.businessHours) {
      const now = new Date();
      const hour = now.getHours();
      if (hour < constraints.businessHours.start || hour > constraints.businessHours.end) {
        return false;
      }
    }
    
    // Verificar grupo específico
    if (constraints.grupo && sucursal.grupo !== constraints.grupo) {
      return false;
    }
    
    // Verificar prioridad mínima
    if (constraints.minPriority && sucursal.priority_level < constraints.minPriority) {
      return false;
    }
    
    return true;
  }

  /**
   * Guardar ruta en base de datos
   */
  async saveRoute(routeData) {
    const result = await db.query(`
      INSERT INTO calculated_routes (
        waypoints,
        metrics,
        directions,
        algorithm,
        constraints,
        preferences,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'calculated', NOW())
      RETURNING id
    `, [
      JSON.stringify(routeData.waypoints),
      JSON.stringify(routeData),
      JSON.stringify(routeData.directions),
      routeData.algorithm,
      JSON.stringify(routeData.constraints),
      JSON.stringify(routeData.preferences)
    ]);
    
    return result.rows[0];
  }

  /**
   * Obtener rutas guardadas
   */
  async getSavedRoutes(filters = {}) {
    let query = `
      SELECT 
        id,
        waypoints,
        metrics,
        directions,
        algorithm,
        status,
        created_at
      FROM calculated_routes
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }
    
    if (filters.algorithm) {
      params.push(filters.algorithm);
      query += ` AND algorithm = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT 20`;
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Funciones auxiliares
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  calculateCumulativeDistance(route, newDistance) {
    const total = route.reduce((sum, waypoint) => sum + waypoint.distance, 0);
    return total + newDistance;
  }

  // Funciones para algoritmo genético
  createInitialPopulation(size, length) {
    const population = [];
    for (let i = 0; i < size; i++) {
      const individual = Array.from({length}, (_, i) => i).slice(1); // Excluir punto de inicio
      this.shuffleArray(individual);
      population.push(individual);
    }
    return population;
  }

  calculateRouteFitness(individual, distanceMatrix) {
    let totalDistance = distanceMatrix[0][individual[0] + 1]; // Desde inicio al primer punto
    
    for (let i = 0; i < individual.length - 1; i++) {
      totalDistance += distanceMatrix[individual[i] + 1][individual[i + 1] + 1];
    }
    
    return totalDistance;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  tournamentSelection(population, fitness, tournamentSize = 3) {
    let best = Math.floor(Math.random() * population.length);
    for (let i = 0; i < tournamentSize - 1; i++) {
      const competitor = Math.floor(Math.random() * population.length);
      if (fitness[competitor] > fitness[best]) {
        best = competitor;
      }
    }
    return population[best];
  }

  crossover(parent1, parent2) {
    const start = Math.floor(Math.random() * parent1.length);
    const end = Math.floor(Math.random() * (parent1.length - start)) + start;
    
    const offspring = new Array(parent1.length);
    const segment = parent1.slice(start, end);
    
    // Copiar segmento
    for (let i = start; i < end; i++) {
      offspring[i] = parent1[i];
    }
    
    // Llenar el resto con parent2
    let j = 0;
    for (let i = 0; i < offspring.length; i++) {
      if (offspring[i] === undefined) {
        while (segment.includes(parent2[j])) {
          j++;
        }
        offspring[i] = parent2[j];
        j++;
      }
    }
    
    return offspring;
  }

  mutate(individual) {
    const i = Math.floor(Math.random() * individual.length);
    const j = Math.floor(Math.random() * individual.length);
    [individual[i], individual[j]] = [individual[j], individual[i]];
  }

  selectElite(population, fitness, eliteSize) {
    const indexed = fitness.map((f, i) => ({fitness: f, index: i}));
    indexed.sort((a, b) => b.fitness - a.fitness);
    return indexed.slice(0, eliteSize).map(item => population[item.index]);
  }

  formatGeneticRoute(bestRoute, sucursales, distanceMatrix) {
    const waypoints = [];
    let currentIndex = 0;
    
    for (const sucursalIndex of bestRoute) {
      const distance = distanceMatrix[currentIndex][sucursalIndex + 1];
      waypoints.push({
        sucursal: sucursales[sucursalIndex],
        distance: distance,
        cumulativeDistance: this.calculateCumulativeDistance(waypoints, distance)
      });
      currentIndex = sucursalIndex + 1;
    }
    
    return {
      waypoints: waypoints,
      startPoint: distanceMatrix.startPoint,
      algorithm: 'genetic'
    };
  }
}

module.exports = new RouteEngine();