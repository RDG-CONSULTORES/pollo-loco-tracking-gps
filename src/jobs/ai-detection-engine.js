/**
 * Motor de IA para detección exacta sin depender de configuración OwnTracks
 * 
 * ESTRATEGIAS:
 * 1. Predicción de movimiento
 * 2. Interpolación inteligente  
 * 3. Detección de patrones
 * 4. Análisis de velocidad/aceleración
 */

const cron = require('node-cron');
const { Pool } = require('pg');

class AIDetectionEngine {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.userStates = new Map(); // Cache de estados de usuarios
    this.movementPredictions = new Map(); // Predicciones de movimiento
  }
  
  /**
   * ESTRATEGIA 1: Predicción de movimiento
   * Predice dónde estará el usuario basado en historial reciente
   */
  async predictMovement(userId) {
    try {
      // Obtener últimas 5 ubicaciones
      const locations = await this.pool.query(`
        SELECT latitude, longitude, gps_timestamp, velocity, accuracy
        FROM gps_locations
        WHERE user_id = $1
          AND gps_timestamp >= NOW() - INTERVAL '20 minutes'
        ORDER BY gps_timestamp DESC
        LIMIT 5
      `, [userId]);
      
      if (locations.rows.length < 2) return null;
      
      const recent = locations.rows;
      const latest = recent[0];
      const previous = recent[1];
      
      // Calcular velocidad y dirección
      const timeDiff = (new Date(latest.gps_timestamp) - new Date(previous.gps_timestamp)) / 1000;
      const distance = this.calculateDistance(
        previous.latitude, previous.longitude,
        latest.latitude, latest.longitude
      );
      
      const speed = distance / timeDiff; // m/s
      
      // Si se está moviendo rápido, predecir próxima posición
      if (speed > 0.5) { // >0.5 m/s = caminando
        const bearing = this.calculateBearing(
          previous.latitude, previous.longitude,
          latest.latitude, latest.longitude
        );
        
        // Predecir posición en 30 segundos
        const predictedLocation = this.projectLocation(
          latest.latitude, latest.longitude,
          bearing, speed * 30 // 30 segundos adelante
        );
        
        console.log(`🔮 Usuario ${userId}: Predicción movimiento`);
        console.log(`   📍 Actual: ${latest.latitude}, ${latest.longitude}`);
        console.log(`   🎯 Predicción 30s: ${predictedLocation.lat}, ${predictedLocation.lng}`);
        console.log(`   ⚡ Velocidad: ${(speed * 3.6).toFixed(1)} km/h`);
        
        return predictedLocation;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Error predicción usuario ${userId}:`, error.message);
      return null;
    }
  }
  
  /**
   * ESTRATEGIA 2: Interpolación inteligente
   * Cuando hay gap >2 minutos, interpola posiciones intermedias
   */
  async interpolateMovement(userId) {
    try {
      const locations = await this.pool.query(`
        SELECT latitude, longitude, gps_timestamp
        FROM gps_locations
        WHERE user_id = $1
        ORDER BY gps_timestamp DESC
        LIMIT 2
      `, [userId]);
      
      if (locations.rows.length < 2) return [];
      
      const [current, previous] = locations.rows;
      const timeDiff = (new Date(current.gps_timestamp) - new Date(previous.gps_timestamp)) / 1000;
      
      // Si hay gap >2 minutos, interpolar
      if (timeDiff > 120) {
        const interpolated = [];
        const steps = Math.min(Math.floor(timeDiff / 30), 10); // Max 10 puntos
        
        for (let i = 1; i < steps; i++) {
          const ratio = i / steps;
          const interpLat = previous.latitude + (current.latitude - previous.latitude) * ratio;
          const interpLng = previous.longitude + (current.longitude - previous.longitude) * ratio;
          const interpTime = new Date(new Date(previous.gps_timestamp).getTime() + (timeDiff * 1000 * ratio));
          
          interpolated.push({
            latitude: interpLat,
            longitude: interpLng,
            gps_timestamp: interpTime,
            interpolated: true
          });
        }
        
        console.log(`📐 Usuario ${userId}: ${interpolated.length} puntos interpolados`);
        return interpolated;
      }
      
      return [];
      
    } catch (error) {
      console.error(`❌ Error interpolación usuario ${userId}:`, error.message);
      return [];
    }
  }
  
  /**
   * ESTRATEGIA 3: Análisis de patrones de entrada/salida
   * Aprende horarios típicos del usuario para anticipar movimientos
   */
  async analyzeUserPatterns(userId) {
    try {
      // Obtener historial de eventos geofence últimos 7 días
      const events = await this.pool.query(`
        SELECT event_type, event_timestamp, location_name
        FROM geofence_events
        WHERE user_id = $1
          AND event_timestamp >= NOW() - INTERVAL '7 days'
        ORDER BY event_timestamp DESC
      `, [userId]);
      
      if (events.rows.length < 5) return null;
      
      const patterns = {
        entryTimes: [],
        exitTimes: [],
        avgStayDuration: 0
      };
      
      // Analizar horarios de entrada
      const entries = events.rows.filter(e => e.event_type === 'ENTRY');
      const exits = events.rows.filter(e => e.event_type === 'EXIT');
      
      entries.forEach(entry => {
        const hour = new Date(entry.event_timestamp).getHours();
        patterns.entryTimes.push(hour);
      });
      
      exits.forEach(exit => {
        const hour = new Date(exit.event_timestamp).getHours();
        patterns.exitTimes.push(hour);
      });
      
      // Calcular horario más probable de próximo movimiento
      const currentHour = new Date().getHours();
      
      // Si está cerca del horario típico de entrada/salida, aumentar frecuencia
      const nearEntryTime = patterns.entryTimes.some(h => Math.abs(h - currentHour) <= 1);
      const nearExitTime = patterns.exitTimes.some(h => Math.abs(h - currentHour) <= 1);
      
      if (nearEntryTime || nearExitTime) {
        console.log(`⏰ Usuario ${userId}: Horario típico de movimiento`);
        return { highProbability: true, type: nearEntryTime ? 'ENTRY' : 'EXIT' };
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Error análisis patrones usuario ${userId}:`, error.message);
      return null;
    }
  }
  
  /**
   * ESTRATEGIA 4: Super scheduler inteligente
   * Ajusta frecuencia basado en contexto del usuario
   */
  async intelligentScheduling() {
    try {
      console.log('🧠 Análisis inteligente usuarios...');
      
      // Obtener todos los usuarios activos
      const users = await this.pool.query(`
        SELECT DISTINCT user_id, MAX(gps_timestamp) as last_gps
        FROM gps_locations
        WHERE gps_timestamp >= NOW() - INTERVAL '30 minutes'
        GROUP BY user_id
      `);
      
      for (const user of users.rows) {
        const userId = user.user_id;
        
        // 1. Verificar predicción de movimiento
        const prediction = await this.predictMovement(userId);
        
        // 2. Analizar patrones temporales
        const patterns = await this.analyzeUserPatterns(userId);
        
        // 3. Crear puntos interpolados si hay gaps
        const interpolated = await this.interpolateMovement(userId);
        
        // 4. Determinar estrategia de detección
        let strategy = 'normal'; // cada 30s
        
        if (prediction || (patterns && patterns.highProbability)) {
          strategy = 'intensive'; // cada 10s
          console.log(`⚡ Usuario ${userId}: Estrategia INTENSIVA (10s)`);
        } else if (interpolated.length > 0) {
          strategy = 'enhanced'; // cada 15s
          console.log(`📐 Usuario ${userId}: Estrategia MEJORADA (15s)`);
        }
        
        // 5. Procesar con estrategia determinada
        await this.processWithStrategy(userId, strategy);
      }
      
    } catch (error) {
      console.error('❌ Error scheduling inteligente:', error.message);
    }
  }
  
  /**
   * Procesar usuario con estrategia específica
   */
  async processWithStrategy(userId, strategy) {
    try {
      // Obtener ubicación más reciente
      const location = await this.pool.query(`
        SELECT latitude, longitude, gps_timestamp, accuracy
        FROM gps_locations
        WHERE user_id = $1
        ORDER BY gps_timestamp DESC
        LIMIT 1
      `, [userId]);
      
      if (location.rows.length === 0) return;
      
      const loc = location.rows[0];
      const locationAge = (new Date() - new Date(loc.gps_timestamp)) / 1000;
      
      // Solo procesar si no es muy viejo
      const maxAge = strategy === 'intensive' ? 600 : 900; // 10min o 15min
      
      if (locationAge <= maxAge) {
        const geofenceEngine = require('../services/geofence-engine');
        
        const events = await geofenceEngine.processLocation({
          id: Date.now() + userId,
          user_id: userId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || 10,
          battery: 100,
          gps_timestamp: loc.gps_timestamp
        });
        
        if (events.length > 0) {
          console.log(`🎯 Usuario ${userId} (${strategy}): ${events.length} eventos`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error procesando usuario ${userId}:`, error.message);
    }
  }
  
  // Utilidades matemáticas
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }
  
  calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = this.toRadians(lng2 - lng1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    return Math.atan2(y, x);
  }
  
  projectLocation(lat, lng, bearing, distance) {
    const R = 6371000;
    const latRad = this.toRadians(lat);
    const lngRad = this.toRadians(lng);
    
    const newLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(distance / R) +
      Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearing)
    );
    
    const newLngRad = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(distance / R) * Math.cos(latRad),
      Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad)
    );
    
    return {
      lat: this.toDegrees(newLatRad),
      lng: this.toDegrees(newLngRad)
    };
  }
  
  toRadians(degrees) { return degrees * (Math.PI / 180); }
  toDegrees(radians) { return radians * (180 / Math.PI); }
}

// Job principal con IA - cada 10 segundos
const aiEngine = new AIDetectionEngine();

const aiDetectionJob = cron.schedule('*/10 * * * * *', async () => {
  await aiEngine.intelligentScheduling();
}, {
  scheduled: true
});

console.log('🧠 Motor de IA iniciado - análisis cada 10 segundos');

module.exports = { aiEngine, aiDetectionJob };