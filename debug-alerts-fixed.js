const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugAlertsFixed() {
  try {
    console.log('🔍 Debugging alertas Telegram - versión corregida...\n');
    
    // 1. Verificar estructura de tablas primero
    console.log('📋 Verificando estructura de tablas...');
    
    const trackingLocationsStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_locations' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Columnas en tracking_locations:');
    trackingLocationsStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // 2. Verificar últimas ubicaciones GPS (ajustando consulta)
    console.log('\n📍 Últimas ubicaciones GPS recibidas:');
    
    const locationsResult = await pool.query(`
      SELECT 
        id,
        zenput_email,
        latitude,
        longitude,
        accuracy,
        battery,
        gps_timestamp,
        created_at
      FROM tracking_locations
      WHERE zenput_email ILIKE '%roberto%'
         OR zenput_email IN ('rd@polloloco.com', 'roberto@polloloco.com')
      ORDER BY gps_timestamp DESC
      LIMIT 10
    `);
    
    if (locationsResult.rows.length > 0) {
      console.log(`✅ ${locationsResult.rows.length} ubicaciones GPS encontradas:`);
      locationsResult.rows.forEach((loc, i) => {
        console.log(`   ${i+1}. Email: ${loc.zenput_email}`);
        console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`      🕒 ${loc.gps_timestamp}`);
        console.log(`      🔋 ${loc.battery}% | 📏 ${loc.accuracy}m`);
        
        // Calcular distancia a oficina
        const officeLat = 25.650648;
        const officeLng = -100.373529;
        const distance = calculateDistance(loc.latitude, loc.longitude, officeLat, officeLng);
        console.log(`      🎯 Distancia a oficina: ${Math.round(distance)}m ${distance <= 20 ? '(DENTRO DEL GEOFENCE)' : '(FUERA DEL GEOFENCE)'}`);
        console.log('');
      });
      
      // Verificar si las ubicaciones recientes están dentro del geofence
      const recentLocation = locationsResult.rows[0];
      const distance = calculateDistance(recentLocation.latitude, recentLocation.longitude, 25.650648, -100.373529);
      console.log(`🎯 Tu última ubicación está a ${Math.round(distance)}m de la oficina`);
      
    } else {
      console.log('❌ No hay ubicaciones GPS recientes para Roberto');
      
      // Buscar cualquier ubicación reciente
      const anyLocationsResult = await pool.query(`
        SELECT 
          zenput_email,
          latitude,
          longitude,
          gps_timestamp
        FROM tracking_locations
        ORDER BY gps_timestamp DESC
        LIMIT 5
      `);
      
      console.log('\n📍 Últimas ubicaciones de cualquier usuario:');
      anyLocationsResult.rows.forEach((loc, i) => {
        console.log(`   ${i+1}. ${loc.zenput_email}: ${loc.latitude}, ${loc.longitude} @ ${loc.gps_timestamp}`);
      });
    }
    
    // 3. Verificar usuarios tracking
    console.log('\n👤 Usuarios tracking configurados:');
    
    const usersResult = await pool.query(`
      SELECT 
        id,
        tracker_id,
        display_name,
        zenput_email,
        active
      FROM tracking_users 
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log(`📊 ${usersResult.rows.length} usuarios encontrados:`);
    usersResult.rows.forEach(user => {
      const status = user.active ? '✅ ACTIVO' : '❌ PAUSADO';
      console.log(`   ${user.id}. ${user.tracker_id} | ${user.display_name} | ${user.zenput_email} | ${status}`);
    });
    
    // 4. Verificar eventos geofence
    console.log('\n🎯 Eventos geofence recientes:');
    
    const eventsResult = await pool.query(`
      SELECT 
        id,
        user_id,
        location_code,
        event_type,
        event_timestamp,
        distance_from_center,
        telegram_sent,
        telegram_sent_at
      FROM geofence_events
      WHERE location_code = 'ROBERTO_OFFICE'
      ORDER BY event_timestamp DESC
      LIMIT 10
    `);
    
    if (eventsResult.rows.length > 0) {
      console.log(`📋 ${eventsResult.rows.length} eventos encontrados:`);
      eventsResult.rows.forEach((event, i) => {
        const icon = event.event_type === 'entry' ? '🟢' : '🔴';
        const telegramStatus = event.telegram_sent ? '✅ ENVIADO' : '❌ NO ENVIADO';
        console.log(`   ${i+1}. ${icon} ${event.event_type.toUpperCase()}: Usuario ID ${event.user_id}`);
        console.log(`      🕒 ${event.event_timestamp}`);
        console.log(`      📏 ${event.distance_from_center}m del centro`);
        console.log(`      📱 Telegram: ${telegramStatus}`);
        console.log('');
      });
    } else {
      console.log('❌ No hay eventos geofence para ROBERTO_OFFICE');
      console.log('   🔧 Esto indica que el sistema no está detectando entradas/salidas');
    }
    
    // 5. Test Bot Telegram
    console.log('\n🤖 Testing Bot Telegram...');
    console.log(`   Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   Admin ID: ${process.env.TELEGRAM_ADMIN_IDS || 'No configurado'}`);
    
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_IDS) {
      try {
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        
        const botInfo = await bot.getMe();
        console.log(`   ✅ Bot conectado: @${botInfo.username}`);
        
        const adminId = process.env.TELEGRAM_ADMIN_IDS.split(',')[0];
        
        await bot.sendMessage(adminId, 
          `🧪 TEST DEBUGGING ALERTAS\n\n` +
          `⏰ ${new Date().toLocaleString('es-MX')}\n` +
          `📍 Oficina: 25.650648, -100.373529\n` +
          `📏 Radio: 20 metros\n\n` +
          `Si recibes esto, el bot Telegram funciona ✅\n` +
          `Ahora necesitamos revisar por qué no se generan alertas automáticas.`
        );
        
        console.log('   ✅ Mensaje de prueba enviado a Telegram');
        
      } catch (error) {
        console.log(`   ❌ Error con bot Telegram: ${error.message}`);
      }
    }
    
    console.log('\n🔧 DIAGNÓSTICO:');
    if (locationsResult.rows.length === 0) {
      console.log('❌ PROBLEMA: No hay ubicaciones GPS para Roberto');
      console.log('   Solución: Verificar que OwnTracks esté enviando datos con el tracker_id correcto');
    } else if (eventsResult.rows.length === 0) {
      console.log('❌ PROBLEMA: GPS funciona pero no se generan eventos geofence');
      console.log('   Solución: El sistema geofence no está procesando las ubicaciones');
    } else {
      console.log('✅ PROBLEMA: Todo funciona pero Telegram no llega');
      console.log('   Solución: Revisar configuración del bot o permisos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

debugAlertsFixed();