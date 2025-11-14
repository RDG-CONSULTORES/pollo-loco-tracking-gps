const bot = require('../bot');

/**
 * Sistema de Alertas de Geofencing para Telegram
 * Envía notificaciones automáticas cuando los supervisores entran/salen de sucursales
 */
class GeofenceAlerts {
  constructor() {
    this.alertChannels = [
      // Canal principal de administradores (por defecto usar el chat del bot)
      // TODO: Configurar chat IDs específicos desde tracking_config
    ];
    
    // Configuración de alertas
    this.config = {
      enableAlerts: true,
      alertDelay: 1000, // 1 segundo de delay para evitar spam
      includeLocation: true,
      includeDistance: true,
      includeBattery: true,
      includeAccuracy: true
    };
  }

  /**
   * Enviar alerta de geofencing
   * @param {Object} event - Evento de geofencing
   * @param {Object} user - Datos del usuario
   * @param {Object} geofence - Datos del geofence/sucursal
   */
  async sendAlert(event, user, geofence) {
    try {
      console.log(`📱 [TELEGRAM-ALERT] Preparing ${event.event_type} alert for ${user.display_name}`);
      
      if (!this.config.enableAlerts) {
        console.log('📱 [TELEGRAM-ALERT] Alerts disabled');
        return;
      }

      // Generar mensaje de alerta
      const message = this.generateAlertMessage(event, user, geofence);
      
      // Obtener canales de destino
      const channels = await this.getAlertChannels(event, geofence);
      
      // Enviar a cada canal
      for (const chatId of channels) {
        try {
          await this.sendToChannel(chatId, message, event, geofence);
          console.log(`📱 [TELEGRAM-ALERT] Alert sent to channel ${chatId}`);
        } catch (error) {
          console.error(`❌ [TELEGRAM-ALERT] Error sending to channel ${chatId}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ [TELEGRAM-ALERT] Error sending alert:', error);
      throw error;
    }
  }

  /**
   * Generar mensaje de alerta personalizado
   * @param {Object} event - Evento de geofencing  
   * @param {Object} user - Datos del usuario
   * @param {Object} geofence - Datos del geofence
   * @returns {string} - Mensaje formateado
   */
  generateAlertMessage(event, user, geofence) {
    const isEntry = event.event_type === 'enter';
    const icon = isEntry ? '🟢' : '🔴';
    const action = isEntry ? 'ENTRADA' : 'SALIDA';
    const verb = isEntry ? 'ingresó a' : 'salió de';
    
    const timestamp = new Date(event.event_timestamp).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let message = `${icon} *${action} DETECTADA*\n\n`;
    message += `👤 *${user.display_name}* (${user.tracker_id})\n`;
    message += `${verb}\n`;
    message += `🏢 *${geofence.store_name || 'Sucursal desconocida'}*\n`;
    
    if (geofence.group_name) {
      message += `📍 ${geofence.group_name}\n`;
    }
    
    message += `🕒 ${timestamp}\n`;
    
    // Información de distancia
    if (this.config.includeDistance && event.distance_from_center) {
      const distance = Math.round(parseFloat(event.distance_from_center));
      message += `📏 ${distance}m del centro\n`;
    }
    
    // Información de precisión
    if (this.config.includeAccuracy && event.accuracy_meters) {
      message += `🎯 Precisión: ${event.accuracy_meters}m\n`;
    }
    
    // Información de batería
    if (this.config.includeBattery && event.battery_percentage) {
      const batteryIcon = this.getBatteryIcon(event.battery_percentage);
      message += `${batteryIcon} Batería: ${event.battery_percentage}%\n`;
    }
    
    // Link a Google Maps
    if (this.config.includeLocation) {
      const lat = parseFloat(event.latitude).toFixed(6);
      const lon = parseFloat(event.longitude).toFixed(6);
      message += `\n🗺️ [Ver en Mapa](https://maps.google.com/maps?q=${lat},${lon})\n`;
    }
    
    // Footer con ID del evento para debugging
    message += `\n_ID: ${event.id}_`;
    
    return message;
  }

  /**
   * Obtener icono de batería según el porcentaje
   * @param {number} percentage - Porcentaje de batería
   * @returns {string} - Icono
   */
  getBatteryIcon(percentage) {
    if (percentage >= 80) return '🔋';
    if (percentage >= 50) return '🔋';
    if (percentage >= 20) return '🪫';
    return '📱';
  }

  /**
   * Obtener canales de destino para las alertas
   * @param {Object} event - Evento de geofencing
   * @param {Object} geofence - Datos del geofence
   * @returns {Promise<Array>} - Array de chat IDs
   */
  async getAlertChannels(event, geofence) {
    try {
      // Por ahora usar configuración simple
      // TODO: Implementar lógica de roles y grupos
      
      // Canal principal (admin que configuró el bot)
      const channels = [];
      
      // Buscar admin chat ID desde configuración
      const adminChatId = await this.getAdminChatId();
      if (adminChatId) {
        channels.push(adminChatId);
      }
      
      // TODO: Agregar canales específicos por grupo/zona
      // Ejemplo: Si es TEPEYAC, enviar a canal de TEPEYAC
      // Si es supervisor específico, enviar a su gerente
      
      console.log(`📱 [TELEGRAM-ALERT] Target channels: ${channels.join(', ')}`);
      return channels;
      
    } catch (error) {
      console.error('❌ [TELEGRAM-ALERT] Error getting alert channels:', error);
      return [];
    }
  }

  /**
   * Obtener chat ID del administrador principal
   * @returns {Promise<string|null>}
   */
  async getAdminChatId() {
    try {
      const db = require('../../config/database');
      
      // Buscar en logs de Telegram el último admin que usó comandos
      const result = await db.query(`
        SELECT DISTINCT chat_id 
        FROM tracking_admin_log 
        WHERE admin_user LIKE '%telegram%' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        return result.rows[0].chat_id;
      }
      
      // Fallback: usar admin ID de variables de entorno
      const adminIds = process.env.TELEGRAM_ADMIN_IDS;
      if (adminIds && adminIds !== '0') {
        return adminIds.split(',')[0];
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ [TELEGRAM-ALERT] Error getting admin chat ID:', error);
      return null;
    }
  }

  /**
   * Enviar mensaje a un canal específico
   * @param {string} chatId - ID del chat
   * @param {string} message - Mensaje a enviar
   * @param {Object} event - Evento de geofencing
   * @param {Object} geofence - Datos del geofence
   */
  async sendToChannel(chatId, message, event, geofence) {
    try {
      // Verificar que el bot esté inicializado
      if (!bot) {
        throw new Error('Telegram bot not initialized');
      }

      // Enviar mensaje con formato Markdown
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🗺️ Ver Ubicación',
                url: `https://maps.google.com/maps?q=${event.latitude},${event.longitude}`
              },
              {
                text: '📊 Ver Dashboard',
                callback_data: 'open_webapp'
              }
            ],
            [
              {
                text: '📱 Ver en App',
                web_app: {
                  url: `${process.env.WEB_APP_URL}/webapp#ubicaciones`
                }
              }
            ]
          ]
        }
      });

      // Log exitoso
      console.log(`✅ [TELEGRAM-ALERT] Alert sent successfully to ${chatId}`);
      
    } catch (error) {
      console.error(`❌ [TELEGRAM-ALERT] Error sending to channel ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Enviar resumen diario de eventos
   * @param {string} chatId - Chat de destino
   * @returns {Promise<void>}
   */
  async sendDailySummary(chatId) {
    try {
      console.log('📊 [TELEGRAM-ALERT] Generating daily summary...');
      
      const db = require('../../config/database');
      
      // Estadísticas del día
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE event_type = 'enter') as entries,
          COUNT(*) FILTER (WHERE event_type = 'exit') as exits,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT location_code) as unique_locations
        FROM geofence_events
        WHERE DATE(event_timestamp) = CURRENT_DATE
      `);
      
      const stats = statsResult.rows[0];
      
      // Usuarios más activos
      const activeUsersResult = await db.query(`
        SELECT 
          tu.display_name,
          tu.tracker_id,
          COUNT(*) as events_count
        FROM geofence_events ge
        INNER JOIN tracking_users tu ON ge.user_id = tu.id
        WHERE DATE(ge.event_timestamp) = CURRENT_DATE
        GROUP BY tu.id, tu.display_name, tu.tracker_id
        ORDER BY events_count DESC
        LIMIT 5
      `);
      
      // Sucursales más visitadas
      const topLocationsResult = await db.query(`
        SELECT 
          sg.store_name,
          COUNT(*) FILTER (WHERE event_type = 'enter') as visits
        FROM geofence_events ge
        INNER JOIN sucursal_geofences sg ON ge.location_code = sg.location_code
        WHERE DATE(ge.event_timestamp) = CURRENT_DATE
        GROUP BY sg.store_name
        HAVING COUNT(*) FILTER (WHERE event_type = 'enter') > 0
        ORDER BY visits DESC
        LIMIT 5
      `);

      // Generar mensaje
      const today = new Date().toLocaleDateString('es-MX');
      
      let message = `📊 *RESUMEN DIARIO DE GEOFENCING*\n`;
      message += `📅 ${today}\n\n`;
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      message += `📈 *ESTADÍSTICAS GENERALES*\n`;
      message += `• Total eventos: ${stats.total_events || 0}\n`;
      message += `• Entradas: ${stats.entries || 0}\n`;
      message += `• Salidas: ${stats.exits || 0}\n`;
      message += `• Supervisores activos: ${stats.unique_users || 0}\n`;
      message += `• Sucursales visitadas: ${stats.unique_locations || 0}\n\n`;
      
      if (activeUsersResult.rows.length > 0) {
        message += `👥 *SUPERVISORES MÁS ACTIVOS*\n`;
        activeUsersResult.rows.forEach((user, index) => {
          message += `${index + 1}. ${user.display_name} (${user.tracker_id}) - ${user.events_count} eventos\n`;
        });
        message += `\n`;
      }
      
      if (topLocationsResult.rows.length > 0) {
        message += `🏢 *SUCURSALES MÁS VISITADAS*\n`;
        topLocationsResult.rows.forEach((location, index) => {
          message += `${index + 1}. ${location.store_name} - ${location.visits} visitas\n`;
        });
      }
      
      message += `\n📱 [Ver Dashboard Completo](${process.env.WEB_APP_URL}/webapp)`;
      
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📊 Abrir Dashboard',
                web_app: {
                  url: `${process.env.WEB_APP_URL}/webapp`
                }
              }
            ]
          ]
        }
      });
      
      console.log('✅ [TELEGRAM-ALERT] Daily summary sent');
      
    } catch (error) {
      console.error('❌ [TELEGRAM-ALERT] Error sending daily summary:', error);
    }
  }

  /**
   * Configurar alertas para un chat específico
   * @param {string} chatId - Chat ID
   * @param {Object} settings - Configuración de alertas
   */
  async configureAlerts(chatId, settings) {
    try {
      // TODO: Guardar configuración en base de datos
      console.log(`⚙️ [TELEGRAM-ALERT] Configuring alerts for chat ${chatId}`);
      
      const db = require('../../config/database');
      
      await db.setConfig(`geofence_alerts_${chatId}`, JSON.stringify(settings));
      
      console.log('✅ [TELEGRAM-ALERT] Alerts configured successfully');
      
    } catch (error) {
      console.error('❌ [TELEGRAM-ALERT] Error configuring alerts:', error);
    }
  }

  /**
   * Procesar eventos pendientes de envío
   */
  async processPendingAlerts() {
    try {
      const db = require('../../config/database');
      
      const result = await db.query(`
        SELECT 
          ge.*,
          tu.display_name, tu.tracker_id,
          sg.store_name, sg.group_name
        FROM geofence_events ge
        INNER JOIN tracking_users tu ON ge.user_id = tu.id
        INNER JOIN sucursal_geofences sg ON ge.location_code = sg.location_code
        WHERE ge.telegram_sent = false
          AND ge.telegram_error IS NULL
          AND ge.event_timestamp >= NOW() - INTERVAL '1 hour'
        ORDER BY ge.event_timestamp ASC
        LIMIT 10
      `);
      
      for (const row of result.rows) {
        try {
          const event = {
            id: row.id,
            user_id: row.user_id,
            event_type: row.event_type,
            latitude: row.latitude,
            longitude: row.longitude,
            distance_from_center: row.distance_from_center,
            event_timestamp: row.event_timestamp,
            accuracy_meters: row.accuracy_meters,
            battery_percentage: row.battery_percentage
          };
          
          const user = {
            display_name: row.display_name,
            tracker_id: row.tracker_id
          };
          
          const geofence = {
            store_name: row.store_name,
            group_name: row.group_name
          };
          
          await this.sendAlert(event, user, geofence);
          
          // Marcar como enviado
          await db.query(`
            UPDATE geofence_events 
            SET telegram_sent = true, telegram_sent_at = NOW()
            WHERE id = $1
          `, [event.id]);
          
        } catch (error) {
          console.error(`❌ [TELEGRAM-ALERT] Error processing pending alert ${row.id}:`, error);
          
          // Marcar error
          await db.query(`
            UPDATE geofence_events 
            SET telegram_error = $1
            WHERE id = $2
          `, [error.message, row.id]);
        }
      }
      
      if (result.rows.length > 0) {
        console.log(`📱 [TELEGRAM-ALERT] Processed ${result.rows.length} pending alerts`);
      }
      
    } catch (error) {
      console.error('❌ [TELEGRAM-ALERT] Error processing pending alerts:', error);
    }
  }
}

module.exports = GeofenceAlerts;