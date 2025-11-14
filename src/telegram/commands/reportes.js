const db = require('../../config/database');
const reportGenerator = require('../../services/report-generator');

/**
 * Comandos de reportes
 */
class ReportesCommands {
  
  /**
   * /reporte - Generar reporte del día
   */
  async daily(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, '📊 Generando reporte del día...');
      
      const today = new Date();
      const report = await reportGenerator.generateDailyReport(today);
      
      const message = `
📊 *REPORTE DIARIO*
📅 ${today.toLocaleDateString('es-ES')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 *SUPERVISORES*
• Activos: ${report.activeUsers || 0}
• Con ubicaciones: ${report.usersWithLocations || 0}

📍 *UBICACIONES*
• Total recibidas: ${report.locationsReceived || 0}
• Visitas detectadas: ${report.visitsDetected || 0}

🏢 *SUCURSALES*
• Visitadas: ${report.storesVisited || 0}
• Cobertura: ${report.coveragePercentage || 0}%

⏱️ *TIEMPO PROMEDIO*
• Por visita: ${report.averageVisitTime || 0} min
`;

      await this.bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 Ver en Panel Web', callback_data: 'open_webapp' },
              { text: '🔄 Actualizar', callback_data: 'refresh_report' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error generando reporte:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error generando reporte. Inténtalo más tarde.');
    }
  }
  
  /**
   * /ubicaciones - Ubicaciones actuales de supervisores
   */
  async locations(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, '📍 Obteniendo ubicaciones...');
      
      // Primero, obtener todos los usuarios activos
      const usersResult = await db.query(`
        SELECT id, tracker_id, display_name, active
        FROM tracking_users 
        WHERE active = true
        ORDER BY display_name
      `);
      
      if (usersResult.rows.length === 0) {
        await this.bot.sendMessage(chatId, '📍 No hay usuarios registrados aún.\n\nUsa `/nuevo_usuario` para crear uno.');
        return;
      }
      
      let message = '📍 *UBICACIONES ACTUALES*\n\n';
      let hasAnyLocation = false;
      
      for (const user of usersResult.rows) {
        try {
          // Obtener la última ubicación de cada usuario
          const locationResult = await db.query(`
            SELECT 
              latitude, longitude, accuracy, battery, gps_timestamp,
              EXTRACT(EPOCH FROM (NOW() - gps_timestamp))/60 as minutes_ago
            FROM gps_locations 
            WHERE user_id = $1 
            ORDER BY gps_timestamp DESC 
            LIMIT 1
          `, [user.id]);
          
          if (locationResult.rows.length > 0) {
            const loc = locationResult.rows[0];
            const minutesAgo = Math.round(loc.minutes_ago);
            const timeText = minutesAgo < 60 ? `${minutesAgo} min` : `${Math.round(minutesAgo/60)}h`;
            
            message += `👤 *${user.display_name}* (${user.tracker_id})\n`;
            message += `📍 ${Number(loc.latitude).toFixed(6)}, ${Number(loc.longitude).toFixed(6)}\n`;
            if (loc.accuracy) {
              message += `🎯 Precisión: ${loc.accuracy}m`;
            }
            if (loc.battery) {
              message += ` | 🔋 ${loc.battery}%`;
            }
            message += `\n🕒 Hace ${timeText}\n\n`;
            hasAnyLocation = true;
          } else {
            message += `👤 *${user.display_name}* (${user.tracker_id})\n`;
            message += `❌ Sin ubicación GPS\n\n`;
          }
        } catch (locError) {
          console.error(`Error obteniendo ubicación de ${user.tracker_id}:`, locError.message);
          message += `👤 *${user.display_name}* (${user.tracker_id})\n`;
          message += `⚠️ Error consultando ubicación\n\n`;
        }
      }
      
      if (!hasAnyLocation) {
        message += '\n💡 *Tip:* Configura OwnTracks en tu teléfono para enviar ubicaciones automáticamente.';
      }
      
      await this.bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🗺️ Ver en Mapa (Web)', callback_data: 'open_webapp' },
              { text: '🔄 Actualizar', callback_data: 'refresh_locations' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo ubicaciones:', error.message);
      console.error('❌ Stack trace:', error.stack);
      await this.bot.sendMessage(msg.chat.id, `❌ Error obteniendo ubicaciones: ${error.message}`);
    }
  }
  
  /**
   * /visitas_hoy - Visitas del día
   */
  async visitsToday(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, '🏢 Consultando visitas del día...');
      
      const result = await db.query(`
        SELECT 
          tv.user_id,
          tu.display_name,
          tlc.store_name,
          tv.entry_time,
          tv.exit_time,
          EXTRACT(EPOCH FROM (tv.exit_time - tv.entry_time))/60 as duration_minutes
        FROM tracking_visits tv
        JOIN tracking_users tu ON tv.user_id = tu.id
        LEFT JOIN tracking_locations_cache tlc ON tv.store_id = tlc.zenput_store_id
        WHERE tv.entry_time::date = CURRENT_DATE
        ORDER BY tv.entry_time DESC
      `);
      
      if (result.rows.length === 0) {
        await this.bot.sendMessage(chatId, '🏢 No hay visitas registradas hoy.\n\n¿Los supervisores tienen OwnTracks configurado?');
        return;
      }
      
      let message = `🏢 *VISITAS DE HOY*\n📅 ${new Date().toLocaleDateString('es-ES')}\n\n`;
      
      result.rows.forEach((visit, index) => {
        const entryTime = new Date(visit.entry_time).toLocaleTimeString('es-ES', {
          hour: '2-digit', 
          minute: '2-digit'
        });
        
        const duration = visit.duration_minutes ? 
          `${Math.round(visit.duration_minutes)} min` : 
          'En progreso';
        
        message += `${index + 1}. *${visit.display_name}*\n`;
        message += `🏢 ${visit.store_name || 'Sucursal desconocida'}\n`;
        message += `🕒 ${entryTime} | ⏱️ ${duration}\n\n`;
      });
      
      await this.bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Reporte Completo', callback_data: 'daily_report' },
              { text: '🔄 Actualizar', callback_data: 'refresh_visits' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error consultando visitas:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error consultando visitas del día.');
    }
  }

  /**
   * Manejar callbacks de reportes
   */
  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      switch (data) {
        case 'refresh_report':
          await this.daily({ chat: { id: chatId } });
          break;
          
        case 'refresh_locations':
          await this.locations({ chat: { id: chatId } });
          break;
          
        case 'refresh_visits':
          await this.visitsToday({ chat: { id: chatId } });
          break;
          
        case 'open_webapp':
          const config = require('../../config/telegram').config;
          const webAppUrl = `${config.webAppUrl}/webapp`;
          
          await this.bot.sendMessage(chatId, '🖥️ Abriendo panel web...', {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🚀 Abrir Panel Completo',
                  web_app: { url: webAppUrl }
                }
              ]]
            }
          });
          break;
          
        default:
          await this.bot.sendMessage(chatId, '⚠️ Acción no reconocida');
      }
      
    } catch (error) {
      console.error('❌ Error en callback de reportes:', error.message);
    }
  }
}

module.exports = new ReportesCommands();