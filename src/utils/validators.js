/**
 * Funciones de validación para el sistema de tracking
 */

/**
 * Validar payload de OwnTracks
 */
function validateOwnTracksPayload(payload) {
  const errors = [];
  
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload debe ser un objeto JSON');
    return { valid: false, errors };
  }
  
  const { _type, tid, lat, lon, tst, acc } = payload;
  
  // Validar tipo de mensaje
  if (_type && _type !== 'location') {
    errors.push(`Tipo de mensaje no soportado: ${_type}`);
  }
  
  // Validar tracker ID
  if (!tid) {
    errors.push('Tracker ID (tid) requerido');
  } else if (typeof tid !== 'string' || tid.length < 1 || tid.length > 10) {
    errors.push('Tracker ID debe ser string de 1-10 caracteres');
  }
  
  // Validar coordenadas
  if (lat === undefined || lat === null) {
    errors.push('Latitud (lat) requerida');
  } else if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    errors.push('Latitud debe ser número entre -90 y 90');
  }
  
  if (lon === undefined || lon === null) {
    errors.push('Longitud (lon) requerida');
  } else if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    errors.push('Longitud debe ser número entre -180 y 180');
  }
  
  // Validar timestamp
  if (!tst) {
    errors.push('Timestamp (tst) requerido');
  } else if (typeof tst !== 'number' || tst < 0) {
    errors.push('Timestamp debe ser número positivo (Unix timestamp)');
  }
  
  // Validar precisión (opcional)
  if (acc !== undefined && (typeof acc !== 'number' || acc < 0)) {
    errors.push('Precisión (acc) debe ser número positivo');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validar datos de usuario para creación/actualización
 */
function validateUserData(userData) {
  const errors = [];
  
  const { tracker_id, zenput_email, display_name, phone } = userData;
  
  // Validar tracker ID
  if (!tracker_id) {
    errors.push('Tracker ID requerido');
  } else {
    const tidRegex = /^[A-Z0-9]{1,10}$/;
    if (!tidRegex.test(tracker_id)) {
      errors.push('Tracker ID debe ser 1-10 caracteres alfanuméricos en mayúsculas');
    }
  }
  
  // Validar email
  if (!zenput_email) {
    errors.push('Email Zenput requerido');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(zenput_email)) {
      errors.push('Email debe tener formato válido');
    }
  }
  
  // Validar nombre
  if (!display_name) {
    errors.push('Nombre completo requerido');
  } else if (display_name.length < 2 || display_name.length > 100) {
    errors.push('Nombre debe tener entre 2 y 100 caracteres');
  }
  
  // Validar teléfono (opcional)
  if (phone && phone.length > 0) {
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{8,20}$/;
    if (!phoneRegex.test(phone)) {
      errors.push('Teléfono debe tener formato válido');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validar configuración del sistema
 */
function validateSystemConfig(key, value, dataType) {
  const errors = [];
  
  switch (dataType) {
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        errors.push('Valor boolean debe ser "true" o "false"');
      }
      break;
      
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) {
        errors.push('Valor debe ser un número válido');
      }
      break;
      
    case 'time':
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(value)) {
        errors.push('Tiempo debe tener formato HH:mm (ej: 07:30)');
      }
      break;
      
    case 'string':
      if (typeof value !== 'string') {
        errors.push('Valor debe ser una cadena de texto');
      }
      break;
  }
  
  // Validaciones específicas por clave
  switch (key) {
    case 'work_hours_start':
    case 'work_hours_end':
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(value)) {
        errors.push('Horario debe tener formato HH:mm (ej: 07:30)');
      }
      break;
      
    case 'work_days':
      const days = value.split(',').map(d => parseInt(d.trim()));
      if (days.some(d => isNaN(d) || d < 0 || d > 6)) {
        errors.push('Días laborales deben ser números 0-6 separados por comas (0=Dom, 6=Sáb)');
      }
      break;
      
    case 'geofence_radius_meters':
      const radius = parseInt(value);
      if (radius < 50 || radius > 1000) {
        errors.push('Radio de geofence debe estar entre 50 y 1000 metros');
      }
      break;
      
    case 'gps_accuracy_threshold':
      const accuracy = parseInt(value);
      if (accuracy < 5 || accuracy > 500) {
        errors.push('Umbral de precisión GPS debe estar entre 5 y 500 metros');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validar datos de sucursal
 */
function validateLocationData(locationData) {
  const errors = [];
  
  const { location_code, name, latitude, longitude, geofence_radius } = locationData;
  
  // Validar código
  if (!location_code) {
    errors.push('Código de sucursal requerido');
  } else if (location_code.length < 1 || location_code.length > 20) {
    errors.push('Código debe tener entre 1 y 20 caracteres');
  }
  
  // Validar nombre
  if (!name) {
    errors.push('Nombre de sucursal requerido');
  } else if (name.length < 2 || name.length > 200) {
    errors.push('Nombre debe tener entre 2 y 200 caracteres');
  }
  
  // Validar coordenadas
  if (latitude === undefined || latitude === null) {
    errors.push('Latitud requerida');
  } else if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    errors.push('Latitud debe ser número entre -90 y 90');
  }
  
  if (longitude === undefined || longitude === null) {
    errors.push('Longitud requerida');
  } else if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    errors.push('Longitud debe ser número entre -180 y 180');
  }
  
  // Validar radio de geofence (opcional)
  if (geofence_radius !== undefined) {
    const radius = parseInt(geofence_radius);
    if (isNaN(radius) || radius < 50 || radius > 1000) {
      errors.push('Radio de geofence debe ser número entre 50 y 1000 metros');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizar texto para prevenir inyección
 */
function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  
  return text
    .trim()
    .replace(/[<>'"&]/g, '') // Remover caracteres peligrosos
    .substring(0, 1000); // Limitar longitud
}

/**
 * Validar ID de administrador Telegram
 */
function validateTelegramAdminId(id) {
  const errors = [];
  
  const numId = parseInt(id);
  
  if (isNaN(numId)) {
    errors.push('ID debe ser un número');
  } else if (numId < 1 || numId > 9999999999) {
    errors.push('ID debe estar en rango válido de Telegram');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validar rango de fechas
 */
function validateDateRange(startDate, endDate) {
  const errors = [];
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    errors.push('Fecha de inicio inválida');
  }
  
  if (isNaN(end.getTime())) {
    errors.push('Fecha de fin inválida');
  }
  
  if (start > end) {
    errors.push('Fecha de inicio debe ser menor que fecha de fin');
  }
  
  const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
  if (daysDiff > 365) {
    errors.push('Rango de fechas no puede ser mayor a 365 días');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    daysDiff: Math.ceil(daysDiff)
  };
}

/**
 * Validar parámetros de paginación
 */
function validatePagination(limit, offset) {
  const errors = [];
  
  const limitNum = parseInt(limit) || 50;
  const offsetNum = parseInt(offset) || 0;
  
  if (limitNum < 1 || limitNum > 1000) {
    errors.push('Límite debe estar entre 1 y 1000');
  }
  
  if (offsetNum < 0) {
    errors.push('Offset debe ser mayor o igual a 0');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    limit: limitNum,
    offset: offsetNum
  };
}

module.exports = {
  validateOwnTracksPayload,
  validateUserData,
  validateSystemConfig,
  validateLocationData,
  sanitizeText,
  validateTelegramAdminId,
  validateDateRange,
  validatePagination
};