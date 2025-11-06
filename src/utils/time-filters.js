const db = require('../config/database');

/**
 * Utilidades para filtros de tiempo y horarios laborales
 */

/**
 * Verificar si timestamp está en horario laboral
 */
async function isWorkingHours(timestamp) {
  try {
    const date = new Date(timestamp);
    
    // Obtener configuración
    const workHoursStart = await db.getConfig('work_hours_start', '07:00');
    const workHoursEnd = await db.getConfig('work_hours_end', '21:00');
    const workDaysStr = await db.getConfig('work_days', '1,2,3,4,5,6'); // Lun-Sáb
    
    // Parsear días laborales
    const workDays = workDaysStr.split(',').map(d => parseInt(d.trim()));
    
    // Verificar día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
    const dayOfWeek = date.getDay();
    if (!workDays.includes(dayOfWeek)) {
      return false; // No es día laboral
    }
    
    // Obtener hora actual en formato HH:mm
    const currentTime = date.toTimeString().substring(0, 5);
    
    // Verificar si está en rango de horario laboral
    return currentTime >= workHoursStart && currentTime <= workHoursEnd;
    
  } catch (error) {
    console.error('❌ Error verificando horario laboral:', error.message);
    // Fallback: asumir horario 7AM-9PM, Lunes a Sábado
    return isDefaultWorkingHours(timestamp);
  }
}

/**
 * Verificar horario laboral con valores por defecto (sin BD)
 */
function isDefaultWorkingHours(timestamp) {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay(); // 0=Domingo, 6=Sábado
  const hour = date.getHours();
  
  // Lunes a Sábado (1-6), 7AM a 9PM
  return dayOfWeek >= 1 && dayOfWeek <= 6 && hour >= 7 && hour < 21;
}

/**
 * Obtener horarios laborales actuales
 */
async function getWorkingHours() {
  try {
    const workHoursStart = await db.getConfig('work_hours_start', '07:00');
    const workHoursEnd = await db.getConfig('work_hours_end', '21:00');
    const workDaysStr = await db.getConfig('work_days', '1,2,3,4,5,6');
    
    const workDays = workDaysStr.split(',').map(d => parseInt(d.trim()));
    
    return {
      start: workHoursStart,
      end: workHoursEnd,
      days: workDays,
      daysText: getDaysText(workDays)
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo horarios:', error.message);
    return {
      start: '07:00',
      end: '21:00',
      days: [1, 2, 3, 4, 5, 6],
      daysText: 'Lunes a Sábado'
    };
  }
}

/**
 * Actualizar horarios laborales
 */
async function updateWorkingHours(startTime, endTime, adminUser = 'system') {
  try {
    // Validar formato de tiempo
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      throw new Error('Formato de tiempo inválido. Use HH:mm');
    }
    
    // Validar lógica (inicio < fin)
    if (startTime >= endTime) {
      throw new Error('Hora de inicio debe ser menor que hora de fin');
    }
    
    await db.setConfig('work_hours_start', startTime, adminUser);
    await db.setConfig('work_hours_end', endTime, adminUser);
    
    console.log(`✅ Horarios actualizados: ${startTime} - ${endTime}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error actualizando horarios:', error.message);
    throw error;
  }
}

/**
 * Actualizar días laborales
 */
async function updateWorkingDays(days, adminUser = 'system') {
  try {
    // Validar días (deben ser números 0-6)
    const validDays = days.filter(day => day >= 0 && day <= 6);
    
    if (validDays.length === 0) {
      throw new Error('Debe especificar al menos un día laboral');
    }
    
    const daysStr = validDays.join(',');
    await db.setConfig('work_days', daysStr, adminUser);
    
    console.log(`✅ Días laborales actualizados: ${getDaysText(validDays)}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error actualizando días laborales:', error.message);
    throw error;
  }
}

/**
 * Validar formato de tiempo HH:mm
 */
function isValidTimeFormat(time) {
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Convertir array de días a texto legible
 */
function getDaysText(days) {
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  if (days.length === 7) {
    return 'Todos los días';
  }
  
  if (arraysEqual(days, [1, 2, 3, 4, 5])) {
    return 'Lunes a Viernes';
  }
  
  if (arraysEqual(days, [1, 2, 3, 4, 5, 6])) {
    return 'Lunes a Sábado';
  }
  
  // Para otros casos, mostrar días individuales
  return days.map(day => dayNames[day]).join(', ');
}

/**
 * Verificar si dos arrays son iguales
 */
function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

/**
 * Obtener próximo horario laboral
 */
async function getNextWorkingHours() {
  try {
    const workingHours = await getWorkingHours();
    const now = new Date();
    
    // Si estamos en horario laboral, retornar hasta cuándo
    if (await isWorkingHours(now)) {
      const today = new Date();
      const endTime = new Date(today.toDateString() + ' ' + workingHours.end);
      
      return {
        isNow: true,
        until: endTime,
        message: `En horario laboral hasta las ${workingHours.end}`
      };
    }
    
    // Buscar próximo día laboral
    for (let i = 1; i <= 7; i++) {
      const nextDay = new Date(now);
      nextDay.setDate(now.getDate() + i);
      
      if (workingHours.days.includes(nextDay.getDay())) {
        const startTime = new Date(nextDay.toDateString() + ' ' + workingHours.start);
        
        return {
          isNow: false,
          next: startTime,
          message: `Próximo horario: ${startTime.toLocaleDateString('es-MX')} a las ${workingHours.start}`
        };
      }
    }
    
    return {
      isNow: false,
      message: 'No hay horarios laborales configurados'
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo próximo horario:', error.message);
    return {
      isNow: false,
      error: error.message
    };
  }
}

/**
 * Verificar si fecha está en rango de días laborales
 */
async function isWorkingDay(date) {
  try {
    const workDaysStr = await db.getConfig('work_days', '1,2,3,4,5,6');
    const workDays = workDaysStr.split(',').map(d => parseInt(d.trim()));
    
    const dayOfWeek = date.getDay();
    return workDays.includes(dayOfWeek);
    
  } catch (error) {
    console.error('❌ Error verificando día laboral:', error.message);
    // Fallback: Lunes a Sábado
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 6;
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

/**
 * Calcular tiempo hasta próximo horario laboral
 */
async function getTimeUntilWorkingHours() {
  try {
    const nextWorking = await getNextWorkingHours();
    
    if (nextWorking.isNow) {
      const now = new Date();
      const minutesUntilEnd = Math.floor((nextWorking.until - now) / (1000 * 60));
      
      return {
        inWorkingHours: true,
        minutesRemaining: minutesUntilEnd,
        message: `${formatDuration(minutesUntilEnd)} restantes`
      };
    }
    
    if (nextWorking.next) {
      const now = new Date();
      const minutesUntilStart = Math.floor((nextWorking.next - now) / (1000 * 60));
      
      return {
        inWorkingHours: false,
        minutesUntilStart,
        message: `${formatDuration(minutesUntilStart)} hasta inicio`
      };
    }
    
    return {
      inWorkingHours: false,
      error: 'No se pudo calcular próximo horario'
    };
    
  } catch (error) {
    console.error('❌ Error calculando tiempo:', error.message);
    return {
      inWorkingHours: false,
      error: error.message
    };
  }
}

module.exports = {
  isWorkingHours,
  isDefaultWorkingHours,
  getWorkingHours,
  updateWorkingHours,
  updateWorkingDays,
  isValidTimeFormat,
  getDaysText,
  getNextWorkingHours,
  isWorkingDay,
  formatDuration,
  getTimeUntilWorkingHours
};