/**
 * Sistema de Notificaciones Telegram
 * Mini-Step 1C: Geofence alerts y notificaciones automáticas
 */

const db = require('../config/database');

/**
 * Enviar notificación de geofence
 */
async function sendGeofenceAlert(bot, userId, alertData) {
  try {
    console.log('🚨 Enviando alerta geofence:', { userId, alertData });

    // Obtener usuario con datos de Telegram
    const userResult = await db.query(`
      SELECT * FROM tracking_users 
      WHERE id = $1 AND telegram_id IS NOT NULL AND active = true
    `, [userId]);

    if (userResult.rows.length === 0) {
      console.warn('⚠️ Usuario no tiene Telegram configurado:', userId);
      return false;
    }

    const user = userResult.rows[0];
    const telegramId = user.telegram_id;

    // Generar mensaje de alerta
    const alertMessage = generateGeofenceMessage(user, alertData);

    // Enviar mensaje
    await bot.sendMessage(telegramId, alertMessage, { 
      parse_mode: 'Markdown',
      disable_notification: alertData.priority === 'low'
    });

    // Registrar notificación en base de datos
    await logNotification(userId, 'geofence_alert', alertData, 'sent');

    console.log('✅ Notificación enviada exitosamente a:', user.display_name);
    return true;

  } catch (error) {
    console.error('❌ Error enviando notificación geofence:', error.message);
    
    // Registrar error en base de datos
    await logNotification(userId, 'geofence_alert', alertData, 'failed', error.message);
    return false;
  }
}

/**
 * Generar mensaje de alerta geofence
 */
function generateGeofenceMessage(user, alertData) {
  const { eventType, locationName, timestamp, coordinates, isExiting } = alertData;

  let icon, action, severity;
  
  if (isExiting) {
    icon = '🚨';
    action = 'SALIÓ';
    severity = 'ALERTA';
  } else {
    icon = '✅';
    action = 'ENTRÓ';
    severity = 'INFO';
  }

  const timeFormatted = new Date(timestamp).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour12: true
  });

  return (
    `${icon} *${severity}*\n\n` +
    `👤 **${user.display_name}** ${action} de zona\n` +
    `📍 **Ubicación**: ${locationName}\n` +
    `🕒 **Hora**: ${timeFormatted}\n` +
    `📊 **Coordenadas**: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}\n\n` +
    `🏢 *${user.position || 'Empleado'}*\n` +
    `📋 *Grupo: ${user.role || 'N/A'}*\n\n` +
    (isExiting ? 
      '⚠️ *Se requiere justificación si es fuera del horario laboral.*' :
      '✅ *Entrada registrada correctamente.*'
    )
  );
}

/**
 * Enviar notificación de bienvenida
 */
async function sendWelcomeMessage(bot, telegramId, user) {
  try {
    const message = (
      `🎉 *¡Bienvenido al sistema EPL CAS!*\n\n` +
      `👋 Hola **${user.display_name}**, tu cuenta ha sido vinculada exitosamente.\n\n` +
      `📋 **Información de tu cuenta:**\n` +
      `🏢 Posición: ${user.position || 'Sin definir'}\n` +
      `📍 Rol: ${user.role || 'Sin definir'}\n` +
      `📱 ID: ${user.tracker_id}\n\n` +
      `🔔 **Notificaciones activadas**:\n` +
      `• Alertas de entrada/salida de zonas\n` +
      `• Recordatorios importantes\n` +
      `• Actualizaciones del sistema\n\n` +
      `💡 *Escribe /menu para ver todas las opciones disponibles.*`
    );

    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    
    await logNotification(user.id, 'welcome', { user_id: user.id }, 'sent');
    return true;

  } catch (error) {
    console.error('❌ Error enviando bienvenida:', error.message);
    return false;
  }
}

/**
 * Enviar alerta a directores
 */
async function sendDirectorAlert(bot, alertData) {
  try {
    console.log('📢 Enviando alerta a directores:', alertData);

    // Obtener directores con Telegram configurado
    const directorsResult = await db.query(`
      SELECT * FROM tracking_users 
      WHERE role = 'director' 
        AND telegram_id IS NOT NULL 
        AND active = true
    `);

    if (directorsResult.rows.length === 0) {
      console.warn('⚠️ No hay directores con Telegram configurado');
      return false;
    }

    const alertMessage = generateDirectorAlert(alertData);
    let sentCount = 0;

    for (const director of directorsResult.rows) {
      try {
        await bot.sendMessage(director.telegram_id, alertMessage, { 
          parse_mode: 'Markdown'
        });
        
        await logNotification(director.id, 'director_alert', alertData, 'sent');
        sentCount++;
        
        console.log(`✅ Alerta enviada a director: ${director.display_name}`);

      } catch (error) {
        console.error(`❌ Error enviando a director ${director.display_name}:`, error.message);
        await logNotification(director.id, 'director_alert', alertData, 'failed', error.message);
      }
    }

    console.log(`📊 Alertas de director enviadas: ${sentCount}/${directorsResult.rows.length}`);
    return sentCount > 0;

  } catch (error) {
    console.error('❌ Error enviando alertas a directores:', error.message);
    return false;
  }
}

/**
 * Generar mensaje de alerta para directores
 */
function generateDirectorAlert(alertData) {
  const { type, user, location, details } = alertData;

  let icon, severity, title;
  
  switch (type) {
    case 'unauthorized_exit':
      icon = '🚨';
      severity = 'CRÍTICA';
      title = 'SALIDA NO AUTORIZADA';
      break;
    case 'late_arrival':
      icon = '⏰';
      severity = 'ADVERTENCIA';
      title = 'LLEGADA TARDÍA';
      break;
    case 'no_show':
      icon = '❌';
      severity = 'CRÍTICA';
      title = 'FALTA SIN JUSTIFICAR';
      break;
    default:
      icon = '📢';
      severity = 'INFO';
      title = 'NOTIFICACIÓN';
  }

  const timeFormatted = new Date(details.timestamp || new Date()).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour12: true
  });

  return (
    `${icon} *ALERTA ${severity}*\n\n` +
    `📋 **${title}**\n\n` +
    `👤 **Usuario**: ${user.display_name}\n` +
    `🏢 **Posición**: ${user.position || 'Sin definir'}\n` +
    `📍 **Ubicación**: ${location || 'Desconocida'}\n` +
    `🕒 **Hora**: ${timeFormatted}\n\n` +
    (details.description ? `📝 **Detalles**: ${details.description}\n\n` : '') +
    `⚡ *Requiere atención inmediata*`
  );
}

/**
 * Enviar recordatorio diario
 */
async function sendDailyReminder(bot, userId, reminderData) {
  try {
    const userResult = await db.query(`
      SELECT * FROM tracking_users 
      WHERE id = $1 AND telegram_id IS NOT NULL AND active = true
    `, [userId]);

    if (userResult.rows.length === 0) {
      return false;
    }

    const user = userResult.rows[0];
    const message = generateDailyReminder(user, reminderData);

    await bot.sendMessage(user.telegram_id, message, { 
      parse_mode: 'Markdown',
      disable_notification: true
    });

    await logNotification(userId, 'daily_reminder', reminderData, 'sent');
    return true;

  } catch (error) {
    console.error('❌ Error enviando recordatorio diario:', error.message);
    await logNotification(userId, 'daily_reminder', reminderData, 'failed', error.message);
    return false;
  }
}

/**
 * Generar recordatorio diario
 */
function generateDailyReminder(user, reminderData) {
  const { schedule, location, tasks } = reminderData;

  return (
    `🌅 *Buen día, ${user.display_name}*\n\n` +
    `📋 **Recordatorio diario:**\n\n` +
    `🕒 **Horario**: ${schedule || 'Verificar con supervisor'}\n` +
    `📍 **Ubicación asignada**: ${location || 'Pendiente de asignar'}\n\n` +
    (tasks && tasks.length > 0 ? 
      `✅ **Tareas pendientes**:\n${tasks.map(task => `• ${task}`).join('\n')}\n\n` : ''
    ) +
    `💡 *¡Que tengas un excelente día de trabajo!*`
  );
}

/**
 * Registrar notificación en base de datos
 */
async function logNotification(userId, type, data, status, errorMessage = null) {
  try {
    await db.query(`
      INSERT INTO notification_logs (
        user_id, 
        notification_type, 
        message_data, 
        status, 
        error_message, 
        sent_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      userId,
      type,
      JSON.stringify(data),
      status,
      errorMessage
    ]);

  } catch (error) {
    // Tabla de logs podría no existir, crear si es necesario
    console.warn('⚠️ No se pudo registrar notificación (tabla logs):', error.message);
  }
}

/**
 * Obtener estadísticas de notificaciones
 */
async function getNotificationStats(userId = null, days = 7) {
  try {
    let query = `
      SELECT 
        notification_type,
        status,
        COUNT(*) as count,
        MAX(sent_at) as last_sent
      FROM notification_logs
      WHERE sent_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [];
    
    if (userId) {
      query += ' AND user_id = $1';
      params.push(userId);
    }
    
    query += ' GROUP BY notification_type, status ORDER BY notification_type, status';

    const result = await db.query(query, params);
    return result.rows;

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de notificaciones:', error.message);
    return [];
  }
}

module.exports = {
  sendGeofenceAlert,
  sendWelcomeMessage,
  sendDirectorAlert,
  sendDailyReminder,
  getNotificationStats,
  generateGeofenceMessage,
  generateDirectorAlert,
  logNotification
};