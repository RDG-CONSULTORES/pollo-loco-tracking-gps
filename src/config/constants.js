/**
 * Constantes del sistema Pollo Loco Tracking GPS
 */

const SYSTEM_CONSTANTS = {
  
  // Configuración de GPS
  GPS: {
    DEFAULT_ACCURACY_THRESHOLD: 100, // metros
    MIN_ACCURACY: 10, // metros
    MAX_ACCURACY: 500, // metros
    UPDATE_INTERVAL: 300000, // 5 minutos en ms
    MAX_AGE: 7200000 // 2 horas en ms
  },
  
  // Configuración de Geofencing
  GEOFENCE: {
    DEFAULT_RADIUS: 150, // metros
    MIN_RADIUS: 50, // metros
    MAX_RADIUS: 500, // metros
    MIN_VISIT_DURATION: 5, // minutos mínimos para considerar visita
    MAX_VISIT_DURATION: 480 // 8 horas máximo
  },
  
  // Horarios laborales
  WORK_SCHEDULE: {
    DEFAULT_START: '07:00',
    DEFAULT_END: '21:00',
    DEFAULT_DAYS: [1, 2, 3, 4, 5, 6], // Lun-Sáb
    TIMEZONE: 'America/Mexico_City'
  },
  
  // Estados del sistema
  SYSTEM_STATUS: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    MAINTENANCE: 'maintenance',
    ERROR: 'error'
  },
  
  // Estados de usuarios
  USER_STATUS: {
    ACTIVE: true,
    INACTIVE: false
  },
  
  // Estados de visitas
  VISIT_STATUS: {
    OPEN: 'open',
    CLOSED: 'closed',
    INVALID: 'invalid'
  },
  
  // Tipos de visita
  VISIT_TYPES: {
    SHORT: 'short',      // < 30 min
    NORMAL: 'normal',    // 30-90 min
    LONG: 'long',        // > 90 min
    INVALID: 'invalid'   // < 5 min o datos inconsistentes
  },
  
  // Configuración de base de datos
  DATABASE: {
    MAX_CONNECTIONS: 20,
    CONNECTION_TIMEOUT: 2000,
    IDLE_TIMEOUT: 30000,
    QUERY_TIMEOUT: 10000
  },
  
  // Configuración de Telegram
  TELEGRAM: {
    MAX_MESSAGE_LENGTH: 4096,
    PARSE_MODE: 'Markdown',
    DISABLE_WEB_PAGE_PREVIEW: true
  },
  
  // Configuración de reportes
  REPORTS: {
    DAILY_REPORT_TIME: '21:00', // 9 PM
    MAX_LOCATIONS_IN_REPORT: 10,
    MAX_USERS_IN_REPORT: 10
  },
  
  // Configuración de sincronización
  SYNC: {
    ZENPUT_SYNC_INTERVAL: 24, // horas
    CACHE_TTL: 3600, // 1 hora en segundos
    MAX_RETRY_ATTEMPTS: 3
  },
  
  // Códigos de error
  ERROR_CODES: {
    GPS_ACCURACY_LOW: 'GPS_ACCURACY_LOW',
    OUTSIDE_WORK_HOURS: 'OUTSIDE_WORK_HOURS',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_INACTIVE: 'USER_INACTIVE',
    SYSTEM_PAUSED: 'SYSTEM_PAUSED',
    INVALID_COORDINATES: 'INVALID_COORDINATES',
    DATABASE_ERROR: 'DATABASE_ERROR'
  },
  
  // Mensajes del sistema
  MESSAGES: {
    LOCATION_PROCESSED: '✅ Ubicación procesada',
    LOCATION_SKIPPED: '⏭️ Ubicación omitida',
    VISIT_STARTED: '🟢 Visita iniciada',
    VISIT_ENDED: '🔴 Visita finalizada',
    USER_CREATED: '👤 Usuario creado',
    USER_UPDATED: '✏️ Usuario actualizado',
    CONFIG_UPDATED: '⚙️ Configuración actualizada'
  }
};

/**
 * Validar coordenadas GPS
 */
function isValidCoordinate(lat, lon) {
  return (
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180 &&
    !isNaN(lat) && !isNaN(lon)
  );
}

/**
 * Validar precisión GPS
 */
function isValidAccuracy(accuracy) {
  return (
    accuracy >= SYSTEM_CONSTANTS.GPS.MIN_ACCURACY && 
    accuracy <= SYSTEM_CONSTANTS.GPS.MAX_ACCURACY
  );
}

/**
 * Determinar tipo de visita basado en duración
 */
function getVisitType(durationMinutes) {
  if (durationMinutes < 5) {
    return SYSTEM_CONSTANTS.VISIT_TYPES.INVALID;
  } else if (durationMinutes < 30) {
    return SYSTEM_CONSTANTS.VISIT_TYPES.SHORT;
  } else if (durationMinutes <= 90) {
    return SYSTEM_CONSTANTS.VISIT_TYPES.NORMAL;
  } else {
    return SYSTEM_CONSTANTS.VISIT_TYPES.LONG;
  }
}

/**
 * Formatear duración en texto legible
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMins}m`;
}

module.exports = {
  SYSTEM_CONSTANTS,
  isValidCoordinate,
  isValidAccuracy,
  getVisitType,
  formatDuration
};