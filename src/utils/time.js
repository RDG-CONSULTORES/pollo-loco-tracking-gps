/**
 * Utilidades para manejo de tiempo
 */

/**
 * Formatear tiempo en formato legible
 * @param {Date} date - Fecha a formatear
 * @param {boolean} includeTime - Si incluir la hora
 * @returns {string}
 */
function formatTime(date, includeTime = true) {
  if (!date || !(date instanceof Date)) {
    return '';
  }
  
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Monterrey'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return date.toLocaleString('es-MX', options);
}

/**
 * Formatear duración en minutos a formato legible
 * @param {number} minutes - Duración en minutos
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes || minutes < 0) {
    return '0 min';
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  
  return `${mins} min`;
}

/**
 * Obtener inicio del día en timezone local
 * @param {Date} date - Fecha
 * @returns {Date}
 */
function getStartOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Obtener fin del día en timezone local
 * @param {Date} date - Fecha
 * @returns {Date}
 */
function getEndOfDay(date = new Date()) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Verificar si una fecha está dentro del horario laboral
 * @param {Date} date - Fecha a verificar
 * @param {string} startTime - Hora de inicio (HH:MM)
 * @param {string} endTime - Hora de fin (HH:MM)
 * @param {Array<number>} workDays - Días laborales (0=Dom, 6=Sáb)
 * @returns {boolean}
 */
function isWithinWorkHours(date, startTime, endTime, workDays = [1, 2, 3, 4, 5, 6]) {
  const dayOfWeek = date.getDay();
  
  // Verificar si es día laboral
  if (!workDays.includes(dayOfWeek)) {
    return false;
  }
  
  // Verificar hora
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  
  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);
  
  const startMinutes = startHours * 60 + startMins;
  const endMinutes = endHours * 60 + endMins;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Calcular tiempo transcurrido desde una fecha
 * @param {Date} date - Fecha pasada
 * @returns {string}
 */
function getTimeAgo(date) {
  if (!date || !(date instanceof Date)) {
    return 'fecha inválida';
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return 'hace menos de 1 min';
  } else if (diffMins < 60) {
    return `hace ${diffMins} min`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `hace ${hours}h`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `hace ${days}d`;
  }
}

/**
 * Parsear hora en formato HH:MM a minutos desde medianoche
 * @param {string} timeStr - Hora en formato HH:MM
 * @returns {number}
 */
function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convertir minutos desde medianoche a formato HH:MM
 * @param {number} minutes - Minutos desde medianoche
 * @returns {string}
 */
function minutesToTimeString(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

module.exports = {
  formatTime,
  formatDuration,
  getStartOfDay,
  getEndOfDay,
  isWithinWorkHours,
  getTimeAgo,
  parseTimeToMinutes,
  minutesToTimeString
};