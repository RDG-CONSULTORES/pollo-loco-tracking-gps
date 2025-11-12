const { messages } = require('../../config/telegram');

/**
 * Comandos de ayuda
 */
class AyudaCommands {
  
  /**
   * /start - Mensaje de bienvenida
   */
  async start(msg) {
    try {
      const chatId = msg.chat.id;
      const userName = msg.from.first_name || 'Admin';
      
      const welcomeMessage = `👋 *¡Hola ${userName}!*\n\n${messages.welcome}`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '👥 Ver Usuarios', callback_data: 'quick_users' },
            { text: '📊 Estado Sistema', callback_data: 'quick_status' }
          ],
          [
            { text: '📍 Ubicaciones', callback_data: 'quick_locations' },
            { text: '📈 Reporte Hoy', callback_data: 'quick_report' }
          ],
          [
            { text: '🖥️ Panel Web', callback_data: 'quick_webapp' },
            { text: '❓ Ayuda', callback_data: 'quick_help' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('❌ Error en comando /start:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error mostrando bienvenida');
    }
  }
  
  /**
   * /help - Ayuda detallada
   */
  async help(msg) {
    try {
      const chatId = msg.chat.id;
      
      const helpMessage = messages.help;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🏠 Menú Principal', callback_data: 'main_menu' },
            { text: '🖥️ Panel Web', callback_data: 'open_webapp' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('❌ Error en comando /help:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error mostrando ayuda');
    }
  }
  
  /**
   * Manejar callbacks de ayuda
   */
  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      switch (data) {
        case 'quick_help':
          await this.showQuickHelp(chatId);
          break;
          
        case 'main_menu':
          await this.showMainMenu(chatId, query.message.message_id);
          break;
          
        case 'open_webapp':
          await this.openWebApp(chatId);
          break;
          
        default:
          await this.bot.sendMessage(chatId, '⚠️ Comando no reconocido');
      }
      
    } catch (error) {
      console.error('❌ Error en callback de ayuda:', error.message);
    }
  }
  
  /**
   * Mostrar ayuda rápida
   */
  async showQuickHelp(chatId) {
    const quickHelp = `
🚀 *COMANDOS RÁPIDOS*

*Usuarios:*
• \`/usuarios\` - Lista de supervisores
• \`/nuevo_usuario\` - Crear supervisor
• \`/pausar JP\` - Pausar usuario JP

*Sistema:*
• \`/estado\` - Ver estado del sistema
• \`/pausar_sistema\` - Pausar tracking
• \`/config\` - Ver configuración

*Reportes:*
• \`/reporte\` - Reporte del día
• \`/ubicaciones\` - Ubicaciones actuales
• \`/visitas_hoy\` - Visitas de hoy

*Web App:*
• \`/webapp\` - Abrir panel completo

💡 *Tip:* Usa el panel web para operaciones avanzadas
`;
    
    await this.bot.sendMessage(chatId, quickHelp, {
      parse_mode: 'Markdown'
    });
  }
  
  /**
   * Mostrar menú principal (reemplazar mensaje)
   */
  async showMainMenu(chatId, messageId) {
    const welcomeMessage = `🐔 *POLLO LOCO TRACKING*\n\n📊 *Panel de Control*\n\nSelecciona una opción:`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👥 Usuarios', callback_data: 'menu_users' },
          { text: '⚙️ Config', callback_data: 'menu_config' }
        ],
        [
          { text: '📊 Reportes', callback_data: 'menu_reports' },
          { text: '📍 Tracking', callback_data: 'menu_tracking' }
        ],
        [
          { text: '🖥️ Panel Web', callback_data: 'open_webapp' }
        ]
      ]
    };
    
    try {
      await this.bot.editMessageText(welcomeMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      // Si no se puede editar, enviar nuevo mensaje
      await this.bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }
  
  /**
   * Abrir Web App
   */
  async openWebApp(chatId) {
    const config = require('../../config/telegram').config;
    const webAppUrl = `${config.webAppUrl}/webapp`;
    
    await this.bot.sendMessage(chatId, '🖥️ *Panel Web*\n\nAbre el panel completo para gestión avanzada.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 Abrir Panel Admin',
            web_app: { url: webAppUrl }
          }
        ]]
      }
    });
  }
}

module.exports = new AyudaCommands();