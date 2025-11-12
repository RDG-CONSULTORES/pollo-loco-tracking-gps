const db = require('../../config/database');

/**
 * Comandos de configuración
 */
class ConfigCommands {
  
  /**
   * /config - Ver configuración actual
   */
  async view(msg) {
    try {
      const chatId = msg.chat.id;
      
      // Obtener configuración actual
      const systemActive = await db.getConfig('system_active', 'false');
      const workHoursStart = await db.getConfig('work_hours_start', '07:00');
      const workHoursEnd = await db.getConfig('work_hours_end', '21:00');
      const geofenceRadius = await db.getConfig('geofence_radius_meters', '100');
      const minVisitDuration = await db.getConfig('min_visit_duration_minutes', '5');
      
      // Obtener estadísticas
      const userCount = await db.query('SELECT COUNT(*) as count FROM tracking_users WHERE active = true');
      const totalUsers = parseInt(userCount.rows[0].count);
      
      const message = `
⚙️ *CONFIGURACIÓN DEL SISTEMA*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 *ESTADO GENERAL*
• Sistema: ${systemActive === 'true' ? '✅ Activo' : '⏸️ Pausado'}
• Usuarios registrados: ${totalUsers}

⏰ *HORARIOS LABORALES*
• Inicio: ${workHoursStart}
• Fin: ${workHoursEnd}
• Zona horaria: América/Mexico_City

📍 *DETECCIÓN DE VISITAS*
• Radio geofence: ${geofenceRadius} metros
• Duración mínima: ${minVisitDuration} minutos

🔗 *INTEGRACIONES*
• Base de datos: Railway PostgreSQL ✅
• Zenput: ${process.env.ZENPUT_DATABASE_URL ? '✅ Configurada' : '❌ No configurada'}
• Telegram: ✅ Activo
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '⏰ Cambiar Horarios', callback_data: 'config_hours' },
            { text: '📍 Config GPS', callback_data: 'config_gps' }
          ],
          [
            { text: systemActive === 'true' ? '⏸️ Pausar Sistema' : '▶️ Activar Sistema', 
              callback_data: systemActive === 'true' ? 'system_pause' : 'system_activate' },
            { text: '🔄 Actualizar', callback_data: 'config_refresh' }
          ],
          [
            { text: '🖥️ Panel Web Completo', callback_data: 'open_webapp' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('❌ Error mostrando configuración:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error obteniendo configuración.');
    }
  }
  
  /**
   * /horarios - Configurar horarios laborales
   */
  async updateHours(msg, match) {
    try {
      const chatId = msg.chat.id;
      
      if (!match || match.length < 3) {
        await this.bot.sendMessage(chatId, 
          `⚠️ *Uso correcto:* \`/horarios HH:MM HH:MM\`\n\n` +
          `Ejemplo: \`/horarios 07:00 21:00\`\n\n` +
          `Los horarios determinan cuándo se procesa el tracking GPS.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const startTime = match[1];
      const endTime = match[2];
      
      // Validar formato de hora
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        await this.bot.sendMessage(chatId, '❌ Formato de hora inválido. Use HH:MM (ejemplo: 07:00)');
        return;
      }
      
      // Guardar configuración
      await db.setConfig('work_hours_start', startTime);
      await db.setConfig('work_hours_end', endTime);
      
      await this.bot.sendMessage(chatId, 
        `✅ *Horarios actualizados*\n\n` +
        `🌅 Inicio: ${startTime}\n` +
        `🌆 Fin: ${endTime}\n\n` +
        `El tracking GPS se procesará en este horario.`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('❌ Error configurando horarios:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error configurando horarios.');
    }
  }

  /**
   * Manejar callbacks de configuración
   */
  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      switch (data) {
        case 'config_refresh':
          await this.view({ chat: { id: chatId } });
          break;
          
        case 'config_hours':
          await this.bot.sendMessage(chatId, 
            `⏰ *CONFIGURAR HORARIOS*\n\n` +
            `Usa el comando:\n\`/horarios HH:MM HH:MM\`\n\n` +
            `Ejemplo:\n\`/horarios 07:00 21:00\``,
            { parse_mode: 'Markdown' }
          );
          break;
          
        case 'config_gps':
          await this.showGPSConfig(chatId);
          break;
          
        case 'open_webapp':
          const config = require('../../config/telegram').config;
          const webAppUrl = `${config.webAppUrl}/webapp`;
          
          await this.bot.sendMessage(chatId, '🖥️ Abriendo panel web...', {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🚀 Abrir Panel Configuración',
                  web_app: { url: webAppUrl }
                }
              ]]
            }
          });
          break;
          
        default:
          await this.bot.sendMessage(chatId, '⚠️ Opción no reconocida');
      }
      
    } catch (error) {
      console.error('❌ Error en callback de config:', error.message);
    }
  }
  
  /**
   * Mostrar configuración GPS
   */
  async showGPSConfig(chatId) {
    try {
      const geofenceRadius = await db.getConfig('geofence_radius_meters', '100');
      const minVisitDuration = await db.getConfig('min_visit_duration_minutes', '5');
      
      const message = `
📍 *CONFIGURACIÓN GPS*

🎯 *Detección de Visitas*
• Radio geofence: ${geofenceRadius} metros
• Duración mínima: ${minVisitDuration} minutos

📱 *OwnTracks Setup*
• Servidor: \`https://pollo-loco-tracking-gps-production.up.railway.app\`
• Endpoint: \`/api/owntracks/location\`
• Modo: HTTP
• Puerto: 443 (HTTPS)

⚙️ *Configuración Recomendada*
• Intervalo de ubicación: 30 segundos
• Precisión mínima: 50 metros
• Solo en horario laboral
`;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📖 Guía OwnTracks', callback_data: 'owntracks_guide' },
              { text: '🔧 Config Avanzada', callback_data: 'advanced_gps' }
            ],
            [
              { text: '« Volver a Config', callback_data: 'config_refresh' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error mostrando config GPS:', error.message);
    }
  }
}

module.exports = new ConfigCommands();