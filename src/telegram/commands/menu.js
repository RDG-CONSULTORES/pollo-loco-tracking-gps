/**
 * Comandos de menú principal y navegación
 */
class MenuCommands {
  
  /**
   * Menú principal del bot
   */
  async main(msg) {
    try {
      const chatId = msg.chat.id;
      
      const message = `
🏢 *POLLO LOCO GPS CONTROL*

¡Bienvenido al sistema de tracking GPS!

📊 *Estado actual:*
• 4 supervisores activos
• 80 sucursales configuradas
• Sistema operativo

🎮 *Usa los botones de abajo para navegar:*
      `;
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👥 Usuarios GPS', callback_data: 'menu_usuarios' },
              { text: '📍 Ubicaciones', callback_data: 'menu_ubicaciones' }
            ],
            [
              { text: '📊 Reportes', callback_data: 'menu_reportes' },
              { text: '🏢 Sucursales', callback_data: 'menu_sucursales' }
            ],
            [
              { text: '⚙️ Sistema', callback_data: 'menu_sistema' },
              { text: '🚨 Alertas', callback_data: 'menu_alertas' }
            ],
            [
              { text: '🗺️ Dashboard Web', web_app: { url: `${process.env.WEB_APP_URL}/dashboard.html` } }
            ],
            [
              { text: '⚙️ Panel Admin', web_app: { url: `${process.env.WEB_APP_URL}/admin.html` } }
            ],
            [
              { text: '❓ Ayuda', callback_data: 'menu_ayuda' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error mostrando menú principal:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error mostrando menú principal.');
    }
  }
  
  /**
   * Menú de usuarios
   */
  async usuarios(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, `
👥 *GESTIÓN DE USUARIOS GPS*

Administra los supervisores que usan GPS tracking:

📱 *Acciones disponibles:*
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👥 Ver Usuarios', callback_data: 'cmd_usuarios' },
              { text: '➕ Nuevo Usuario', callback_data: 'cmd_nuevo_usuario' }
            ],
            [
              { text: '📍 Ubicaciones Actuales', callback_data: 'cmd_ubicaciones' }
            ],
            [
              { text: '⚙️ Admin Panel', web_app: { url: `${process.env.WEB_APP_URL}/admin.html` } }
            ],
            [
              { text: '🔙 Menú Principal', callback_data: 'menu_main' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error en menú usuarios:', error.message);
    }
  }
  
  /**
   * Menú de reportes
   */
  async reportes(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, `
📊 *REPORTES Y ESTADÍSTICAS*

Consulta métricas y reportes del sistema:

📈 *Tipos de reportes:*
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Reporte Diario', callback_data: 'cmd_reporte' },
              { text: '🏢 Visitas Hoy', callback_data: 'cmd_visitas_hoy' }
            ],
            [
              { text: '📈 Métricas Web', web_app: { url: `${process.env.WEB_APP_URL}/route-metrics-dashboard.html` } }
            ],
            [
              { text: '🗺️ Dashboard Completo', web_app: { url: `${process.env.WEB_APP_URL}/dashboard.html` } }
            ],
            [
              { text: '🔙 Menú Principal', callback_data: 'menu_main' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error en menú reportes:', error.message);
    }
  }
  
  /**
   * Menú de sistema
   */
  async sistema(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, `
⚙️ *CONTROL DEL SISTEMA*

Administra el sistema de tracking GPS:

🔧 *Controles disponibles:*
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Estado Sistema', callback_data: 'cmd_estado' },
              { text: '⚙️ Configuración', callback_data: 'cmd_config' }
            ],
            [
              { text: '⏸️ Pausar Sistema', callback_data: 'cmd_pausar_sistema' },
              { text: '▶️ Activar Sistema', callback_data: 'cmd_activar_sistema' }
            ],
            [
              { text: '⚙️ Panel Admin Completo', web_app: { url: `${process.env.WEB_APP_URL}/admin.html` } }
            ],
            [
              { text: '🔙 Menú Principal', callback_data: 'menu_main' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error en menú sistema:', error.message);
    }
  }
  
  /**
   * Menú de alertas (próximamente)
   */
  async alertas(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, `
🚨 *SISTEMA DE ALERTAS*

Configuración de notificaciones automáticas:

⚠️ *Estado: En desarrollo*

🔔 *Próximamente disponible:*
• Alertas entrada/salida sucursales
• Notificaciones supervisores offline
• Reportes automáticos personalizados

🛠️ Mientras tanto, usa el dashboard web para monitoreo en tiempo real.
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🗺️ Ver Dashboard', web_app: { url: `${process.env.WEB_APP_URL}/dashboard.html` } }
            ],
            [
              { text: '🔙 Menú Principal', callback_data: 'menu_main' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error en menú alertas:', error.message);
    }
  }
  
  /**
   * Ayuda y comandos
   */
  async ayuda(msg) {
    try {
      const chatId = msg.chat.id;
      
      await this.bot.sendMessage(chatId, `
❓ *AYUDA Y COMANDOS*

📱 *Comandos de texto disponibles:*

👥 *Usuarios:*
\`/usuarios\` - Ver lista de usuarios
\`/nuevo_usuario\` - Crear usuario GPS
\`/pausar [usuario]\` - Pausar usuario
\`/activar [usuario]\` - Activar usuario

📊 *Reportes:*
\`/reporte\` - Reporte del día
\`/ubicaciones\` - Ubicaciones actuales
\`/visitas_hoy\` - Visitas de hoy

⚙️ *Sistema:*
\`/estado\` - Estado del sistema
\`/config\` - Ver configuración
\`/pausar_sistema\` - Pausar todo
\`/activar_sistema\` - Activar todo

🌐 *Web:*
\`/webapp\` - Abrir panel web
\`/menu\` - Este menú

💡 *Tip:* Usa los botones del menú para una navegación más fácil.
      `, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔙 Menú Principal', callback_data: 'menu_main' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error mostrando ayuda:', error.message);
    }
  }
  
  /**
   * Manejar callbacks del menú
   */
  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      // Importar comandos según sea necesario
      const usuarios = require('./usuarios');
      const reportes = require('./reportes');
      const control = require('./control');
      const config = require('./config');
      
      // Asignar bot a los comandos
      usuarios.bot = this.bot;
      reportes.bot = this.bot;
      control.bot = this.bot;
      config.bot = this.bot;
      
      switch (data) {
        // Menús principales
        case 'menu_main':
          await this.main({ chat: { id: chatId } });
          break;
        case 'menu_usuarios':
          await this.usuarios({ chat: { id: chatId } });
          break;
        case 'menu_reportes':
          await this.reportes({ chat: { id: chatId } });
          break;
        case 'menu_sistema':
          await this.sistema({ chat: { id: chatId } });
          break;
        case 'menu_alertas':
          await this.alertas({ chat: { id: chatId } });
          break;
        case 'menu_ayuda':
          await this.ayuda({ chat: { id: chatId } });
          break;
        
        // Comandos directos
        case 'cmd_usuarios':
          await usuarios.list({ chat: { id: chatId } });
          break;
        case 'cmd_ubicaciones':
          await reportes.locations({ chat: { id: chatId } });
          break;
        case 'cmd_reporte':
          await reportes.daily({ chat: { id: chatId } });
          break;
        case 'cmd_visitas_hoy':
          await reportes.visitsToday({ chat: { id: chatId } });
          break;
        case 'cmd_estado':
          await control.status({ chat: { id: chatId } });
          break;
        case 'cmd_config':
          await config.view({ chat: { id: chatId } });
          break;
        case 'cmd_pausar_sistema':
          await control.pauseSystem({ chat: { id: chatId } });
          break;
        case 'cmd_activar_sistema':
          await control.activateSystem({ chat: { id: chatId } });
          break;
        
        default:
          await this.bot.sendMessage(chatId, '⚠️ Opción no reconocida. Usa /menu para ver opciones.');
      }
      
    } catch (error) {
      console.error('❌ Error en callback del menú:', error.message);
    }
  }
}

module.exports = new MenuCommands();