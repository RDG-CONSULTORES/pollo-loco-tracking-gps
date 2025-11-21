const TelegramBot = require('node-telegram-bot-api');
const { config, validateConfig, isAdmin, messages } = require('../config/telegram');
const commands = require('./commands');

/**
 * Bot principal de Telegram para Pollo Loco Tracking
 */
class PolloLocoBot {
  constructor() {
    this.bot = null;
    this.isRunning = false;
    
    // Validar configuración antes de inicializar
    if (!validateConfig()) {
      console.error('❌ No se puede inicializar bot de Telegram: configuración inválida');
      return;
    }
    
    try {
      this.bot = new TelegramBot(config.botToken, config.botOptions);
      this.setupHandlers();
      console.log('✅ Telegram bot initialized');
    } catch (error) {
      console.error('❌ Error inicializando Telegram bot:', error.message);
    }
  }
  
  /**
   * Configurar manejadores de comandos y eventos
   */
  setupHandlers() {
    if (!this.bot) return;
    
    // Middleware de autenticación - COMENTADO TEMPORALMENTE
    // this.bot.use((ctx, next) => {
    //   const userId = ctx.message?.from?.id || ctx.callback_query?.from?.id;
    //   
    //   if (!isAdmin(userId)) {
    //     this.sendMessage(ctx.message?.chat?.id || ctx.callback_query?.message?.chat?.id, 
    //       messages.unauthorized);
    //     return;
    //   }
    //   
    //   next();
    // });
    
    // Comando /start con auto-vinculación
    this.bot.onText(/^\/start(?: (.+))?$/, (msg, match) => {
      commands.autolink.startCommand.call({ bot: this.bot }, msg, match);
    });
    this.bot.onText(/^\/help$/, (msg) => {
      commands.ayuda.bot = this.bot;
      commands.ayuda.help(msg);
    });
    this.bot.onText(/^\/menu$/, (msg) => {
      commands.menu.bot = this.bot;
      commands.menu.main(msg);
    });
    
    // Comandos de usuarios
    this.bot.onText(/^\/usuarios$/, (msg) => {
      commands.usuarios.bot = this.bot;
      commands.usuarios.list(msg);
    });
    this.bot.onText(/^\/nuevo_usuario/, (msg) => {
      commands.usuarios.bot = this.bot;
      commands.usuarios.create(msg);
    });
    this.bot.onText(/^\/pausar (.+)/, (msg, match) => {
      commands.control.bot = this.bot;
      commands.control.pauseUser(msg, match);
    });
    this.bot.onText(/^\/activar (.+)/, (msg, match) => {
      commands.control.bot = this.bot;
      commands.control.activateUser(msg, match);
    });
    
    // Comandos de configuración
    this.bot.onText(/^\/config$/, (msg) => {
      commands.config.bot = this.bot;
      commands.config.view(msg);
    });
    this.bot.onText(/^\/horarios (.+) (.+)/, (msg, match) => {
      commands.config.bot = this.bot;
      commands.config.updateHours(msg, match);
    });
    
    // Comandos de control del sistema
    this.bot.onText(/^\/estado$/, (msg) => {
      commands.control.bot = this.bot;
      commands.control.status(msg);
    });
    this.bot.onText(/^\/pausar_sistema$/, (msg) => {
      commands.control.bot = this.bot;
      commands.control.pauseSystem(msg);
    });
    this.bot.onText(/^\/activar_sistema$/, (msg) => {
      commands.control.bot = this.bot;
      commands.control.activateSystem(msg);
    });
    
    // Comandos de reportes
    this.bot.onText(/^\/reporte/, (msg) => {
      commands.reportes.bot = this.bot;
      commands.reportes.daily(msg);
    });
    this.bot.onText(/^\/ubicaciones$/, (msg) => {
      commands.reportes.bot = this.bot;
      commands.reportes.locations(msg);
    });
    this.bot.onText(/^\/visitas_hoy$/, (msg) => {
      commands.reportes.bot = this.bot;
      commands.reportes.visitsToday(msg);
    });
    
    // Web App
    this.bot.onText(/^\/webapp$/, this.openWebApp.bind(this));
    
    // Callback queries (botones)
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    
    // Error handlers
    this.bot.on('error', (error) => {
      console.error('❌ Telegram Bot error:', error);
    });
    
    this.bot.on('polling_error', (error) => {
      console.error('❌ Telegram Polling error:', error);
    });
    
    console.log('✅ Telegram bot handlers configured');
  }
  
  /**
   * Abrir Telegram Web App
   */
  async openWebApp(msg) {
    try {
      const chatId = msg.chat.id;
      const webAppUrl = `${config.webAppUrl}/webapp/admin.html`;
      
      await this.bot.sendMessage(chatId, '🖥️ *Panel de Administración*\n\nAbre el panel web para gestionar el sistema de tracking.', {
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
      
    } catch (error) {
      console.error('❌ Error abriendo WebApp:', error.message);
      await this.sendMessage(msg.chat.id, '❌ Error abriendo panel web. Contacta al administrador.');
    }
  }
  
  /**
   * Manejar callback queries (clicks de botones)
   */
  async handleCallbackQuery(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      console.log(`🔘 Callback query: ${data} from ${query.from.id}`);
      
      // Responder al callback
      await this.bot.answerCallbackQuery(query.id);
      
      // Procesar según el tipo de callback
      if (data.startsWith('autolink') || data === 'manual_register' || data === 'contact_admin' || data === 'show_help') {
        await commands.autolink.handleAutolinkCallback(this.bot, query);
      } else if (data.startsWith('user_')) {
        await commands.usuarios.handleCallback.call(this, query);
      } else if (data.startsWith('config_')) {
        await commands.config.handleCallback.call(this, query);
      } else if (data.startsWith('report_') || data.startsWith('refresh_') || data === 'daily_report') {
        await commands.reportes.handleCallback.call(this, query);
      } else if (data.startsWith('menu_') || data.startsWith('cmd_')) {
        commands.menu.bot = this.bot;
        await commands.menu.handleCallback.call(this, query);
      } else {
        await this.sendMessage(chatId, '⚠️ Acción no reconocida. Usa /menu para ver opciones.');
      }
      
    } catch (error) {
      console.error('❌ Error manejando callback query:', error.message);
    }
  }
  
  /**
   * Enviar mensaje (wrapper con manejo de errores)
   */
  async sendMessage(chatId, text, options = {}) {
    try {
      if (!this.bot) {
        console.error('❌ Bot no inicializado');
        return;
      }
      
      const defaultOptions = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      };
      
      // Truncar mensaje si es muy largo
      if (text.length > 4096) {
        text = text.substring(0, 4090) + '...';
      }
      
      return await this.bot.sendMessage(chatId, text, defaultOptions);
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error.message);
      
      // Intentar enviar mensaje de error simplificado
      if (error.response?.body?.error_code === 400) {
        try {
          await this.bot.sendMessage(chatId, '❌ Error en el formato del mensaje');
        } catch (retryError) {
          console.error('❌ Error en retry:', retryError.message);
        }
      }
    }
  }
  
  /**
   * Enviar mensaje a todos los admins
   */
  async broadcastToAdmins(text, options = {}) {
    const promises = config.adminIds.map(adminId => 
      this.sendMessage(adminId, text, options)
    );
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`📡 Broadcast: ${successful} enviados, ${failed} fallidos`);
    
    return { successful, failed };
  }
  
  /**
   * Iniciar bot
   */
  start() {
    if (!this.bot) {
      console.error('❌ No se puede iniciar bot: no inicializado correctamente');
      return false;
    }
    
    try {
      this.isRunning = true;
      console.log('✅ Telegram Bot started and listening');
      console.log(`👥 Admins configurados: ${config.adminIds.length}`);
      console.log(`🔗 Web App URL: ${config.webAppUrl}/webapp`);
      
      return true;
    } catch (error) {
      console.error('❌ Error iniciando bot:', error.message);
      this.isRunning = false;
      return false;
    }
  }
  
  /**
   * Detener bot
   */
  stop() {
    if (this.bot && this.isRunning) {
      try {
        this.bot.stopPolling();
        this.isRunning = false;
        console.log('✅ Telegram Bot stopped');
      } catch (error) {
        console.error('❌ Error deteniendo bot:', error.message);
      }
    }
  }
  
  /**
   * Obtener información del bot
   */
  async getBotInfo() {
    try {
      if (!this.bot) return null;
      
      const me = await this.bot.getMe();
      return {
        id: me.id,
        username: me.username,
        first_name: me.first_name,
        is_bot: me.is_bot,
        can_join_groups: me.can_join_groups,
        can_read_all_group_messages: me.can_read_all_group_messages
      };
    } catch (error) {
      console.error('❌ Error obteniendo info del bot:', error.message);
      return null;
    }
  }
}

// Singleton instance
let botInstance = null;

function createBot() {
  if (!botInstance) {
    botInstance = new PolloLocoBot();
  }
  return botInstance;
}

function getBot() {
  return botInstance;
}

module.exports = { createBot, getBot, PolloLocoBot };