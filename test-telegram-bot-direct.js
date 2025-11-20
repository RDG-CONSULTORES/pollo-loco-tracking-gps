require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

async function testTelegramBotDirect() {
  try {
    console.log('🤖 Testing Telegram bot directly...\n');
    
    // 1. Verificar variables de entorno
    console.log('🔧 Configuración:');
    console.log(`   Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   Admin IDs: ${process.env.TELEGRAM_ADMIN_IDS || 'No configurado'}`);
    console.log(`   Web App URL: ${process.env.WEB_APP_URL || 'No configurado'}\n`);
    
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.log('❌ TELEGRAM_BOT_TOKEN no está configurado');
      return;
    }
    
    if (!process.env.TELEGRAM_ADMIN_IDS) {
      console.log('❌ TELEGRAM_ADMIN_IDS no está configurado');
      return;
    }
    
    // 2. Crear bot directamente
    console.log('🔄 Creando bot Telegram...');
    
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: false // No polling para test
    });
    
    // 3. Test básico - obtener info del bot
    console.log('📋 Obteniendo información del bot...');
    const botInfo = await bot.getMe();
    console.log(`✅ Bot conectado: @${botInfo.username} (${botInfo.first_name})`);
    console.log(`   ID: ${botInfo.id}`);
    console.log(`   Can join groups: ${botInfo.can_join_groups}`);
    console.log(`   Can read messages: ${botInfo.can_read_all_group_messages}`);
    
    // 4. Test envío de mensaje
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
    const primaryAdminId = adminIds[0].trim();
    
    console.log(`\n📤 Enviando mensaje de prueba a admin ID: ${primaryAdminId}`);
    
    const testMessage = `🧪 TEST DIRECTO BOT TELEGRAM\n\n` +
      `⏰ ${new Date().toLocaleString('es-MX')}\n` +
      `🤖 Bot: @${botInfo.username}\n` +
      `👤 Admin ID: ${primaryAdminId}\n\n` +
      `✅ Si recibes este mensaje, el bot Telegram funciona correctamente.\n\n` +
      `Ahora necesitamos revisar por qué las alertas geofence no se envían automáticamente.`;
    
    const sentMessage = await bot.sendMessage(primaryAdminId, testMessage);
    
    console.log('✅ Mensaje enviado exitosamente');
    console.log(`   Message ID: ${sentMessage.message_id}`);
    console.log(`   Chat ID: ${sentMessage.chat.id}`);
    
    // 5. Test del geofence manual con bot funcionando
    console.log('\n🎯 Ahora probando alerta geofence con bot funcionando...');
    
    try {
      // Simular alerta geofence
      const geofenceMessage = `🟢 ENTRADA DETECTADA - TEST MANUAL\n\n` +
        `👤 Supervisor: Roberto Davila (01)\n` +
        `🏢 Sucursal: Oficina Roberto - Testing\n` +
        `📍 Ubicación: 25.650648, -100.373529\n` +
        `📏 Distancia: 15m del centro\n` +
        `🕒 Hora: ${new Date().toLocaleTimeString('es-MX')}\n\n` +
        `✅ TEST: Simulación de entrada a geofence`;
      
      await bot.sendMessage(primaryAdminId, geofenceMessage, { 
        parse_mode: 'HTML' 
      });
      
      console.log('✅ Alerta geofence de prueba enviada');
      
    } catch (geofenceError) {
      console.error('❌ Error enviando alerta geofence:', geofenceError.message);
    }
    
    // 6. Diagnóstico final
    console.log('\n📋 DIAGNÓSTICO:');
    console.log('✅ Bot Telegram funciona correctamente');
    console.log('✅ Conexión a API Telegram exitosa');  
    console.log('✅ Envío de mensajes funcional');
    console.log('');
    console.log('🔧 PROBLEMA IDENTIFICADO:');
    console.log('   El bot funciona, pero el sistema de geofence-alerts');
    console.log('   no está utilizando el bot correctamente en el location-processor');
    console.log('');
    console.log('💡 SOLUCIÓN:');
    console.log('   1. Verificar que el bot se inicialice en el servidor de producción');
    console.log('   2. Asegurar que location-processor llame a geofence-alerts');
    console.log('   3. Verificar que geofence-alerts use el bot correctamente');
    
  } catch (error) {
    console.error('❌ Error testing bot:', error.message);
    
    if (error.message.includes('401')) {
      console.error('   → Token inválido o revocado');
    } else if (error.message.includes('400')) {
      console.error('   → Problema con formato del mensaje o chat ID');
    } else if (error.message.includes('403')) {
      console.error('   → Bot bloqueado por el usuario o sin permisos');
    }
  }
}

testTelegramBotDirect();