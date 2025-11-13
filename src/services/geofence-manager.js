const db = require('../config/database');
const geoCalculator = require('../utils/geo-calculator');
const visitDetector = require('./visit-detector');

/**
 * Gestor de geofencing y detección de visitas
 */
class GeofenceManager {
  
  /**
   * Verificar si ubicación está dentro de geofence
   */
  async checkGeofence(trackerId, email, lat, lon, timestamp) {
    try {
      console.log(`🔍 Verificando geofence: ${trackerId} @ ${lat}, ${lon}`);
      
      // 1. Obtener sucursales cercanas usando PostGIS
      const nearbyLocations = await this.getNearbyLocations(lat, lon);
      
      if (nearbyLocations.length === 0) {
        console.log(`📍 No hay sucursales cerca de ${lat}, ${lon}`);
        await this.handleGeofenceExit(trackerId, email, timestamp);
        return { inside: false };
      }
      
      let isInsideGeofence = false;
      let currentLocation = null;
      let distance = null;
      
      // 2. Verificar si está dentro del radio de alguna sucursal
      for (const location of nearbyLocations) {
        distance = geoCalculator.haversineDistance(
          lat, lon,
          parseFloat(location.latitude), 
          parseFloat(location.longitude)
        );
        
        console.log(`📏 Distancia a ${location.name}: ${Math.round(distance)}m (radio: ${location.geofence_radius}m)`);
        
        if (distance <= location.geofence_radius) {
          isInsideGeofence = true;
          currentLocation = location;
          break;
        }
      }
      
      if (isInsideGeofence) {
        // DENTRO DE GEOFENCE
        console.log(`✅ DENTRO de geofence: ${currentLocation.name}`);
        await this.handleGeofenceEntry(trackerId, email, currentLocation, lat, lon, timestamp, distance);
        
        return { 
          inside: true, 
          location: currentLocation,
          distance: Math.round(distance)
        };
      } else {
        // FUERA DE GEOFENCE
        console.log(`❌ FUERA de todas las geofences`);
        await this.handleGeofenceExit(trackerId, email, timestamp);
        
        return { 
          inside: false,
          nearest: nearbyLocations[0] ? {
            name: nearbyLocations[0].name,
            distance: Math.round(geoCalculator.haversineDistance(
              lat, lon,
              parseFloat(nearbyLocations[0].latitude),
              parseFloat(nearbyLocations[0].longitude)
            ))
          } : null
        };
      }
      
    } catch (error) {
      console.error('❌ Error en geofence check:', error.message);
      return { inside: false, error: error.message };
    }
  }
  
  /**
   * Obtener sucursales cercanas usando PostGIS
   */
  async getNearbyLocations(lat, lon, radiusKm = 1) {
    try {
      const result = await db.query(`
        SELECT 
          location_code,
          name,
          latitude,
          longitude,
          geofence_radius,
          group_name,
          ST_Distance(
            location_point,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
          ) as distance_degrees
        FROM tracking_locations_cache
        WHERE active = true
        ORDER BY location_point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
        LIMIT 5
      `, [lon, lat]);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo sucursales cercanas:', error.message);
      
      // Fallback sin PostGIS
      return await this.getNearbyLocationsFallback(lat, lon, radiusKm);
    }
  }
  
  /**
   * Fallback para sucursales cercanas sin PostGIS
   */
  async getNearbyLocationsFallback(lat, lon, radiusKm = 1) {
    try {
      const result = await db.query(`
        SELECT 
          location_code,
          name,
          latitude,
          longitude,
          geofence_radius,
          group_name,
          haversine_distance($1, $2, latitude, longitude) as distance_meters
        FROM tracking_locations_cache
        WHERE active = true
          AND haversine_distance($1, $2, latitude, longitude) <= $3
        ORDER BY distance_meters
        LIMIT 10
      `, [lat, lon, radiusKm * 1000]);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error en fallback de sucursales cercanas:', error.message);
      return [];
    }
  }
  
  /**
   * Manejar entrada a geofence
   */
  async handleGeofenceEntry(trackerId, email, location, lat, lon, timestamp, distance) {
    try {
      // Delegar a VisitDetector
      const result = await visitDetector.handleEntry(
        trackerId, 
        email, 
        location, 
        lat, 
        lon, 
        timestamp, 
        distance
      );
      
      console.log(`🟢 Resultado entrada: ${result.action} - ${result.message}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error manejando entrada a geofence:', error.message);
      return { action: 'error', message: error.message };
    }
  }
  
  /**
   * Manejar salida de geofence
   */
  async handleGeofenceExit(trackerId, email, timestamp) {
    try {
      // Delegar a VisitDetector
      const result = await visitDetector.handleExit(trackerId, email, timestamp);
      
      if (result.action !== 'none') {
        console.log(`🔴 Resultado salida: ${result.action} - ${result.message}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error manejando salida de geofence:', error.message);
      return { action: 'error', message: error.message };
    }
  }
  
  /**
   * Actualizar radio de geofence de una sucursal
   */
  async updateGeofenceRadius(locationCode, radiusMeters) {
    try {
      const result = await db.query(`
        UPDATE tracking_locations_cache
        SET geofence_radius = $1
        WHERE location_code = $2
      `, [radiusMeters, locationCode]);
      
      if (result.rowCount > 0) {
        console.log(`⚙️ Radio de geofence actualizado: ${locationCode} → ${radiusMeters}m`);
        return true;
      } else {
        console.log(`⚠️ Sucursal no encontrada: ${locationCode}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error actualizando radio de geofence:', error.message);
      return false;
    }
  }
  
  /**
   * Obtener estadísticas de geofencing
   */
  async getGeofenceStats(date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      const result = await db.query(`
        SELECT 
          COUNT(DISTINCT location_code) as sucursales_visitadas,
          COUNT(*) as total_entradas,
          COUNT(*) FILTER (WHERE exit_time IS NOT NULL) as visitas_completadas,
          COUNT(*) FILTER (WHERE exit_time IS NULL) as visitas_abiertas,
          ROUND(AVG(duration_minutes)::numeric, 0) as duracion_promedio
        FROM tracking_visits
        WHERE DATE(entry_time) = $1
      `, [dateStr]);
      
      const stats = result.rows[0];
      
      // Cobertura
      const coverageResult = await db.query(`
        SELECT COUNT(*) as total_sucursales
        FROM tracking_locations_cache
        WHERE active = true
      `);
      
      const totalSucursales = coverageResult.rows[0].total_sucursales;
      stats.cobertura_porcentaje = Math.round(
        (stats.sucursales_visitadas / totalSucursales) * 100
      );
      
      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de geofence:', error.message);
      return null;
    }
  }
  
  /**
   * Validar configuración de geofences
   */
  async validateGeofences() {
    try {
      const issues = [];
      
      // Verificar sucursales sin coordenadas
      const noCoords = await db.query(`
        SELECT location_code, name
        FROM tracking_locations_cache
        WHERE latitude IS NULL OR longitude IS NULL OR active = true
      `);
      
      if (noCoords.rows.length > 0) {
        issues.push(`❌ ${noCoords.rows.length} sucursales sin coordenadas`);
      }
      
      // Verificar radios de geofence muy pequeños o muy grandes
      const badRadius = await db.query(`
        SELECT location_code, name, geofence_radius
        FROM tracking_locations_cache
        WHERE geofence_radius < 50 OR geofence_radius > 500
          AND active = true
      `);
      
      if (badRadius.rows.length > 0) {
        issues.push(`⚠️ ${badRadius.rows.length} sucursales con radios inusuales`);
      }
      
      // Verificar sucursales muy cercanas (posible solapamiento)
      const overlapping = await db.query(`
        SELECT 
          l1.location_code as loc1,
          l1.name as name1,
          l2.location_code as loc2,
          l2.name as name2,
          haversine_distance(l1.latitude, l1.longitude, l2.latitude, l2.longitude) as distance
        FROM tracking_locations_cache l1
        CROSS JOIN tracking_locations_cache l2
        WHERE l1.location_code < l2.location_code
          AND l1.active = true AND l2.active = true
          AND haversine_distance(l1.latitude, l1.longitude, l2.latitude, l2.longitude) < 200
        ORDER BY distance
      `);
      
      if (overlapping.rows.length > 0) {
        issues.push(`⚠️ ${overlapping.rows.length} pares de sucursales muy cercanas`);
      }
      
      return {
        valid: issues.length === 0,
        issues,
        details: {
          no_coordinates: noCoords.rows,
          bad_radius: badRadius.rows,
          overlapping: overlapping.rows
        }
      };
    } catch (error) {
      console.error('❌ Error validando geofences:', error.message);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new GeofenceManager();