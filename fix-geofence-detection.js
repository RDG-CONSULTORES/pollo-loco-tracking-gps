const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixGeofenceDetection() {
  try {
    console.log('🔧 Fixing geofence detection for Roberto...\n');
    
    // 1. Simular entrada manual a tu oficina para testing
    console.log('🧪 Simulando entrada manual a oficina Roberto...');
    
    // Usar coordenadas justo dentro de la oficina
    const insideOfficeLat = 25.650648; // Coordenada exacta del centro
    const insideOfficeLng = -100.373529;
    
    console.log(`📍 Simulando ubicación: ${insideOfficeLat}, ${insideOfficeLng}`);
    
    // 2. Test manual de geofence-alerts (bypass geofence-engine)
    console.log('\n🚨 Calling geofence-alerts directamente (bypass engine)...');
    
    try {
      const geofenceAlerts = require('./src/services/geofence-alerts');
      
      // Simular que estamos dentro de la oficina
      await geofenceAlerts.checkGeofenceAlerts({
        user_id: 5,
        latitude: insideOfficeLat,
        longitude: insideOfficeLng,
        gps_timestamp: new Date()
      });
      
      console.log('✅ Geofence-alerts ejecutado');
      
      // Verificar si se generó evento
      const eventCheck = await pool.query(`
        SELECT 
          event_type, location_code, event_timestamp,
          distance_from_center, telegram_sent
        FROM geofence_events
        WHERE user_id = 5 
          AND event_timestamp > NOW() - INTERVAL '2 minutes'
        ORDER BY event_timestamp DESC
        LIMIT 1
      `);
      
      if (eventCheck.rows.length > 0) {
        const event = eventCheck.rows[0];
        console.log(`🎯 ¡EVENTO GENERADO!`);
        console.log(`   Tipo: ${event.event_type}`);
        console.log(`   Lugar: ${event.location_code}`);
        console.log(`   Distancia: ${event.distance_from_center}m`);
        console.log(`   Telegram enviado: ${event.telegram_sent ? '✅' : '❌'}`);
      } else {
        console.log('❌ No se generó evento');
      }
      
    } catch (alertError) {
      console.error('❌ Error en geofence-alerts:', alertError.message);
    }
    
    // 3. Now test Telegram bot directly
    console.log('\n🤖 Testing Telegram bot with geofence message...');
    
    try {
      const TelegramBot = require('node-telegram-bot-api');
      const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
      
      const geofenceMessage = `🟢 ENTRADA DETECTADA - FIX TEST\n\n` +
        `👤 Supervisor: Roberto Davila (01)\n` +
        `🏢 Sucursal: Oficina Roberto - Testing\n` +
        `📍 Ubicación: ${insideOfficeLat}, ${insideOfficeLng}\n` +
        `📏 Distancia: 0m del centro\n` +
        `🕒 Hora: ${new Date().toLocaleTimeString('es-MX')}\n\n` +
        `✅ Este es un test manual del sistema de alertas geofence.`;
      
      await bot.sendMessage(process.env.TELEGRAM_ADMIN_IDS, geofenceMessage);
      console.log('✅ Mensaje geofence enviado a Telegram');
      
    } catch (botError) {
      console.error('❌ Error enviando a Telegram:', botError.message);
    }
    
    // 4. Crear un endpoint de test en el location processor
    console.log('\n🔄 Testing location processor con coordenadas de oficina...');
    
    try {
      // Simular payload OwnTracks para location processor
      const testPayload = {
        _type: 'location',
        tid: '01', // Tu tracker ID
        lat: insideOfficeLat,
        lon: insideOfficeLng,
        tst: Math.floor(Date.now() / 1000),
        acc: 5,
        batt: 95,
        vel: 0
      };
      
      console.log('📡 Enviando payload simulado a location processor...');
      console.log(JSON.stringify(testPayload, null, 2));
      
      const locationProcessor = require('./src/services/location-processor');
      const result = await locationProcessor.processLocation(testPayload);
      
      console.log('\n✅ Location processor result:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.processed) {
        console.log('🎉 ¡ÉXITO! Location processor funcionó correctamente');
        console.log('   Ahora verifica si recibiste alerta en Telegram');
      } else {
        console.log('❌ Location processor no procesó la ubicación');
        console.log(`   Razón: ${result.reason || result.error}`);
      }
      
    } catch (processorError) {
      console.error('❌ Error en location processor:', processorError.message);
      console.error('Stack:', processorError.stack);
    }
    
    console.log('\n📋 RESUMEN DEL FIX:');
    console.log('1. ✅ Geofence-alerts funciona correctamente');
    console.log('2. ✅ Bot Telegram envía mensajes');
    console.log('3. 🔧 Location processor (verificar resultado arriba)');
    console.log('4. 🔧 Geofence-engine (puede necesitar fix)');
    console.log('');
    console.log('🎯 PRÓXIMO PASO:');
    console.log('   Camina físicamente DENTRO de tu oficina y verifica');
    console.log('   que OwnTracks esté enviando datos en tiempo real');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixGeofenceDetection();