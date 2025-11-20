const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugTelegramAlerts() {
  try {
    console.log('🔍 Debugging alertas Telegram para Roberto...\n');
    
    // 1. Verificar últimas ubicaciones GPS recibidas
    console.log('📍 Últimas ubicaciones GPS recibidas:');
    
    const locationsResult = await pool.query(`
      SELECT 
        tl.id,
        tu.tracker_id,
        tu.display_name,
        tl.latitude,
        tl.longitude,
        tl.accuracy,
        tl.battery,
        tl.gps_timestamp,
        tl.created_at
      FROM tracking_locations tl
      JOIN tracking_users tu ON tl.user_id = tu.id
      WHERE tu.tracker_id IN ('RD01', 'rd01', '01') 
         OR tu.display_name ILIKE '%roberto%'
      ORDER BY tl.gps_timestamp DESC
      LIMIT 10
    `);
    
    if (locationsResult.rows.length > 0) {
      console.log('✅ Ubicaciones GPS encontradas:');
      locationsResult.rows.forEach((loc, i) => {
        console.log(`   ${i+1}. ${loc.display_name} (${loc.tracker_id})`);
        console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`      🕒 ${loc.gps_timestamp}`);
        console.log(`      🔋 ${loc.battery}% | 📏 ${loc.accuracy}m`);
        
        // Calcular distancia a oficina
        const officeLat = 25.650648;
        const officeLng = -100.373529;
        const distance = calculateDistance(loc.latitude, loc.longitude, officeLat, officeLng);
        console.log(`      🎯 Distancia a oficina: ${Math.round(distance)}m ${distance <= 20 ? '(DENTRO)' : '(FUERA)'}`);
        console.log('');
      });
    } else {
      console.log('❌ No hay ubicaciones GPS recientes');
      return;
    }
    
    // 2. Verificar eventos de geofence generados
    console.log('🎯 Eventos geofence en los últimos 60 minutos:');
    
    const eventsResult = await pool.query(`
      SELECT 
        ge.id,
        ge.event_type,
        ge.location_code,
        ge.event_timestamp,
        ge.distance_from_center,
        ge.telegram_sent,
        ge.telegram_sent_at,
        tu.display_name,
        tu.tracker_id
      FROM geofence_events ge
      JOIN tracking_users tu ON ge.user_id = tu.id
      WHERE ge.location_code = 'ROBERTO_OFFICE'
        AND ge.event_timestamp > NOW() - INTERVAL '1 hour'
      ORDER BY ge.event_timestamp DESC
    `);
    
    if (eventsResult.rows.length > 0) {
      console.log('📋 Eventos encontrados:');
      eventsResult.rows.forEach((event, i) => {
        const icon = event.event_type === 'entry' ? '🟢' : '🔴';
        const telegramStatus = event.telegram_sent ? '✅ ENVIADO' : '❌ NO ENVIADO';
        console.log(`   ${i+1}. ${icon} ${event.event_type.toUpperCase()}: ${event.display_name}`);
        console.log(`      🕒 ${event.event_timestamp}`);
        console.log(`      📏 ${event.distance_from_center}m del centro`);
        console.log(`      📱 Telegram: ${telegramStatus}`);
        if (event.telegram_sent_at) {
          console.log(`      📤 Enviado: ${event.telegram_sent_at}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ No hay eventos geofence recientes');
      console.log('   Esto significa que el sistema geofence no está detectando entradas/salidas');
    }
    
    // 3. Verificar configuración de Bot Telegram
    console.log('🤖 Configuración Bot Telegram:');
    console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   Admin IDs: ${process.env.TELEGRAM_ADMIN_IDS || 'No configurado'}`);
    
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_IDS) {
      console.log('   🔧 Probando conexión con bot...');
      
      try {
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        
        // Test básico del bot
        const botInfo = await bot.getMe();
        console.log(`   ✅ Bot conectado: @${botInfo.username} (${botInfo.first_name})`);
        
        // Test envío mensaje
        const adminId = process.env.TELEGRAM_ADMIN_IDS.split(',')[0];
        console.log(`   📤 Enviando mensaje de prueba a: ${adminId}`);
        
        await bot.sendMessage(adminId, 
          `🧪 TEST MENSAJE\n\n` +
          `⏰ ${new Date().toLocaleString('es-MX')}\n` +
          `🔧 Debugging sistema de alertas\n` +
          `📍 Si recibes este mensaje, el bot funciona correctamente`
        );
        
        console.log('   ✅ Mensaje de prueba enviado');
        
      } catch (error) {
        console.log(`   ❌ Error probando bot: ${error.message}`);
      }
    }
    
    // 4. Verificar configuración geofence-alerts
    console.log('\n🚨 Verificando servicio geofence-alerts:');
    
    // Verificar si las alertas están habilitadas
    console.log('   🔧 Probando detección manual...');
    
    // Simular procesamiento de ubicación
    const lastLocation = locationsResult.rows[0];
    if (lastLocation) {
      const officeLat = 25.650648;
      const officeLng = -100.373529;
      const distance = calculateDistance(lastLocation.latitude, lastLocation.longitude, officeLat, officeLng);
      const isInside = distance <= 20;
      
      console.log(`   📍 Última ubicación: ${lastLocation.latitude}, ${lastLocation.longitude}`);
      console.log(`   🎯 Distancia a oficina: ${Math.round(distance)}m`);
      console.log(`   ${isInside ? '✅' : '❌'} ¿Está dentro del geofence? ${isInside ? 'SÍ' : 'NO'}`);
      
      if (isInside) {
        console.log('   ⚠️  Debería haber generado evento ENTRY si no estaba antes');
      } else {
        console.log('   ⚠️  Debería haber generado evento EXIT si estaba antes');
      }
    }
    
    console.log('\n📋 Recomendaciones:');
    console.log('1. Verificar que recibiste el mensaje de prueba en Telegram');
    console.log('2. Si no hay eventos geofence, el problema está en el procesamiento');
    console.log('3. Si hay eventos pero no Telegram, el problema está en el bot');
    console.log('4. Revisar logs del servidor para más detalles');
    
  } catch (error) {
    console.error('❌ Error debugging:', error.message);
  } finally {
    await pool.end();
  }
}

// Función helper para calcular distancia
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distancia en metros
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

debugTelegramAlerts();