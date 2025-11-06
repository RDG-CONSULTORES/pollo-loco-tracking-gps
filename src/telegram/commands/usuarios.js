const db = require('../../config/database');

/**
 * Comandos para gestión de usuarios
 */
class UsuariosCommands {
  
  /**
   * /usuarios - Listar usuarios
   */
  async list(msg) {
    try {
      const chatId = msg.chat.id;
      
      const result = await db.query(`
        SELECT 
          tracker_id,
          display_name,
          zenput_email,
          active,
          created_at
        FROM tracking_users
        ORDER BY display_name
      `);
      
      if (result.rows.length === 0) {
        await this.bot.sendMessage(chatId, 
          '👥 *USUARIOS*\n\n📝 No hay usuarios registrados.\n\nUsa `/nuevo_usuario` para crear el primero.', 
          { parse_mode: 'Markdown' });
        return;
      }
      
      let message = '👥 *USUARIOS REGISTRADOS*\n\n';
      
      result.rows.forEach(user => {
        const status = user.active ? '🟢' : '🔴';
        const createdDate = new Date(user.created_at).toLocaleDateString('es-MX');
        
        message += `${status} *${user.display_name}*\n`;
        message += `   ID: \`${user.tracker_id}\`\n`;
        message += `   Email: ${user.zenput_email}\n`;
        message += `   Creado: ${createdDate}\n\n`;
      });
      
      message += `\n📊 Total: ${result.rows.length} usuarios`;
      
      // Botones de acción rápida
      const keyboard = {
        inline_keyboard: [
          [
            { text: '➕ Nuevo Usuario', callback_data: 'user_create' },
            { text: '📊 Estadísticas', callback_data: 'user_stats' }
          ],
          [
            { text: '🔄 Actualizar', callback_data: 'user_refresh' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('❌ Error listando usuarios:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error obteniendo lista de usuarios');
    }
  }
  
  /**
   * /nuevo_usuario - Crear nuevo usuario (modo interactivo)
   */
  async create(msg) {
    try {
      const chatId = msg.chat.id;
      
      const instructionMessage = `
👤 *CREAR NUEVO USUARIO*

Para crear un usuario, responde con el siguiente formato:

\`TID|Email|Nombre\`

*Ejemplo:*
\`JP|juan.perez@pollolocomx.com|Juan Pérez\`

*Donde:*
• \`TID\` = Tracker ID (2-3 letras, ej: JP, MG, AR)
• \`Email\` = Email en Zenput
• \`Nombre\` = Nombre completo del supervisor

📱 *También puedes usar el panel web para un formulario más fácil.*
`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🖥️ Usar Panel Web', callback_data: 'user_create_web' }
          ],
          [
            { text: '❌ Cancelar', callback_data: 'user_create_cancel' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, instructionMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
      // TODO: Implementar modo de conversación para captura de datos
      // Por ahora, solo mostrar instrucciones
      
    } catch (error) {
      console.error('❌ Error en crear usuario:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error iniciando creación de usuario');
    }
  }
  
  /**
   * /pausar [tid] - Pausar usuario
   */
  async pauseUser(msg, match) {
    try {
      const chatId = msg.chat.id;
      const trackerId = match[1]?.toUpperCase();
      
      if (!trackerId) {
        await this.bot.sendMessage(chatId, 
          '⚠️ Especifica el ID del usuario.\n\n*Ejemplo:* `/pausar JP`', 
          { parse_mode: 'Markdown' });
        return;
      }
      
      // Verificar que usuario existe
      const userResult = await db.query(
        'SELECT display_name, active FROM tracking_users WHERE tracker_id = $1',
        [trackerId]
      );
      
      if (userResult.rows.length === 0) {
        await this.bot.sendMessage(chatId, `❌ Usuario \`${trackerId}\` no encontrado`, { parse_mode: 'Markdown' });
        return;
      }
      
      const user = userResult.rows[0];
      
      if (!user.active) {
        await this.bot.sendMessage(chatId, `⏸️ Usuario \`${trackerId}\` ya está pausado`, { parse_mode: 'Markdown' });
        return;
      }
      
      // Pausar usuario
      await db.query(
        'UPDATE tracking_users SET active = false, updated_at = NOW() WHERE tracker_id = $1',
        [trackerId]
      );
      
      // Log de auditoría
      await this.logAdminAction('pause_user', trackerId, msg.from);
      
      await this.bot.sendMessage(chatId, 
        `⏸️ *Usuario pausado*\n\n👤 ${user.display_name} (\`${trackerId}\`)\n\n🚫 Ya no recibirá tracking GPS`, 
        { parse_mode: 'Markdown' });
      
      console.log(`⏸️ Usuario pausado: ${trackerId} (${user.display_name})`);
      
    } catch (error) {
      console.error('❌ Error pausando usuario:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error pausando usuario');
    }
  }
  
  /**
   * /activar [tid] - Activar usuario
   */
  async activateUser(msg, match) {
    try {
      const chatId = msg.chat.id;
      const trackerId = match[1]?.toUpperCase();
      
      if (!trackerId) {
        await this.bot.sendMessage(chatId, 
          '⚠️ Especifica el ID del usuario.\n\n*Ejemplo:* `/activar JP`', 
          { parse_mode: 'Markdown' });
        return;
      }
      
      // Verificar que usuario existe
      const userResult = await db.query(
        'SELECT display_name, active FROM tracking_users WHERE tracker_id = $1',
        [trackerId]
      );
      
      if (userResult.rows.length === 0) {
        await this.bot.sendMessage(chatId, `❌ Usuario \`${trackerId}\` no encontrado`, { parse_mode: 'Markdown' });
        return;
      }
      
      const user = userResult.rows[0];
      
      if (user.active) {
        await this.bot.sendMessage(chatId, `✅ Usuario \`${trackerId}\` ya está activo`, { parse_mode: 'Markdown' });
        return;
      }
      
      // Activar usuario
      await db.query(
        'UPDATE tracking_users SET active = true, updated_at = NOW() WHERE tracker_id = $1',
        [trackerId]
      );
      
      // Log de auditoría
      await this.logAdminAction('activate_user', trackerId, msg.from);
      
      await this.bot.sendMessage(chatId, 
        `✅ *Usuario activado*\n\n👤 ${user.display_name} (\`${trackerId}\`)\n\n📍 Tracking GPS reactivado`, 
        { parse_mode: 'Markdown' });
      
      console.log(`✅ Usuario activado: ${trackerId} (${user.display_name})`);
      
    } catch (error) {
      console.error('❌ Error activando usuario:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error activando usuario');
    }
  }
  
  /**
   * Manejar callbacks de usuarios
   */
  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      switch (data) {
        case 'user_create':
          await this.showCreateUserForm(chatId);
          break;
          
        case 'user_create_web':
          await this.openWebAppUsers(chatId);
          break;
          
        case 'user_stats':
          await this.showUserStats(chatId);
          break;
          
        case 'user_refresh':
          await this.refreshUserList(chatId, query.message.message_id);
          break;
          
        default:
          if (data.startsWith('user_toggle_')) {
            const trackerId = data.replace('user_toggle_', '');
            await this.toggleUserStatus(chatId, trackerId);
          }
      }
      
    } catch (error) {
      console.error('❌ Error en callback de usuarios:', error.message);
    }
  }
  
  /**
   * Mostrar formulario de creación (simplificado)
   */
  async showCreateUserForm(chatId) {
    const message = `
👤 *CREAR USUARIO*

Envía un mensaje con este formato:
\`TID|Email|Nombre\`

*Ejemplo:*
\`JP|juan.perez@zenput.com|Juan Pérez\`
`;
    
    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
  
  /**
   * Abrir Web App en sección usuarios
   */
  async openWebAppUsers(chatId) {
    const config = require('../../config/telegram').config;
    const webAppUrl = `${config.webAppUrl}/webapp#users`;
    
    await this.bot.sendMessage(chatId, '🖥️ *Panel de Usuarios*\n\nGestiona usuarios desde el panel web.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '👥 Gestionar Usuarios',
            web_app: { url: webAppUrl }
          }
        ]]
      }
    });
  }
  
  /**
   * Mostrar estadísticas de usuarios
   */
  async showUserStats(chatId) {
    try {
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE active = true) as activos,
          COUNT(*) FILTER (WHERE active = false) as pausados
        FROM tracking_users
      `);
      
      const stats = statsResult.rows[0];
      
      // Obtener actividad reciente
      const activityResult = await db.query(`
        SELECT 
          COUNT(DISTINCT tracker_id) as usuarios_con_actividad
        FROM tracking_locations
        WHERE gps_timestamp >= NOW() - INTERVAL '24 hours'
      `);
      
      const activity = activityResult.rows[0];
      
      const message = `
📊 *ESTADÍSTICAS DE USUARIOS*

👥 *Total:* ${stats.total}
🟢 *Activos:* ${stats.activos}
🔴 *Pausados:* ${stats.pausados}

📱 *Actividad (24h):*
🔍 *Con GPS:* ${activity.usuarios_con_actividad}

📈 *Estado:* ${((activity.usuarios_con_actividad / stats.activos) * 100).toFixed(1)}% reportando
`;
      
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('❌ Error obteniendo stats de usuarios:', error.message);
      await this.bot.sendMessage(chatId, '❌ Error obteniendo estadísticas');
    }
  }
  
  /**
   * Actualizar lista de usuarios
   */
  async refreshUserList(chatId, messageId) {
    try {
      // Simular el comando /usuarios pero editando el mensaje
      const result = await db.query(`
        SELECT 
          tracker_id,
          display_name,
          zenput_email,
          active
        FROM tracking_users
        ORDER BY display_name
      `);
      
      let message = '👥 *USUARIOS* (actualizado)\n\n';
      
      if (result.rows.length === 0) {
        message += '📝 No hay usuarios registrados';
      } else {
        result.rows.forEach(user => {
          const status = user.active ? '🟢' : '🔴';
          message += `${status} *${user.display_name}* (\`${user.tracker_id}\`)\n`;
        });
        
        message += `\n📊 Total: ${result.rows.length}`;
      }
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '➕ Nuevo', callback_data: 'user_create' },
            { text: '📊 Stats', callback_data: 'user_stats' }
          ]
        ]
      };
      
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('❌ Error refrescando lista:', error.message);
    }
  }
  
  /**
   * Log de acciones administrativas
   */
  async logAdminAction(action, entityId, user) {
    try {
      await db.query(`
        INSERT INTO tracking_admin_log (admin_user, action, entity_type, entity_id)
        VALUES ($1, $2, 'user', $3)
      `, [
        user.username || user.first_name || `id_${user.id}`,
        action,
        entityId
      ]);
    } catch (error) {
      console.error('❌ Error logging admin action:', error.message);
    }
  }
}

module.exports = new UsuariosCommands();