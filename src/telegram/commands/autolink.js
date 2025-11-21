/**
 * Comando /start con Auto-vinculación de usuarios EPL CAS
 * Mini-Step 1C: Telegram Auto-Detection & Linking
 */

const db = require('../../config/database');

/**
 * Comando /start con parámetros para auto-vinculación
 * Formato: /start TRACKER_ID o /start (detección automática)
 */
async function startCommand(msg, match) {
  const bot = this.bot;
  const chatId = msg.chat.id;
  const telegramUser = msg.from;
  const startParam = match ? match[1] : null;

  console.log('🚀 /start command received:', {
    user: telegramUser.username || telegramUser.first_name,
    telegram_id: telegramUser.id,
    param: startParam,
    chat_type: msg.chat.type
  });

  try {
    // Verificar si es un grupo/canal
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(chatId, 
        '🔒 Este bot solo funciona en conversaciones privadas.\n' +
        'Por favor, escríbeme en privado para configurar tu cuenta.'
      );
      return;
    }

    // Caso 1: Start con parámetro (desde QR code)
    if (startParam) {
      await handleParameterStart(bot, chatId, telegramUser, startParam);
      return;
    }

    // Caso 2: Start sin parámetro - Auto-detección
    await handleAutoDetection(bot, chatId, telegramUser);

  } catch (error) {
    console.error('❌ Error en /start:', error.message);
    await bot.sendMessage(chatId,
      '❌ Error interno. Contacta al administrador del sistema.\n\n' +
      `Error: ${error.message}`
    );
  }
}

/**
 * Manejar /start con parámetro (QR code scan)
 */
async function handleParameterStart(bot, chatId, telegramUser, trackerId) {
  try {
    console.log('🎯 Procesando vinculación QR:', trackerId);

    // Buscar usuario por tracker_id
    const userResult = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1 AND active = true',
      [trackerId]
    );

    if (userResult.rows.length === 0) {
      await bot.sendMessage(chatId,
        '❌ *Código QR inválido*\n\n' +
        'El código escaneado no corresponde a ningún usuario válido.\n' +
        'Verifica que el QR sea correcto o contacta al administrador.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const user = userResult.rows[0];

    // Verificar si ya está vinculado
    if (user.telegram_id && user.telegram_id !== telegramUser.id.toString()) {
      await bot.sendMessage(chatId,
        '⚠️ *Usuario ya vinculado*\n\n' +
        `Este usuario (${user.display_name}) ya está vinculado a otra cuenta de Telegram.\n\n` +
        'Si necesitas cambiar la vinculación, contacta al administrador.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Realizar vinculación
    await linkTelegramUser(user, telegramUser);

    // Mensaje de éxito personalizado
    const welcomeMessage = generateWelcomeMessage(user, telegramUser);
    await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });

    // Enviar menú principal
    await sendMainMenu(bot, chatId, user);

  } catch (error) {
    console.error('❌ Error en vinculación QR:', error.message);
    throw error;
  }
}

/**
 * Manejar auto-detección sin parámetro
 */
async function handleAutoDetection(bot, chatId, telegramUser) {
  try {
    console.log('🔍 Iniciando auto-detección para:', telegramUser);

    // Verificar si ya está registrado
    const existingResult = await db.query(
      'SELECT * FROM tracking_users WHERE telegram_id = $1',
      [telegramUser.id.toString()]
    );

    if (existingResult.rows.length > 0) {
      const user = existingResult.rows[0];
      await bot.sendMessage(chatId,
        `👋 ¡Hola de nuevo, *${user.display_name}*!\n\n` +
        `🏢 ${user.position || 'Sin posición'}\n` +
        `📍 Grupo: ${user.role || 'Sin rol'}\n\n` +
        'Tu cuenta ya está configurada. Usa el menú para navegar.',
        { parse_mode: 'Markdown' }
      );
      
      await sendMainMenu(bot, chatId, user);
      return;
    }

    // Auto-detección por username
    if (telegramUser.username) {
      const usernameResult = await db.query(`
        SELECT * FROM tracking_users 
        WHERE LOWER(email) LIKE $1 
           OR LOWER(display_name) LIKE $2
           OR username = $3
        LIMIT 3`,
        [
          `%${telegramUser.username.toLowerCase()}%`,
          `%${telegramUser.first_name.toLowerCase()}%`,
          telegramUser.username.toLowerCase()
        ]
      );

      if (usernameResult.rows.length === 1) {
        // Match único - proponer vinculación
        await proposeAutoLink(bot, chatId, telegramUser, usernameResult.rows[0]);
        return;
      } else if (usernameResult.rows.length > 1) {
        // Múltiples matches - mostrar opciones
        await showMultipleMatches(bot, chatId, telegramUser, usernameResult.rows);
        return;
      }
    }

    // No se pudo auto-detectar - mostrar opciones
    await showRegistrationOptions(bot, chatId, telegramUser);

  } catch (error) {
    console.error('❌ Error en auto-detección:', error.message);
    throw error;
  }
}

/**
 * Proponer auto-vinculación
 */
async function proposeAutoLink(bot, chatId, telegramUser, user) {
  const message = 
    `🎯 *¿Eres tú?*\n\n` +
    `👤 **${user.display_name}**\n` +
    `🏢 ${user.position || 'Sin posición'}\n` +
    `📧 ${user.email || 'Sin email'}\n` +
    `📍 ${user.role || 'Sin rol'}\n\n` +
    `He encontrado este usuario que podría ser tuyo basado en tu username de Telegram (@${telegramUser.username}).\n\n` +
    `¿Confirmas que eres esta persona?`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Sí, soy yo', callback_data: `autolink_confirm_${user.id}` },
          { text: '❌ No soy yo', callback_data: 'autolink_reject' }
        ],
        [
          { text: '📝 Necesito registro manual', callback_data: 'manual_register' }
        ]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

/**
 * Mostrar múltiples coincidencias
 */
async function showMultipleMatches(bot, chatId, telegramUser, matches) {
  let message = 
    `🔍 *Encontré varias coincidencias*\n\n` +
    `Selecciona tu usuario de la lista:\n\n`;

  const keyboard = [];
  
  matches.forEach((user, index) => {
    message += `${index + 1}. **${user.display_name}**\n`;
    message += `   🏢 ${user.position || 'Sin posición'}\n`;
    message += `   📧 ${user.email || 'Sin email'}\n\n`;
    
    keyboard.push([{
      text: `${index + 1}. ${user.display_name}`,
      callback_data: `autolink_select_${user.id}`
    }]);
  });

  keyboard.push([
    { text: '❌ Ninguno soy yo', callback_data: 'autolink_reject' },
    { text: '📝 Registro manual', callback_data: 'manual_register' }
  ]);

  const options = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  };

  await bot.sendMessage(chatId, message, options);
}

/**
 * Mostrar opciones de registro
 */
async function showRegistrationOptions(bot, chatId, telegramUser) {
  const message = 
    `👋 *¡Hola ${telegramUser.first_name}!*\n\n` +
    `No pude encontrar tu usuario automáticamente.\n\n` +
    `**Opciones disponibles:**\n\n` +
    `🔗 **Escanear QR**: Si tienes un código QR de tu usuario\n` +
    `📝 **Registro manual**: Si eres nuevo en el sistema\n` +
    `🆘 **Contactar admin**: Si necesitas ayuda\n\n` +
    `⚡ *Tip*: Si ya tienes una cuenta, pide a tu administrador que genere tu QR de Telegram.`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 Registro manual', callback_data: 'manual_register' }
        ],
        [
          { text: '🆘 Contactar administrador', callback_data: 'contact_admin' },
          { text: '❓ Ayuda', callback_data: 'show_help' }
        ]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

/**
 * Vincular usuario de Telegram
 */
async function linkTelegramUser(user, telegramUser) {
  try {
    await db.query(`
      UPDATE tracking_users SET
        telegram_id = $1,
        telegram_username = $2,
        telegram_first_name = $3,
        telegram_last_name = $4,
        detection_status = 'linked',
        detection_method = 'telegram_bot',
        updated_at = NOW()
      WHERE id = $5
    `, [
      telegramUser.id.toString(),
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      user.id
    ]);

    console.log('✅ Usuario vinculado:', {
      user_id: user.id,
      display_name: user.display_name,
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username
    });

  } catch (error) {
    console.error('❌ Error vinculando usuario:', error.message);
    throw error;
  }
}

/**
 * Generar mensaje de bienvenida personalizado
 */
function generateWelcomeMessage(user, telegramUser) {
  return (
    `🎉 *¡Vinculación exitosa!*\n\n` +
    `👋 Hola **${user.display_name}**, bienvenido al sistema de tracking EPL CAS.\n\n` +
    `📋 **Tu información:**\n` +
    `🏢 Posición: ${user.position || 'Sin definir'}\n` +
    `📍 Rol: ${user.role || 'Sin definir'}\n` +
    `📱 Telegram: @${telegramUser.username || telegramUser.first_name}\n\n` +
    `🔔 **Notificaciones activadas**: Recibirás alertas cuando salgas de tus zonas asignadas.\n\n` +
    `💡 *Usa el menú para navegar por las opciones disponibles.*`
  );
}

/**
 * Enviar menú principal
 */
async function sendMainMenu(bot, chatId, user) {
  const isDirector = user.role === 'director';
  const isManager = ['director', 'manager'].includes(user.role);

  const keyboard = [
    [{ text: '📍 Mi ubicación actual', callback_data: 'my_location' }]
  ];

  if (isManager) {
    keyboard.push([
      { text: '📊 Ver dashboard', callback_data: 'view_dashboard' },
      { text: '👥 Gestionar usuarios', callback_data: 'manage_users' }
    ]);
  }

  if (isDirector) {
    keyboard.push([
      { text: '📈 Reportes ejecutivos', callback_data: 'executive_reports' },
      { text: '⚙️ Configuración', callback_data: 'settings' }
    ]);
  }

  keyboard.push([
    { text: '❓ Ayuda', callback_data: 'show_help' },
    { text: '🔧 Soporte', callback_data: 'contact_admin' }
  ]);

  const options = {
    reply_markup: { inline_keyboard: keyboard }
  };

  await bot.sendMessage(chatId,
    `📱 *Menú Principal*\n\nSelecciona una opción:`,
    { ...options, parse_mode: 'Markdown' }
  );
}

/**
 * Manejar callbacks de auto-vinculación
 */
async function handleAutolinkCallback(bot, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const telegramUser = callbackQuery.from;

  try {
    if (data.startsWith('autolink_confirm_')) {
      const userId = parseInt(data.split('_')[2]);
      
      // Obtener usuario de la base de datos
      const userResult = await db.query(
        'SELECT * FROM tracking_users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Usuario no encontrado',
          show_alert: true
        });
        return;
      }

      const user = userResult.rows[0];
      
      // Realizar vinculación
      await linkTelegramUser(user, telegramUser);
      
      // Editar mensaje
      await bot.editMessageText(
        generateWelcomeMessage(user, telegramUser),
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }
      );
      
      // Enviar menú
      await sendMainMenu(bot, chatId, user);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '✅ Vinculación exitosa!'
      });

    } else if (data.startsWith('autolink_select_')) {
      const userId = parseInt(data.split('_')[2]);
      
      // Similar al confirm pero para selección múltiple
      await handleAutolinkConfirm(bot, callbackQuery, userId);

    } else if (data === 'autolink_reject') {
      await bot.editMessageText(
        '❌ *Vinculación cancelada*\n\n' +
        'No se ha vinculado ningún usuario. Puedes intentar con registro manual o contactar al administrador.',
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }
      );

    } else if (data === 'manual_register') {
      await bot.editMessageText(
        '📝 *Registro Manual*\n\n' +
        'Para registrarte manualmente, contacta a tu administrador del sistema con la siguiente información:\n\n' +
        `📱 **Tu Telegram ID**: \`${telegramUser.id}\`\n` +
        `👤 **Username**: @${telegramUser.username || 'Sin username'}\n` +
        `🆔 **Nombre**: ${telegramUser.first_name} ${telegramUser.last_name || ''}\n\n` +
        'El administrador podrá crear tu cuenta y generar tu QR de vinculación.',
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }
      );

    } else if (data === 'contact_admin') {
      await bot.sendMessage(chatId,
        '🆘 *Contactar Administrador*\n\n' +
        'Para asistencia técnica, contacta a:\n\n' +
        '📧 Soporte: admin@eplcas.com\n' +
        '📞 Teléfono: +52 (81) 1234-5678\n\n' +
        'Incluye tu Telegram ID para referencia: `' + telegramUser.id + '`',
        { parse_mode: 'Markdown' }
      );
    }

  } catch (error) {
    console.error('❌ Error en callback autolink:', error.message);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Error interno. Intenta de nuevo.',
      show_alert: true
    });
  }
}

module.exports = {
  startCommand,
  handleAutolinkCallback,
  linkTelegramUser,
  generateWelcomeMessage,
  sendMainMenu
};