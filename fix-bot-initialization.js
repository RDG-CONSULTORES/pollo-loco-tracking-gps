/**
 * FIX DEFINITIVO: Bot de Telegram no se inicializa en Railway
 * 
 * PROBLEMA: getBot() retorna null porque el bot no está inicializado
 * SOLUCIÓN: Verificar y corregir inicialización del bot en index.js
 */

const fs = require('fs');

async function fixBotInitialization() {
  try {
    console.log('🔧 FIX DEFINITIVO: INICIALIZACIÓN DEL BOT DE TELEGRAM\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Leer archivo principal
    console.log('📄 PASO 1: VERIFICANDO INICIALIZACIÓN EN INDEX.JS');
    console.log('');
    
    const indexPath = './src/index.js';
    let content = fs.readFileSync(indexPath, 'utf8');
    
    console.log('📋 Verificando configuración actual...');
    
    // Verificar si ya tiene manejo de errores del bot
    const hasBotErrorHandling = content.includes('started = bot.start()');
    const hasValidation = content.includes('validateEnvironment');
    
    console.log(`✅ Validación de entorno: ${hasValidation ? 'SÍ' : 'NO'}`);
    console.log(`✅ Manejo de bot: ${hasBotErrorHandling ? 'SÍ' : 'NO'}`);
    
    // 2. Aplicar fix si es necesario
    if (!hasBotErrorHandling) {
      console.log('\\n🔧 PASO 2: APLICANDO FIX DE INICIALIZACIÓN');
      console.log('');
      
      // Backup del archivo
      const backupPath = `${indexPath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, content);
      console.log(`💾 Backup creado: ${backupPath}`);
      
      // Modificar inicialización del bot
      const oldBotInit = /\/\/ 4\. Inicializar Telegram Bot[\\s\\S]*?\\}/;
      const newBotInit = `// 4. Inicializar Telegram Bot
    console.log('\\n🤖 Inicializando Telegram Bot...');
    const bot = createBot();
    if (bot) {
      const started = bot.start();
      if (started) {
        console.log('✅ Telegram Bot inicializado correctamente');
      } else {
        console.warn('⚠️ Telegram Bot no se pudo iniciar - continuando sin bot');
      }
    } else {
      console.warn('⚠️ Telegram Bot no se pudo crear - verificar configuración');
    }`;
      
      content = content.replace(oldBotInit, newBotInit);
      
      // Escribir archivo modificado
      fs.writeFileSync(indexPath, content);
      console.log('✅ index.js actualizado con mejor inicialización del bot');
      
    } else {
      console.log('\\n✅ PASO 2: INICIALIZACIÓN YA ESTÁ CORRECTA');
    }
    
    // 3. Verificar configuración de Telegram
    console.log('\\n📱 PASO 3: VERIFICANDO CONFIGURACIÓN TELEGRAM');
    console.log('');
    
    try {
      const telegramConfigPath = './src/config/telegram.js';
      const telegramContent = fs.readFileSync(telegramConfigPath, 'utf8');
      
      // Verificar que tiene validación de variables
      const hasTokenValidation = telegramContent.includes('TELEGRAM_BOT_TOKEN');
      const hasAdminValidation = telegramContent.includes('TELEGRAM_ADMIN_IDS');
      
      console.log(`🔑 Validación TOKEN: ${hasTokenValidation ? '✅' : '❌'}`);
      console.log(`👥 Validación ADMIN_IDS: ${hasAdminValidation ? '✅' : '❌'}`);
      
      if (hasTokenValidation && hasAdminValidation) {
        console.log('✅ Configuración Telegram correcta');
      }
      
    } catch (telegramError) {
      console.log('⚠️ No se pudo verificar configuración Telegram:', telegramError.message);
    }
    
    // 4. Crear script de test post-deploy
    console.log('\\n🧪 PASO 4: CREANDO SCRIPT DE VERIFICACIÓN POST-DEPLOY');
    console.log('');
    
    const testScript = `/**
 * Script de verificación post-deploy
 * Ejecutar después del deploy para verificar que todo funciona
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyPostDeploy() {
  try {
    console.log('🚀 VERIFICACIÓN POST-DEPLOY\\n');
    
    // 1. Test bot inicializado
    try {
      const { getBot } = require('./src/telegram/bot');
      const bot = getBot();
      
      if (bot && bot.bot) {
        console.log('✅ Bot inicializado correctamente');
        
        // Test envío
        const testResult = await bot.sendMessage(6932484342, 
          '✅ POST-DEPLOY VERIFICADO\\n\\nBot funcionando correctamente después del deploy.'
        );
        console.log('✅ Test de envío exitoso');
        
      } else {
        console.log('❌ Bot NO inicializado');
      }
    } catch (botError) {
      console.log('❌ Error verificando bot:', botError.message);
    }
    
    // 2. Test geofence
    const events = await pool.query(\`
      SELECT COUNT(*) as count
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '6 hours'
    \`);
    
    console.log(\`📊 Eventos recientes: \${events.rows[0].count}\`);
    
    console.log('\\n🎉 VERIFICACIÓN COMPLETADA');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyPostDeploy();`;

    const testScriptPath = './verify-post-deploy.js';
    fs.writeFileSync(testScriptPath, testScript);
    console.log(`✅ Script de verificación creado: ${testScriptPath}`);
    
    // 5. Instrucciones finales
    console.log('\\n🎯 PASOS FINALES PARA ROBERTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. 🚀 HACER COMMIT Y PUSH:');
    console.log('   git add src/index.js');
    console.log('   git commit -m "Fix: Mejorar inicialización bot Telegram en Railway"');
    console.log('   git push origin main');
    console.log('');
    console.log('2. ⏰ ESPERAR DEPLOY EN RAILWAY (2-3 minutos)');
    console.log('');
    console.log('3. 🧪 VERIFICAR POST-DEPLOY:');
    console.log('   node verify-post-deploy.js');
    console.log('');
    console.log('4. 🚶‍♂️ HACER TESTING FINAL:');
    console.log('   - Sal de tu oficina (>15m)');
    console.log('   - Regresa a tu oficina (<15m)');
    console.log('   - Verifica alertas en Telegram');
    console.log('');
    console.log('🎉 SI TODO FUNCIONA → PROBLEMA RESUELTO DEFINITIVAMENTE');
    console.log('❌ SI NO FUNCIONA → Hay otro problema más profundo');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixBotInitialization();