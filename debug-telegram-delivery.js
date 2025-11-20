const { Pool } = require('pg');
const { getBot } = require('./src/telegram/bot');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugTelegramDelivery() {
  try {
    console.log('🔍 DIAGNÓSTICO TELEGRAM - POR QUE NO LLEGAN LAS ALERTAS\n');
    
    // 1. Verificar configuración del bot
    console.log('🤖 VERIFICACIÓN DEL BOT TELEGRAM:');
    
    const bot = getBot();
    if (!bot) {
      console.log('❌ Bot no inicializado');
      return;
    }
    
    if (!bot.bot) {
      console.log('❌ Bot interno no disponible');
      return;
    }
    
    // Verificar info del bot
    try {
      const botInfo = await bot.getBotInfo();
      console.log('✅ Bot conectado:');
      console.log(`   🏷️ Username: @${botInfo.username}`);
      console.log(`   🆔 ID: ${botInfo.id}`);
      console.log(`   ✅ Estado: ${bot.isRunning ? 'Activo' : 'Inactivo'}`);
    } catch (botError) {
      console.log('❌ Error obteniendo info del bot:', botError.message);
    }
    
    // 2. Verificar configuración de administradores
    console.log('\n👥 ADMINISTRADORES CONFIGURADOS:');
    
    const telegramConfig = require('./src/config/telegram');
    console.log(`📊 Total admins: ${telegramConfig.config.adminIds.length}`);
    
    telegramConfig.config.adminIds.forEach((adminId, i) => {
      console.log(`   ${i+1}. Admin ID: ${adminId} ${adminId === 6932484342 ? '← ROBERTO' : ''}`);
    });
    
    // 3. Test de envío directo a Roberto
    console.log('\n📱 TEST DE ENVÍO DIRECTO A ROBERTO:');
    
    const robertoId = 6932484342;
    const testMessage = `🧪 TEST DIAGNÓSTICO - ${new Date().toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}
    
⚡ Este es un test para verificar por qué no llegan las alertas de geofence.

🔍 Si recibes este mensaje, el bot SÍ funciona.
📧 Problema debe estar en el proceso de geofence-alerts.js

🤖 Bot: @pollolocogps_bot
⏰ Enviado: ${new Date().toLocaleTimeString('es-MX')}`;

    try {
      const directResult = await bot.sendMessage(robertoId, testMessage);
      console.log('✅ Mensaje directo enviado exitosamente');
      console.log(`   📧 Message ID: ${directResult.message_id}`);
      console.log(`   💬 Chat ID: ${directResult.chat.id}`);
    } catch (directError) {
      console.log('❌ Error enviando mensaje directo:', directError.message);
      console.log('   Código de error:', directError.response?.body?.error_code);
      console.log('   Descripción:', directError.response?.body?.description);
    }
    
    // 4. Test del método broadcastToAdmins
    console.log('\n📡 TEST DEL MÉTODO BROADCASTTOADMINS:');
    
    const broadcastMessage = `📡 TEST BROADCAST - ${new Date().toLocaleTimeString('es-MX')}

🔄 Testing método broadcastToAdmins que usa geofence-alerts.js

🎯 Este test verifica si el problema está en:
- ✅ Bot funcionando 
- 📡 broadcastToAdmins()
- 🔄 geofence-alerts.js

⚡ Si recibes este mensaje, el problema NO está en Telegram.`;

    try {
      const broadcastResult = await bot.broadcastToAdmins(broadcastMessage, { parse_mode: 'Markdown' });
      console.log(`📊 Broadcast resultado:`);
      console.log(`   ✅ Exitosos: ${broadcastResult.successful}`);
      console.log(`   ❌ Fallidos: ${broadcastResult.failed}`);
      
      if (broadcastResult.successful > 0) {
        console.log('✅ ¡Broadcast funciona correctamente!');
      } else {
        console.log('❌ Broadcast falló completamente');
      }
      
    } catch (broadcastError) {
      console.log('❌ Error en broadcastToAdmins:', broadcastError.message);
    }
    
    // 5. Examinar logs recientes de geofence events
    console.log('\n🗄️ EVENTOS GEOFENCE CON STATUS TELEGRAM:');
    
    const events = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp,
        telegram_sent, telegram_sent_at, telegram_error,
        latitude, longitude, distance_from_center
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '2 hours'
      ORDER BY event_timestamp DESC
      LIMIT 10
    `);
    
    if (events.rows.length > 0) {
      console.log(`📊 ${events.rows.length} eventos encontrados:`);
      
      events.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action}`);
        console.log(`      📍 ${event.latitude}, ${event.longitude}`);
        console.log(`      📏 ${event.distance_from_center}m del centro`);
        console.log(`      📱 Telegram: ${event.telegram_sent ? '✅ Marcado como enviado' : '❌ No enviado'}`);
        
        if (event.telegram_sent_at) {
          const sentTime = new Date(event.telegram_sent_at).toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
          console.log(`      ⏰ Marcado enviado: ${sentTime}`);
        }
        
        if (event.telegram_error) {
          console.log(`      ❌ Error registrado: ${event.telegram_error}`);
        }
        
        console.log('');
      });
    } else {
      console.log('❌ No hay eventos geofence recientes');
    }
    
    // 6. Test manual del geofence-alerts
    console.log('\n🧪 TEST MANUAL DE GEOFENCE-ALERTS:');
    
    try {
      const geofenceAlerts = require('./src/services/geofence-alerts');
      
      // Simular datos de entrada
      const testLocationData = {
        user_id: 5,
        latitude: 25.650648 + 0.0001, // Ligeramente fuera del centro
        longitude: -100.373529,
        gps_timestamp: new Date()
      };
      
      console.log('📡 Simulando entrada a geofence...');
      console.log(`   📍 Coordenadas: ${testLocationData.latitude}, ${testLocationData.longitude}`);
      
      // Interceptar el método sendTelegramAlert
      const originalSendMethod = geofenceAlerts.sendTelegramAlert;
      let alertCalled = false;
      let alertMessage = '';
      
      geofenceAlerts.sendTelegramAlert = async function(message) {
        alertCalled = true;
        alertMessage = message;
        console.log('🚨 geofence-alerts INTENTÓ enviar mensaje:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Llamar método original y capturar resultado
        try {
          const result = await originalSendMethod.call(this, message);
          console.log('✅ Método original ejecutado sin errores');
          return result;
        } catch (error) {
          console.log('❌ Método original falló:', error.message);
          throw error;
        }
      };
      
      // Ejecutar test
      await geofenceAlerts.checkGeofenceAlerts(testLocationData);
      
      if (alertCalled) {
        console.log('✅ geofence-alerts SÍ intentó enviar alerta');
        console.log('🔍 Ahora verificando por qué Telegram no entrega...');
      } else {
        console.log('❌ geofence-alerts NO generó alerta');
        console.log('   Posibles causas:');
        console.log('   - No hay cambio de estado (ya estaba dentro/fuera)');
        console.log('   - Alertas deshabilitadas');
        console.log('   - Error en lógica de detección');
      }
      
      // Restaurar método original
      geofenceAlerts.sendTelegramAlert = originalSendMethod;
      
    } catch (alertsError) {
      console.log('❌ Error testing geofence-alerts:', alertsError.message);
    }
    
    // 7. Análisis final y recomendaciones
    console.log('\n🔧 ANÁLISIS FINAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n💡 PASOS PARA IDENTIFICAR EL PROBLEMA:');
    console.log('1. ✅ Verificar que recibiste los mensajes de TEST arriba');
    console.log('2. 📊 Revisar logs de eventos en la base de datos');
    console.log('3. 🔄 Comparar con mensajes realmente recibidos en Telegram');
    console.log('4. 🧪 Test manual de geofence-alerts');
    
    console.log('\n🎯 POSIBLES CAUSAS:');
    console.log('- 📱 Bot funciona PERO geofence-alerts marca éxito sin verificar');
    console.log('- 🔄 broadcastToAdmins falla pero no registra el error');
    console.log('- ⚡ Telegram API rechaza mensajes por algún motivo');
    console.log('- 🕐 Timing issues entre generación y envío');
    
    console.log('\n⚡ SIGUIENTE PASO:');
    console.log('Confirma si recibiste los mensajes de TEST arriba.');
    console.log('Si SÍ los recibiste → problema en geofence-alerts.js');
    console.log('Si NO los recibiste → problema en configuración Telegram');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugTelegramDelivery();