/**
 * Comandos de configuración del sistema
 */

const db = require('../../config/database');

/**
 * Comando /horarios - Configurar horario laboral
 */
async function configurarHorarios(bot, msg, args) {
  const chatId = msg.chat.id;
  
  try {
    if (args.length !== 2) {
      await bot.sendMessage(chatId, 
        '⚠️ *Uso correcto:* `/horarios HH:MM HH:MM`\n\n' +
        'Ejemplo: `/horarios 07:00 21:00`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const [horaInicio, horaFin] = args;
    
    // Validar formato
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(horaInicio) || !timeRegex.test(horaFin)) {
      throw new Error('Formato de hora inválido. Use HH:MM');
    }
    
    // Actualizar configuración
    await db.query(`
      UPDATE tracking_config 
      SET value = $1 
      WHERE key = 'work_hours_start'
    `, [horaInicio]);
    
    await db.query(`
      UPDATE tracking_config 
      SET value = $1 
      WHERE key = 'work_hours_end'
    `, [horaFin]);
    
    await bot.sendMessage(chatId,
      `✅ *Horario laboral actualizado*\n\n` +
      `🕐 Entrada: ${horaInicio}\n` +
      `🕐 Salida: ${horaFin}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error configurando horarios:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al configurar horarios: ' + error.message
    );
  }
}

/**
 * Comando /radio - Configurar radio de geofence
 */
async function configurarRadio(bot, msg, args) {
  const chatId = msg.chat.id;
  
  try {
    if (args.length !== 1) {
      await bot.sendMessage(chatId, 
        '⚠️ *Uso correcto:* `/radio METROS`\n\n' +
        'Ejemplo: `/radio 100`\n' +
        'Rango: 50-1000 metros',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const radio = parseInt(args[0]);
    
    if (isNaN(radio) || radio < 50 || radio > 1000) {
      throw new Error('Radio debe ser entre 50 y 1000 metros');
    }
    
    // Actualizar configuración
    await db.query(`
      UPDATE tracking_config 
      SET value = $1 
      WHERE key = 'geofence_radius_meters'
    `, [radio.toString()]);
    
    await bot.sendMessage(chatId,
      `✅ *Radio de geofence actualizado*\n\n` +
      `📍 Nuevo radio: ${radio} metros`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error configurando radio:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al configurar radio: ' + error.message
    );
  }
}

/**
 * Comando /activar_sistema - Activar sistema
 */
async function activarSistema(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    await db.query(`
      UPDATE tracking_config 
      SET value = 'true' 
      WHERE key = 'system_active'
    `);
    
    await bot.sendMessage(chatId,
      '✅ *Sistema ACTIVADO*\n\n' +
      '🟢 El tracking GPS está funcionando',
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error activando sistema:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al activar sistema: ' + error.message
    );
  }
}

/**
 * Comando /pausar_sistema - Pausar sistema
 */
async function pausarSistema(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    await db.query(`
      UPDATE tracking_config 
      SET value = 'false' 
      WHERE key = 'system_active'
    `);
    
    await bot.sendMessage(chatId,
      '⏸️ *Sistema PAUSADO*\n\n' +
      '🔴 El tracking GPS está detenido temporalmente',
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error pausando sistema:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al pausar sistema: ' + error.message
    );
  }
}

module.exports = {
  configurarHorarios,
  configurarRadio,
  activarSistema,
  pausarSistema
};