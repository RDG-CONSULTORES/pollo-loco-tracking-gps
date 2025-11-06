const db = require('../config/database');
const { getVisitType, formatDuration } = require('../config/constants');

/**
 * Detector de visitas - Maneja lógica de entrada/salida
 */
class VisitDetector {
  
  /**
   * Manejar entrada a geofence
   */
  async handleEntry(trackerId, email, location, lat, lon, timestamp, distance) {
    try {
      // Verificar si ya hay una visita abierta para esta sucursal
      const openVisit = await this.getOpenVisit(trackerId, location.location_code);
      
      if (openVisit) {
        console.log(`⏳ Visita ya en progreso: ${trackerId} @ ${location.name}`);
        
        // Actualizar ubicación de entrada (más precisa)
        if (distance < 50) { // Si estamos más cerca, actualizar
          await this.updateEntryLocation(openVisit.id, lat, lon);
        }
        
        return {
          action: 'update',
          message: `Visita en progreso (${this.getElapsedTime(openVisit.entrada_at)})`
        };
      }
      
      // Verificar si hay otras visitas abiertas (diferentes sucursales)
      const otherOpenVisits = await this.getOpenVisits(trackerId);
      
      if (otherOpenVisits.length > 0) {
        console.log(`⚠️ Cerrando ${otherOpenVisits.length} visitas abiertas antes de nueva entrada`);
        
        // Cerrar visitas anteriores con ubicación actual
        for (const visit of otherOpenVisits) {
          await this.closeVisit(visit.id, timestamp, lat, lon);
          console.log(`🔴 Visita cerrada automáticamente: ${visit.location_code}`);
        }
      }
      
      // Crear nueva visita (ENTRADA)
      const visitId = await this.createVisit(trackerId, email, location, lat, lon, timestamp);
      
      if (visitId) {
        console.log(`✅ ENTRADA registrada: ${trackerId} → ${location.name} (${Math.round(distance)}m)`);
        
        return {
          action: 'entry',
          message: `Entrada a ${location.name}`,
          visit_id: visitId
        };
      } else {
        return {
          action: 'error',
          message: 'Error creando visita'
        };
      }
      
    } catch (error) {
      console.error('❌ Error en handleEntry:', error.message);
      return {
        action: 'error',
        message: error.message
      };
    }
  }
  
  /**
   * Manejar salida de geofence
   */
  async handleExit(trackerId, email, timestamp) {
    try {
      // Buscar visitas abiertas
      const openVisits = await this.getOpenVisits(trackerId);
      
      if (openVisits.length === 0) {
        // No hay visitas abiertas, normal
        return {
          action: 'none',
          message: 'Sin visitas abiertas'
        };
      }
      
      let closedVisits = 0;
      
      // Cerrar todas las visitas abiertas (SALIDA)
      for (const visit of openVisits) {
        const success = await this.closeVisit(visit.id, timestamp);
        
        if (success) {
          const duration = this.calculateDuration(visit.entrada_at, timestamp);
          console.log(`✅ SALIDA registrada: ${trackerId} ← ${visit.location_code} (${formatDuration(duration)})`);
          closedVisits++;
        }
      }
      
      if (closedVisits > 0) {
        return {
          action: 'exit',
          message: `${closedVisits} visita(s) cerrada(s)`,
          closed_visits: closedVisits
        };
      } else {
        return {
          action: 'error',
          message: 'Error cerrando visitas'
        };
      }
      
    } catch (error) {
      console.error('❌ Error en handleExit:', error.message);
      return {
        action: 'error',
        message: error.message
      };
    }
  }
  
  /**
   * Crear nueva visita
   */
  async createVisit(trackerId, email, location, lat, lon, timestamp) {
    try {
      const result = await db.query(`
        INSERT INTO tracking_visits 
        (tracker_id, zenput_email, location_code, entrada_at, entrada_lat, entrada_lon)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [trackerId, email, location.location_code, timestamp, lat, lon]);
      
      return result.rows[0]?.id;
    } catch (error) {
      console.error('❌ Error creando visita:', error.message);
      return null;
    }
  }
  
  /**
   * Cerrar visita existente
   */
  async closeVisit(visitId, timestamp, exitLat = null, exitLon = null) {
    try {
      const result = await db.query(`
        UPDATE tracking_visits
        SET 
          salida_at = $1,
          salida_lat = $2,
          salida_lon = $3
        WHERE id = $4
          AND salida_at IS NULL
      `, [timestamp, exitLat, exitLon, visitId]);
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('❌ Error cerrando visita:', error.message);
      return false;
    }
  }
  
  /**
   * Actualizar ubicación de entrada (más precisa)
   */
  async updateEntryLocation(visitId, lat, lon) {
    try {
      await db.query(`
        UPDATE tracking_visits
        SET entrada_lat = $1, entrada_lon = $2
        WHERE id = $3
      `, [lat, lon, visitId]);
      
      return true;
    } catch (error) {
      console.error('❌ Error actualizando ubicación de entrada:', error.message);
      return false;
    }
  }
  
  /**
   * Obtener visita abierta para ubicación específica
   */
  async getOpenVisit(trackerId, locationCode) {
    try {
      const result = await db.query(`
        SELECT id, entrada_at, location_code
        FROM tracking_visits
        WHERE tracker_id = $1
          AND location_code = $2
          AND salida_at IS NULL
        ORDER BY entrada_at DESC
        LIMIT 1
      `, [trackerId, locationCode]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo visita abierta:', error.message);
      return null;
    }
  }
  
  /**
   * Obtener todas las visitas abiertas de un usuario
   */
  async getOpenVisits(trackerId) {
    try {
      const result = await db.query(`
        SELECT id, entrada_at, location_code
        FROM tracking_visits
        WHERE tracker_id = $1
          AND salida_at IS NULL
        ORDER BY entrada_at DESC
      `, [trackerId]);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo visitas abiertas:', error.message);
      return [];
    }
  }
  
  /**
   * Calcular duración entre dos timestamps
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end - start) / (1000 * 60)); // minutos
  }
  
  /**
   * Obtener tiempo transcurrido desde entrada
   */
  getElapsedTime(startTime) {
    const elapsed = this.calculateDuration(startTime, new Date());
    return formatDuration(elapsed);
  }
  
  /**
   * Obtener visitas del día
   */
  async getTodayVisits(trackerId = null) {
    try {
      let query = `
        SELECT 
          v.*,
          lc.name as location_name,
          tu.display_name as supervisor_name
        FROM tracking_visits v
        LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code
        LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
        WHERE DATE(v.entrada_at) = CURRENT_DATE
      `;
      
      const params = [];
      
      if (trackerId) {
        query += ' AND v.tracker_id = $1';
        params.push(trackerId);
      }
      
      query += ' ORDER BY v.entrada_at DESC';
      
      const result = await db.query(query, params);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo visitas del día:', error.message);
      return [];
    }
  }
  
  /**
   * Limpiar visitas inválidas (muy cortas o inconsistentes)
   */
  async cleanupInvalidVisits() {
    try {
      // Marcar visitas muy cortas como inválidas
      const shortVisits = await db.query(`
        UPDATE tracking_visits
        SET is_valid = false, visit_type = 'invalid'
        WHERE salida_at IS NOT NULL
          AND duracion_minutos < 5
          AND is_valid = true
      `);
      
      // Marcar visitas sin salida muy antiguas como inválidas
      const oldOpenVisits = await db.query(`
        UPDATE tracking_visits
        SET is_valid = false, visit_type = 'invalid'
        WHERE salida_at IS NULL
          AND entrada_at < NOW() - INTERVAL '24 hours'
          AND is_valid = true
      `);
      
      console.log(`🧹 Limpieza de visitas: ${shortVisits.rowCount} cortas, ${oldOpenVisits.rowCount} antiguas`);
      
      return {
        short_visits: shortVisits.rowCount,
        old_open_visits: oldOpenVisits.rowCount
      };
    } catch (error) {
      console.error('❌ Error limpiando visitas inválidas:', error.message);
      return { error: error.message };
    }
  }
  
  /**
   * Forzar cierre de visitas abiertas (para mantenimiento)
   */
  async forceCloseOpenVisits(trackerId = null) {
    try {
      let query = `
        UPDATE tracking_visits
        SET 
          salida_at = entrada_at + INTERVAL '1 hour',
          notes = COALESCE(notes, '') || ' [Cerrada automáticamente]'
        WHERE salida_at IS NULL
      `;
      
      const params = [];
      
      if (trackerId) {
        query += ' AND tracker_id = $1';
        params.push(trackerId);
      }
      
      const result = await db.query(query, params);
      
      console.log(`🔧 Visitas cerradas forzadamente: ${result.rowCount}`);
      
      return result.rowCount;
    } catch (error) {
      console.error('❌ Error cerrando visitas forzadamente:', error.message);
      return 0;
    }
  }
}

module.exports = new VisitDetector();