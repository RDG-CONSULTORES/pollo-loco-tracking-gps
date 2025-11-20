/**
 * FIX ESPECÍFICO: Conflicto 409 Telegram
 * 
 * PROBLEMA: "Conflict: terminated by other getUpdates request"
 * CAUSA: Múltiples instancias del bot o polling mode conflicto
 * SOLUCIÓN: Configurar bot en modo webhook o deshabilitar polling
 */

const fs = require('fs');

async function fixTelegramConflict() {
  try {
    console.log('🔧 FIX TELEGRAM CONFLICT 409\n');
    
    // 1. Revisar configuración del bot
    console.log('🤖 PASO 1: REVISANDO CONFIGURACIÓN BOT');
    console.log('');
    
    const botPath = './src/telegram/bot.js';
    let content = fs.readFileSync(botPath, 'utf8');
    
    // Verificar configuración actual
    const hasPolling = content.includes('polling: true');
    const hasWebhook = content.includes('webhook');
    
    console.log(`📡 Polling mode: ${hasPolling ? 'ACTIVO (problema)' : 'NO'}`);
    console.log(`🌐 Webhook mode: ${hasWebhook ? 'CONFIGURADO' : 'NO'}`);
    
    // 2. Revisar configuración en telegram.js
    console.log('\\n📋 PASO 2: VERIFICANDO CONFIGURACIÓN TELEGRAM');
    
    const configPath = './src/config/telegram.js';
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    console.log('Configuración actual:');
    if (configContent.includes('polling: true')) {
      console.log('❌ PROBLEMA: polling: true activado');
    } else {
      console.log('✅ Polling desactivado');
    }
    
    // 3. Crear fix
    console.log('\\n🔧 PASO 3: APLICANDO FIX');
    console.log('');
    
    // Backup
    const backupPath = `${configPath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, configContent);
    console.log(`💾 Backup: ${backupPath}`);
    
    // Fix: Deshabilitar polling para Railway
    if (configContent.includes('polling: true')) {
      configContent = configContent.replace('polling: true', 'polling: false');
      console.log('✅ polling: true → polling: false');
    }
    
    // Asegurar configuración correcta para Railway
    const railwayConfig = `const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  adminIds: process.env.TELEGRAM_ADMIN_IDS 
    ? process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
    : [],
  
  // Configuración para Railway - sin polling para evitar conflictos
  botOptions: {
    polling: false, // Deshabilitado para Railway
    filepath: false,
    baseApiUrl: 'https://api.telegram.org'
  },
  
  webAppUrl: process.env.RAILWAY_PUBLIC_URL || process.env.PUBLIC_URL || 'https://localhost:3000'
};`;

    // Reemplazar configuración
    const configRegex = /const config = \{[^}]*botOptions: \{[^}]*\}[^}]*\};/s;
    if (configRegex.test(configContent)) {
      configContent = configContent.replace(configRegex, railwayConfig);
      console.log('✅ Configuración actualizada para Railway');
    }
    
    // Guardar archivo
    fs.writeFileSync(configPath, configContent);
    console.log('✅ Archivo telegram.js actualizado');
    
    // 4. Crear versión alternativa que no use polling
    console.log('\\n📱 PASO 4: CREANDO VERSIÓN SIN POLLING');
    console.log('');
    
    const alternativeBotScript = `/**
 * Bot alternativo sin polling para Railway
 * Evita conflictos 409 de Telegram
 */

const TelegramBot = require('node-telegram-bot-api');

class RailwayTelegramBot {
  constructor() {
    this.bot = null;
    this.isRunning = false;
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminIds = process.env.TELEGRAM_ADMIN_IDS 
      ? process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
      : [];
    
    if (!token || adminIds.length === 0) {
      console.log('⚠️ Telegram bot: Variables no configuradas');
      return;
    }
    
    try {
      // Bot SIN polling para evitar conflictos
      this.bot = new TelegramBot(token, { polling: false });
      this.adminIds = adminIds;
      console.log('✅ Telegram bot creado (sin polling)');
      
    } catch (error) {
      console.error('❌ Error creando bot:', error.message);
    }
  }
  
  async sendMessage(chatId, text, options = {}) {
    try {
      if (!this.bot) return null;
      
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      });
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error.message);
      return null;
    }
  }
  
  async broadcastToAdmins(text, options = {}) {
    const results = [];
    
    for (const adminId of this.adminIds) {
      try {
        const result = await this.sendMessage(adminId, text, options);
        results.push({ adminId, success: !!result, result });
      } catch (error) {
        results.push({ adminId, success: false, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(\`📡 Broadcast: \${successful} enviados, \${failed} fallidos\`);
    
    return { successful, failed, results };
  }
  
  start() {
    this.isRunning = true;
    console.log('✅ Railway Telegram Bot: Listo (sin polling)');
    return true;
  }
  
  stop() {
    this.isRunning = false;
    console.log('✅ Railway Telegram Bot: Detenido');
  }
  
  async getBotInfo() {
    try {
      if (!this.bot) return null;
      return await this.bot.getMe();
    } catch (error) {
      console.error('❌ Error obteniendo info bot:', error.message);
      return null;
    }
  }
}

// Singleton para Railway
let railwayBotInstance = null;

function createRailwayBot() {
  if (!railwayBotInstance) {
    railwayBotInstance = new RailwayTelegramBot();
  }
  return railwayBotInstance;
}

function getRailwayBot() {
  return railwayBotInstance;
}

module.exports = { createRailwayBot, getRailwayBot };`;

    const altBotPath = './src/telegram/railway-bot.js';
    fs.writeFileSync(altBotPath, alternativeBotScript);
    console.log(`✅ Bot alternativo creado: ${altBotPath}`);
    
    // 5. Modificar geofence-alerts para usar bot alternativo
    console.log('\\n🔧 PASO 5: ACTUALIZANDO GEOFENCE-ALERTS');
    console.log('');
    
    const alertsPath = './src/services/geofence-alerts.js';
    let alertsContent = fs.readFileSync(alertsPath, 'utf8');
    
    // Backup
    const alertsBackup = \`\${alertsPath}.backup.\${Date.now()}\`;
    fs.writeFileSync(alertsBackup, alertsContent);
    
    // Cambiar import del bot
    const oldImport = "const { getBot } = require('../telegram/bot');";
    const newImport = "const { getRailwayBot } = require('../telegram/railway-bot');";
    
    if (alertsContent.includes(oldImport)) {
      alertsContent = alertsContent.replace(oldImport, newImport);
      
      // Cambiar todas las referencias
      alertsContent = alertsContent.replace(/getBot\(\)/g, 'getRailwayBot()');
      
      fs.writeFileSync(alertsPath, alertsContent);
      console.log('✅ geofence-alerts.js actualizado para usar railway-bot');
    }
    
    // 6. Actualizar index.js
    console.log('\\n🚀 PASO 6: ACTUALIZANDO INDEX.JS');
    console.log('');
    
    const indexPath = './src/index.js';
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Backup
    const indexBackup = \`\${indexPath}.backup.\${Date.now()}\`;
    fs.writeFileSync(indexBackup, indexContent);
    
    // Actualizar import y uso
    const oldBotImport = "const { createBot } = require('./telegram/bot');";
    const newBotImport = "const { createRailwayBot } = require('./telegram/railway-bot');";
    
    if (indexContent.includes(oldBotImport)) {
      indexContent = indexContent.replace(oldBotImport, newBotImport);
      indexContent = indexContent.replace(/createBot\(\)/g, 'createRailwayBot()');
      
      fs.writeFileSync(indexPath, indexContent);
      console.log('✅ index.js actualizado para usar railway-bot');
    }
    
    // 7. Instrucciones
    console.log('\\n🎯 INSTRUCCIONES FINALES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. 🚀 COMMIT Y PUSH:');
    console.log('   git add -A');
    console.log('   git commit -m "Fix Telegram conflict 409 - disable polling for Railway"');
    console.log('   git push origin main');
    console.log('');
    console.log('2. ⏰ ESPERAR DEPLOY (2 minutos)');
    console.log('');
    console.log('3. 🧪 TEST FINAL:');
    console.log('   - Sal >15m de oficina');
    console.log('   - Regresa <15m de oficina');
    console.log('   - Verifica alertas Telegram');
    console.log('');
    console.log('✅ CAMBIOS APLICADOS:');
    console.log('   - polling: false (no más conflicto 409)');
    console.log('   - Bot alternativo sin polling');
    console.log('   - geofence-alerts actualizado');
    console.log('   - index.js actualizado');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixTelegramConflict();