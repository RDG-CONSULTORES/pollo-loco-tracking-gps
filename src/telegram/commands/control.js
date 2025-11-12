const db = require('../../config/database');

/**
 * Comandos de control del sistema
 */
class ControlCommands {
  
  /**
   * /estado - Ver estado del sistema
   */
  async status(msg) {
    try {
      const chatId = msg.chat.id;
      
      // Obtener configuración del sistema
      const systemActive = await db.getConfig('system_active', 'false');
      const workHoursStart = await db.getConfig('work_hours_start', '07:00');
      const workHoursEnd = await db.getConfig('work_hours_end', '21:00');
      
      // Obtener estadísticas
      const stats = await this.getSystemStats();
      
      // Estado del sistema
      const isActive = systemActive === 'true';
      const statusIcon = isActive ? '🟢' : '🔴';
      const statusText = isActive ? 'ACTIVO' : 'PAUSADO';
      
      // Verificar horario laboral actual
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 5);
      const isWorkingHours = currentTime >= workHoursStart && currentTime <= workHoursEnd;
      const workIcon = isWorkingHours ? '🟢' : '🟡';
      
      let message = `
🐔 *ESTADO DEL SISTEMA*

${statusIcon} *Estado:* ${statusText}
${workIcon} *Horario:* ${workHoursStart} - ${workHoursEnd}
⏰ *Hora actual:* ${currentTime}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *ESTADÍSTICAS DE HOY*

👥 *Usuarios activos:* ${stats.activeUsers}
📍 *Ubicaciones recibidas:* ${stats.locationsToday}
🏢 *Visitas registradas:* ${stats.visitsToday}
📱 *Usuarios reportando:* ${stats.usersReporting}

📈 *Cobertura:* ${stats.coveragePercentage}%
`;

      // Estado de bases de datos
      message += `\n🗄️ *CONEXIONES*\n`;
      message += `✅ Railway DB: Conectada\n`;
      
      try {
        const zenputDB = require('../../config/zenput-database');
        await zenputDB.query('SELECT 1');
        message += `✅ Zenput DB: Conectada`;
      } catch (error) {
        message += `❌ Zenput DB: Error`;
      }
      
      // Botones de control
      const keyboard = {
        inline_keyboard: [
          [
            isActive 
              ? { text: '⏸️ Pausar Sistema', callback_data: 'system_pause' }
              : { text: '▶️ Activar Sistema', callback_data: 'system_activate' }
          ],
          [
            { text: '📊 Detalles', callback_data: 'system_details' },
            { text: '🔄 Actualizar', callback_data: 'system_refresh' }
          ],
          [
            { text: '⚙️ Configuración', callback_data: 'system_config' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo estado:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error obteniendo estado del sistema');
    }
  }
  
  /**
   * /pausar_sistema - Pausar el sistema de tracking
   */
  async pauseSystem(msg) {
    try {
      const chatId = msg.chat.id;
      
      const success = await db.setConfig('system_active', 'false');
      
      if (success) {
        // await this.logAdminAction('pause_system', 'system', msg.from);
        
        await this.bot.sendMessage(chatId, 
          `⏸️ *SISTEMA PAUSADO*\n\n🚫 El tracking GPS ha sido pausado.\nNo se procesarán nuevas ubicaciones.\n\nPara reactivar: \`/activar_sistema\``, 
          { parse_mode: 'Markdown' });
        
        console.log('⏸️ Sistema pausado por admin');
      } else {
        await this.bot.sendMessage(chatId, '❌ Error pausando el sistema');
      }
      
    } catch (error) {
      console.error('❌ Error pausando sistema:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error pausando el sistema');
    }
  }
  
  /**
   * /activar_sistema - Activar el sistema de tracking
   */
  /**
   * /pausar [ID] - Pausar usuario específico
   */
  async pauseUser(msg, match) {
    try {
      const chatId = msg.chat.id;
      
      if (!match || !match[1]) {
        await this.bot.sendMessage(chatId, 
          '⚠️ *Uso correcto:* `/pausar [ID]`\n\nEjemplo: `/pausar JP`',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const trackerId = match[1].trim().toUpperCase();
      
      const result = await db.query(
        'UPDATE tracking_users SET active = false WHERE tracker_id = $1 RETURNING *',
        [trackerId]
      );
      
      if (result.rows.length === 0) {
        await this.bot.sendMessage(chatId, `❌ Usuario "${trackerId}" no encontrado.`);
        return;
      }
      
      const user = result.rows[0];
      await this.bot.sendMessage(chatId, 
        `⏸️ *Usuario pausado*\n\n👤 ${user.display_name} (${trackerId})\n\nNo se procesarán sus ubicaciones GPS.`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('❌ Error pausando usuario:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error pausando usuario.');
    }
  }
  
  /**
   * /activar [ID] - Activar usuario específico
   */
  async activateUser(msg, match) {
    try {
      const chatId = msg.chat.id;
      
      if (!match || !match[1]) {
        await this.bot.sendMessage(chatId, 
          '⚠️ *Uso correcto:* `/activar [ID]`\n\nEjemplo: `/activar JP`',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const trackerId = match[1].trim().toUpperCase();
      
      const result = await db.query(
        'UPDATE tracking_users SET active = true WHERE tracker_id = $1 RETURNING *',
        [trackerId]
      );
      
      if (result.rows.length === 0) {
        await this.bot.sendMessage(chatId, `❌ Usuario "${trackerId}" no encontrado.`);
        return;
      }
      
      const user = result.rows[0];
      await this.bot.sendMessage(chatId, 
        `✅ *Usuario activado*\n\n👤 ${user.display_name} (${trackerId})\n\nSus ubicaciones GPS se procesarán normalmente.`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('❌ Error activando usuario:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error activando usuario.');
    }
  }

  async activateSystem(msg) {
    try {
      const chatId = msg.chat.id;
      
      const success = await db.setConfig('system_active', 'true');
      
      if (success) {
        // await this.logAdminAction('activate_system', 'system', msg.from);
        
        await this.bot.sendMessage(chatId, 
          `✅ *SISTEMA ACTIVADO*\n\n📍 El tracking GPS está activo.\nSe procesarán ubicaciones en horario laboral.\n\nPara pausar: \`/pausar_sistema\``, 
          { parse_mode: 'Markdown' });
        
        console.log('✅ Sistema activado por admin');
      } else {
        await this.bot.sendMessage(chatId, '❌ Error activando el sistema');
      }
      
    } catch (error) {
      console.error('❌ Error activando sistema:', error.message);
      await this.bot.sendMessage(msg.chat.id, '❌ Error activando el sistema');
    }
  }
  
  /**
   * Manejar callbacks de control
   */
  async handleCallback(query) {
    try {
      const chatId = query.message.chat.id;
      const data = query.data;
      
      switch (data) {
        case 'system_pause':
          await this.pauseSystemCallback(chatId, query.from);
          break;
          
        case 'system_activate':
          await this.activateSystemCallback(chatId, query.from);
          break;
          
        case 'system_details':
          await this.showSystemDetails(chatId);
          break;
          
        case 'system_refresh':
          await this.refreshSystemStatus(chatId, query.message.message_id);
          break;
          
        case 'system_config':
          await this.showSystemConfig(chatId);
          break;
          
        default:
          await this.bot.sendMessage(chatId, '⚠️ Comando no reconocido');
      }
      
    } catch (error) {
      console.error('❌ Error en callback de control:', error.message);
    }
  }
  
  /**
   * Pausar sistema vía callback
   */
  async pauseSystemCallback(chatId, user) {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Sí, pausar', callback_data: 'system_pause_confirm' },
          { text: '❌ Cancelar', callback_data: 'system_pause_cancel' }
        ]
      ]
    };
    
    await this.bot.sendMessage(chatId, 
      '⚠️ *¿Pausar el sistema?*\n\nEsto detendrá todo el tracking GPS.\n\n¿Estás seguro?', 
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
  }
  
  /**
   * Activar sistema vía callback
   */
  async activateSystemCallback(chatId, user) {
    const success = await db.setConfig('system_active', 'true', this.getAdminUser(user));
    
    if (success) {
      await this.logAdminAction('activate_system', 'system', user);
      await this.bot.sendMessage(chatId, '✅ *Sistema activado*\n\n📍 Tracking GPS reactivado', { parse_mode: 'Markdown' });
    } else {
      await this.bot.sendMessage(chatId, '❌ Error activando el sistema');
    }
  }
  
  /**
   * Mostrar detalles del sistema
   */
  async showSystemDetails(chatId) {
    try {
      const stats = await this.getDetailedStats();
      
      let message = `
🔍 *DETALLES DEL SISTEMA*

📊 *Usuarios:*
• Total: ${stats.users.total}
• Activos: ${stats.users.active}
• Con GPS reciente: ${stats.users.reporting}

🏢 *Sucursales:*
• Total: ${stats.locations.total}
• Activas: ${stats.locations.active}
• Visitadas hoy: ${stats.locations.visited_today}

📱 *Ubicaciones (24h):*
• Recibidas: ${stats.gps.received}
• Procesadas: ${stats.gps.processed}
• Rechazadas: ${stats.gps.rejected}

🔄 *Rendimiento:*
• Precisión promedio: ${stats.performance.avg_accuracy}m
• Batería promedio: ${stats.performance.avg_battery}%
`;
      
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('❌ Error obteniendo detalles:', error.message);
      await this.bot.sendMessage(chatId, '❌ Error obteniendo detalles del sistema');
    }
  }
  
  /**
   * Actualizar estado del sistema
   */
  async refreshSystemStatus(chatId, messageId) {
    try {
      // Re-obtener datos
      const systemActive = await db.getConfig('system_active', 'false');
      const stats = await this.getSystemStats();
      
      const isActive = systemActive === 'true';
      const statusIcon = isActive ? '🟢' : '🔴';
      const statusText = isActive ? 'ACTIVO' : 'PAUSADO';
      
      const message = `
🐔 *ESTADO* (actualizado ${new Date().toLocaleTimeString('es-MX')})

${statusIcon} *Sistema:* ${statusText}
👥 *Usuarios activos:* ${stats.activeUsers}
📍 *Ubicaciones hoy:* ${stats.locationsToday}
🏢 *Visitas hoy:* ${stats.visitsToday}
`;
      
      const keyboard = {
        inline_keyboard: [
          [
            isActive 
              ? { text: '⏸️ Pausar', callback_data: 'system_pause' }
              : { text: '▶️ Activar', callback_data: 'system_activate' }
          ],
          [
            { text: '🔄 Actualizar', callback_data: 'system_refresh' }
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
      console.error('❌ Error refrescando estado:', error.message);
    }
  }
  
  /**
   * Obtener estadísticas básicas del sistema
   */
  async getSystemStats() {
    try {
      // Usuarios activos
      const usersResult = await db.query('SELECT COUNT(*) as count FROM tracking_users WHERE active = true');
      
      // Ubicaciones hoy
      const locationsResult = await db.query(`
        SELECT COUNT(*) as count FROM tracking_locations 
        WHERE DATE(gps_timestamp) = CURRENT_DATE
      `);
      
      // Visitas hoy
      const visitsResult = await db.query(`
        SELECT COUNT(*) as count FROM tracking_visits 
        WHERE DATE(entrada_at) = CURRENT_DATE
      `);
      
      // Usuarios reportando hoy
      const reportingResult = await db.query(`
        SELECT COUNT(DISTINCT tracker_id) as count FROM tracking_locations 
        WHERE DATE(gps_timestamp) = CURRENT_DATE
      `);
      
      // Cobertura
      const coverageResult = await db.query(`
        SELECT 
          (SELECT COUNT(DISTINCT location_code) FROM tracking_visits WHERE DATE(entrada_at) = CURRENT_DATE) as visited,
          (SELECT COUNT(*) FROM tracking_locations_cache WHERE active = true) as total
      `);
      
      const coverage = coverageResult.rows[0];
      const coveragePercentage = coverage.total > 0 ? Math.round((coverage.visited / coverage.total) * 100) : 0;
      
      return {
        activeUsers: parseInt(usersResult.rows[0].count),
        locationsToday: parseInt(locationsResult.rows[0].count),
        visitsToday: parseInt(visitsResult.rows[0].count),
        usersReporting: parseInt(reportingResult.rows[0].count),
        coveragePercentage
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      return {
        activeUsers: 0,
        locationsToday: 0,
        visitsToday: 0,
        usersReporting: 0,
        coveragePercentage: 0
      };
    }
  }
  
  /**
   * Obtener estadísticas detalladas
   */
  async getDetailedStats() {
    // TODO: Implementar estadísticas detalladas
    // Por ahora retornar estructura básica
    return {
      users: { total: 0, active: 0, reporting: 0 },
      locations: { total: 0, active: 0, visited_today: 0 },
      gps: { received: 0, processed: 0, rejected: 0 },
      performance: { avg_accuracy: 0, avg_battery: 0 }
    };
  }
  
  /**
   * Obtener identificador de usuario admin
   */
  getAdminUser(user) {
    return user.username || user.first_name || `id_${user.id}`;
  }
  
  /**
   * Log de acciones administrativas
   */
  async logAdminAction(action, entityId, user) {
    try {
      await db.query(`
        INSERT INTO tracking_admin_log (admin_user, action, entity_type, entity_id)
        VALUES ($1, $2, 'system', $3)
      `, [
        this.getAdminUser(user),
        action,
        entityId
      ]);
    } catch (error) {
      console.error('❌ Error logging admin action:', error.message);
    }
  }
}

module.exports = new ControlCommands();