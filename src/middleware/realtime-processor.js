/**
 * Middleware para procesamiento en tiempo real
 * Se ejecuta automáticamente cuando llegan ubicaciones via OwnTracks y Traccar
 */

const geofenceEngine = require('../services/geofence-engine');

class RealTimeProcessor {
  constructor() {
    this.processingQueue = new Map();
    this.lastProcessed = new Map();
  }
  
  /**
   * Procesar ubicación inmediatamente cuando llega
   */
  async processLocationImmediate(locationData) {
    try {
      const userId = locationData.user_id;
      const now = Date.now();
      
      // Evitar procesamiento duplicado (debouncing)
      const lastProcessTime = this.lastProcessed.get(userId) || 0;
      if (now - lastProcessTime < 15000) { // 15 segundos mínimo
        return { processed: false, reason: 'Debouncing - muy reciente' };
      }
      
      console.log(`⚡ Procesamiento inmediato usuario ${userId}`);
      
      // Procesar con geofence-engine
      const events = await geofenceEngine.processLocation(locationData);
      
      // Actualizar timestamp de último procesamiento
      this.lastProcessed.set(userId, now);
      
      return {
        processed: true,
        events: events.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error procesamiento tiempo real:', error.message);
      return { processed: false, reason: error.message };
    }
  }
  
  /**
   * Obtener estadísticas de procesamiento
   */
  getStats() {
    return {
      usersInQueue: this.processingQueue.size,
      lastProcessedCount: this.lastProcessed.size,
      uptime: process.uptime()
    };
  }
}

const realTimeProcessor = new RealTimeProcessor();

module.exports = { 
  realTimeProcessor,
  
  // Middleware para expresss
  processLocationMiddleware: async (req, res, next) => {
    if (req.body && req.body.lat && req.body.lon) {
      // Procesar en paralelo (no bloquear response)
      setImmediate(async () => {
        await realTimeProcessor.processLocationImmediate({
          user_id: req.body.tid || req.body.topic?.split('/').pop(),
          latitude: req.body.lat,
          longitude: req.body.lon,
          accuracy: req.body.acc || 10,
          battery: req.body.batt || 100,
          velocity: req.body.vel || 0,
          gps_timestamp: new Date(req.body.tst * 1000)
        });
      });
    }
    next();
  }
};