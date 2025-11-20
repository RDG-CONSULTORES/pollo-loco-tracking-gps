const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * TEST DIRECTO DEL BOT DE TELEGRAM EN PRODUCCIÓN
 * 
 * OBJETIVO: Verificar si el bot puede enviar mensajes directamente
 * SIN usar el sistema de geofence-alerts
 */
async function testTelegramBotProduction() {
  try {
    console.log('🤖 TEST DIRECTO DEL BOT DE TELEGRAM EN PRODUCCIÓN\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Verificar variables de entorno
    console.log('🔧 PASO 1: VERIFICAR CONFIGURACIÓN');
    console.log('');
    console.log(`📋 TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ NO configurado'}`);
    console.log(`📋 TELEGRAM_ADMIN_IDS: ${process.env.TELEGRAM_ADMIN_IDS ? process.env.TELEGRAM_ADMIN_IDS : '❌ NO configurado'}`);
    
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_IDS) {
      console.log('❌ PROBLEMA: Variables de entorno faltantes');
      return;
    }
    
    // 2. Test directo con API de Telegram (sin usar nuestro bot)
    console.log('\\n📱 PASO 2: TEST DIRECTO CON API TELEGRAM');
    console.log('');
    
    const TelegramBot = require('node-telegram-bot-api');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim()));
    
    console.log(`🔑 Token: ${token.substring(0, 10)}...`);
    console.log(`👥 Admin IDs: ${adminIds.join(', ')}`);
    
    // Crear instancia directa del bot
    const directBot = new TelegramBot(token);
    
    // Test de getMe para verificar que el bot existe
    console.log('\\n🧪 Test getMe()...');
    try {
      const botInfo = await directBot.getMe();
      console.log('✅ Bot respondió:');
      console.log(`   🏷️ Username: @${botInfo.username}`);
      console.log(`   🆔 ID: ${botInfo.id}`);
      console.log(`   👤 Nombre: ${botInfo.first_name}`);
    } catch (getMeError) {
      console.log('❌ Error en getMe():', getMeError.message);
      return;
    }
    
    // Test de envío directo
    console.log('\\n📤 Test envío directo a Roberto...');
    
    const robertoId = 6932484342;
    const testMessage = `🧪 TEST PRODUCCIÓN - ${new Date().toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}
    
⚡ Este es un test DIRECTO del bot de Telegram desde Railway.

🎯 OBJETIVO: Verificar si el problema está en:
- ✅ Bot: Configurado y funcionando
- ❌ Sistema geofence-alerts: NO entrega mensajes

📊 INFORMACIÓN:
- Bot: @pollolocogps_bot  
- Usuario: Roberto (${robertoId})
- Servidor: Railway producción
- Test: Bypass completo de geofence-alerts

💡 Si recibes ESTE mensaje → Bot funciona, problema en geofence-alerts
❌ Si NO recibes este mensaje → Bot no configurado correctamente`;

    try {
      const result = await directBot.sendMessage(robertoId, testMessage);
      console.log('✅ MENSAJE ENVIADO EXITOSAMENTE');
      console.log(`   📧 Message ID: ${result.message_id}`);
      console.log(`   💬 Chat ID: ${result.chat.id}`);
      console.log(`   ⏰ Enviado: ${new Date(result.date * 1000).toLocaleString('es-MX')}`);
      
      console.log('\\n🎉 CONCLUSIÓN: El bot de Telegram SÍ funciona');
      console.log('🎯 PROBLEMA: En el sistema geofence-alerts.js');
      
    } catch (sendError) {
      console.log('❌ ERROR ENVIANDO MENSAJE:');
      console.log(`   Código: ${sendError.response?.body?.error_code}`);
      console.log(`   Descripción: ${sendError.response?.body?.description}`);
      console.log(`   Mensaje: ${sendError.message}`);
      
      console.log('\\n❌ CONCLUSIÓN: El bot de Telegram NO funciona correctamente');
    }
    
    // 3. Test del bot interno del sistema
    console.log('\\n🔧 PASO 3: TEST BOT INTERNO DEL SISTEMA');
    console.log('');
    
    try {
      const { getBot } = require('./src/telegram/bot');
      const systemBot = getBot();
      
      if (!systemBot) {
        console.log('❌ Bot del sistema NO inicializado');
      } else if (!systemBot.bot) {
        console.log('❌ Bot interno NO disponible');
      } else {
        console.log('✅ Bot del sistema inicializado');
        
        // Test broadcastToAdmins
        console.log('\\n📡 Test broadcastToAdmins()...');
        
        const broadcastMessage = `🔄 TEST SISTEMA - ${new Date().toLocaleTimeString('es-MX')}

📡 Testing método broadcastToAdmins del sistema

🤖 Si recibes ESTE mensaje → Sistema interno funciona
❌ Si no recibes → Problema en broadcastToAdmins()

⚡ Enviado desde: geofence-alerts test system`;

        try {
          const broadcastResult = await systemBot.broadcastToAdmins(broadcastMessage, { parse_mode: 'Markdown' });
          
          console.log('✅ broadcastToAdmins ejecutado:');
          console.log(`   ✅ Exitosos: ${broadcastResult.successful}`);
          console.log(`   ❌ Fallidos: ${broadcastResult.failed}`);
          
          if (broadcastResult.successful > 0) {
            console.log('\\n🎉 SISTEMA INTERNO FUNCIONA');
            console.log('🎯 PROBLEMA: Debe estar en geofence-alerts.js llamando broadcastToAdmins');
          } else {
            console.log('\\n❌ SISTEMA INTERNO FALLA');
            console.log('🎯 PROBLEMA: En broadcastToAdmins() del bot del sistema');
          }
          
        } catch (broadcastError) {
          console.log('❌ Error en broadcastToAdmins:', broadcastError.message);
        }
      }
      
    } catch (systemError) {
      console.log('❌ Error accediendo bot del sistema:', systemError.message);
    }
    
    // 4. Resumen y recomendaciones
    console.log('\\n💡 PASO 4: RESUMEN Y RECOMENDACIONES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    console.log('📊 RESULTADOS DEL TEST:');
    console.log('- API Telegram directa: ✅ (si recibiste mensaje)');
    console.log('- Bot del sistema: ? (verificar arriba)');
    console.log('- broadcastToAdmins: ? (verificar arriba)');
    console.log('');
    
    console.log('🎯 PRÓXIMOS PASOS:');
    console.log('1. ✅ VERIFICA que recibiste los mensajes de test arriba');
    console.log('2. 🔧 Si recibiste → problema en geofence-alerts llamando al bot');
    console.log('3. ❌ Si NO recibiste → problema en configuración del bot');
    console.log('4. 🚀 Implementar fix final basado en los resultados');
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
  } finally {
    await pool.end();
  }
}

testTelegramBotProduction();