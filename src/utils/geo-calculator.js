/**
 * Utilidades para cálculos geográficos
 */

/**
 * Calcular distancia entre dos puntos usando fórmula de Haversine
 * Retorna distancia en metros
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  
  const φ1 = lat1 * Math.PI / 180; // φ, λ en radianes
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  const distance = R * c; // en metros
  
  return distance;
}

/**
 * Calcular bearing (dirección) entre dos puntos
 * Retorna ángulo en grados (0-360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  const θ = Math.atan2(y, x);
  
  const bearing = (θ * 180 / Math.PI + 360) % 360; // en grados
  
  return bearing;
}

/**
 * Validar que coordenadas estén dentro de México
 * Aproximado: lat: 14.5 a 32.5, lon: -118 a -86
 */
function isInMexico(lat, lon) {
  return (
    lat >= 14.5 && lat <= 32.5 &&
    lon >= -118 && lon <= -86
  );
}

/**
 * Validar que coordenadas estén cerca de Monterrey
 * Área metropolitana aproximada
 */
function isInMonterrey(lat, lon) {
  return (
    lat >= 25.4 && lat <= 25.9 &&
    lon >= -100.5 && lon <= -100.0
  );
}

/**
 * Calcular punto intermedio entre dos coordenadas
 */
function calculateMidpoint(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const Bx = Math.cos(φ2) * Math.cos(Δλ);
  const By = Math.cos(φ2) * Math.sin(Δλ);
  
  const φ3 = Math.atan2(Math.sin(φ1) + Math.sin(φ2),
                       Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By));
  const λ3 = (lon1 * Math.PI / 180) + Math.atan2(By, Math.cos(φ1) + Bx);
  
  return {
    lat: φ3 * 180 / Math.PI,
    lon: λ3 * 180 / Math.PI
  };
}

/**
 * Formatear coordenadas para mostrar
 */
function formatCoordinates(lat, lon, precision = 6) {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Convertir metros a formato legible
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

/**
 * Calcular velocidad entre dos puntos GPS
 * Retorna velocidad en km/h
 */
function calculateSpeed(lat1, lon1, timestamp1, lat2, lon2, timestamp2) {
  const distance = haversineDistance(lat1, lon1, lat2, lon2); // metros
  const timeSeconds = Math.abs(timestamp2 - timestamp1) / 1000; // segundos
  
  if (timeSeconds === 0) return 0;
  
  const speedMps = distance / timeSeconds; // metros por segundo
  const speedKmh = speedMps * 3.6; // km/h
  
  return speedKmh;
}

/**
 * Determinar si está en movimiento basado en velocidad
 */
function isMoving(speed, threshold = 5) {
  return speed > threshold; // km/h
}

/**
 * Calcular área aproximada de un polígono de coordenadas
 * Usando fórmula del Shoelace para área en proyección plana
 */
function calculatePolygonArea(coordinates) {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordinates[i].lat * coordinates[j].lon;
    area -= coordinates[j].lat * coordinates[i].lon;
  }
  
  area = Math.abs(area) / 2;
  
  // Convertir de grados cuadrados a metros cuadrados (aproximado)
  // 1 grado ≈ 111,320 metros en el ecuador
  const metersPerDegree = 111320;
  area *= metersPerDegree * metersPerDegree;
  
  return area;
}

/**
 * Crear círculo de puntos alrededor de un centro (para geofencing visual)
 */
function createCircle(centerLat, centerLon, radiusMeters, numPoints = 32) {
  const points = [];
  const R = 6371000; // Radio de la Tierra en metros
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    
    // Calcular punto en el círculo
    const lat = centerLat + (radiusMeters / R) * (180 / Math.PI) * Math.cos(angle);
    const lon = centerLon + (radiusMeters / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180);
    
    points.push({ lat, lon });
  }
  
  return points;
}

/**
 * Validar coordenadas GPS
 */
function validateGPSCoordinates(lat, lon) {
  const errors = [];
  
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    errors.push('Coordenadas deben ser números');
  }
  
  if (lat < -90 || lat > 90) {
    errors.push('Latitud debe estar entre -90 y 90');
  }
  
  if (lon < -180 || lon > 180) {
    errors.push('Longitud debe estar entre -180 y 180');
  }
  
  if (lat === 0 && lon === 0) {
    errors.push('Coordenadas (0,0) no son válidas');
  }
  
  // Validaciones específicas para México
  if (!isInMexico(lat, lon)) {
    errors.push('Coordenadas fuera de México');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  haversineDistance,
  calculateBearing,
  isInMexico,
  isInMonterrey,
  calculateMidpoint,
  formatCoordinates,
  formatDistance,
  calculateSpeed,
  isMoving,
  calculatePolygonArea,
  createCircle,
  validateGPSCoordinates
};