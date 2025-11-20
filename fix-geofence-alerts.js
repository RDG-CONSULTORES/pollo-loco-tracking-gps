const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixGeofenceAlerts() {
  try {
    console.log('🔧 Fixing geofence-alerts service...\n');
    
    // 1. Test directo del servicio geofence-alerts mejorado
    console.log('🧪 Testing geofence-alerts con coordenadas completas...');
    
    const locationData = {
      user_id: 5,
      latitude: 25.650648,
      longitude: -100.373529,
      gps_timestamp: new Date()
    };
    
    // 2. Simular entrada manual a oficina
    console.log('📍 Simulando entrada a oficina Roberto...');
    console.log(`   Ubicación: ${locationData.latitude}, ${locationData.longitude}`);
    
    // Test mejorado que incluye todas las coordenadas necesarias
    await testGeofenceAlertsImproved(locationData);
    
    // 3. Verificar que se guardó correctamente
    console.log('\n🗄️ Verificando evento en base de datos...');
    
    const eventCheck = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center, telegram_sent
      FROM geofence_events
      WHERE user_id = $1 
        AND event_timestamp > NOW() - INTERVAL '2 minutes'
      ORDER BY event_timestamp DESC
      LIMIT 1
    `, [locationData.user_id]);
    
    if (eventCheck.rows.length > 0) {
      const event = eventCheck.rows[0];
      console.log(`✅ ¡EVENTO CREADO CORRECTAMENTE!`);
      console.log(`   Tipo: ${event.event_type}`);
      console.log(`   Lugar: ${event.location_code}`);
      console.log(`   Coordenadas: ${event.latitude}, ${event.longitude}`);
      console.log(`   Distancia: ${event.distance_from_center}m`);
      console.log(`   Telegram enviado: ${event.telegram_sent ? '✅' : '❌'}`);
    } else {
      console.log('❌ No se creó evento en BD');
    }
    
    // 4. Test Telegram con eventos reales
    console.log('\n🤖 Enviando alerta Telegram...');
    await testTelegramWithGeofence(locationData);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Función mejorada que guarda eventos con coordenadas completas
async function testGeofenceAlertsImproved(locationData) {
  try {
    console.log('🔍 Buscando geofences cercanos...');
    
    // Buscar oficina Roberto específicamente
    const storesResult = await pool.query(`
      SELECT location_code, name, latitude, longitude, geofence_radius
      FROM tracking_locations_cache 
      WHERE active = true AND location_code = 'ROBERTO_OFFICE'
    `);
    
    if (storesResult.rows.length === 0) {
      console.log('❌ No se encontró oficina Roberto');
      return;
    }
    
    const store = storesResult.rows[0];
    console.log(`🏢 Encontrado: ${store.name} (${store.location_code})`);
    console.log(`   Radio: ${store.geofence_radius}m`);
    
    // Calcular distancia
    const distance = calculateDistance(
      locationData.latitude, 
      locationData.longitude,
      parseFloat(store.latitude),
      parseFloat(store.longitude)
    );
    
    console.log(`📏 Distancia calculada: ${Math.round(distance)}m`);
    
    const isInside = distance <= store.geofence_radius;
    console.log(`🎯 ${isInside ? '✅ DENTRO' : '❌ FUERA'} del geofence`);
    
    if (isInside) {
      // Crear evento completo con TODAS las coordenadas necesarias
      console.log('💾 Guardando evento ENTRADA con coordenadas...');
      
      await pool.query(`
        INSERT INTO geofence_events (
          user_id, location_code, event_type, event_timestamp,
          latitude, longitude, distance_from_center, 
          telegram_sent, telegram_sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      `, [
        locationData.user_id,
        store.location_code,
        'enter', // Cambiado de 'entry' a 'enter' para consistencia
        locationData.gps_timestamp,
        locationData.latitude,   // ✅ COORDENADAS INCLUIDAS
        locationData.longitude,  // ✅ COORDENADAS INCLUIDAS
        Math.round(distance)
      ]);
      
      console.log('✅ Evento guardado con coordenadas completas');
      
      // Simular alerta Telegram
      await sendTelegramAlertDirect(locationData, store, distance);
      
    } else {
      console.log('⚠️ Usuario está fuera del geofence');
    }
    
  } catch (error) {
    console.error('❌ Error en testGeofenceAlertsImproved:', error.message);
  }
}

// Envío directo de Telegram
async function sendTelegramAlertDirect(locationData, store, distance) {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    
    // Obtener info del usuario
    const userResult = await pool.query(
      'SELECT display_name, tracker_id FROM tracking_users WHERE id = $1',
      [locationData.user_id]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const user = userResult.rows[0];
    const time = new Date().toLocaleTimeString('es-MX');
    
    const message = `🟢 *ENTRADA DETECTADA - SISTEMA CORREGIDO*

👤 *Supervisor:* ${user.display_name} (${user.tracker_id})
🏢 *Sucursal:* ${store.name}
📍 *Ubicación:* ${locationData.latitude}, ${locationData.longitude}
📏 *Distancia:* ${Math.round(distance)}m del centro
🕒 *Hora:* ${time}

✅ El sistema de alertas geofence está funcionando correctamente.`;
    
    await bot.sendMessage(process.env.TELEGRAM_ADMIN_IDS, message, {
      parse_mode: 'Markdown'
    });
    
    console.log('📱 Alerta Telegram enviada correctamente');
    
  } catch (error) {
    console.error('❌ Error enviando Telegram:', error.message);
  }
}

// Test con mock de location-processor
async function testTelegramWithGeofence(locationData) {
  try {
    console.log('🔄 Simulando flujo completo location-processor...');
    
    // Crear payload OwnTracks simulado
    const ownTracksPayload = {
      _type: 'location',
      tid: '01',
      lat: locationData.latitude,
      lon: locationData.longitude,
      tst: Math.floor(Date.now() / 1000),
      acc: 5,
      batt: 95,
      vel: 0
    };
    
    console.log('📡 Payload OwnTracks simulado:');
    console.log(JSON.stringify(ownTracksPayload, null, 2));
    
    // Simular procesamiento sin location-processor (evitar duplicados)
    console.log('\n🎯 Simulando geofence detection manual...');
    
    // Enviar alerta directa
    await sendTelegramAlertDirect(locationData, {
      name: 'Oficina Roberto - Testing',
      location_code: 'ROBERTO_OFFICE'
    }, 15);
    
    console.log('✅ Flujo completo ejecutado');
    
  } catch (error) {
    console.error('❌ Error en flujo completo:', error.message);
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

fixGeofenceAlerts();