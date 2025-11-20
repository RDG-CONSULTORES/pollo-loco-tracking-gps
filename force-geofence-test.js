const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function forceGeofenceTest() {
  try {
    console.log('🧪 Forzando test de geofence para Roberto...\n');
    
    // 1. Usar tu ubicación GPS más reciente
    const recentGPS = await pool.query(`
      SELECT user_id, latitude, longitude, gps_timestamp
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    if (recentGPS.rows.length === 0) {
      console.log('❌ No hay datos GPS para user_id 5');
      return;
    }
    
    const location = recentGPS.rows[0];
    console.log('📍 Usando tu última ubicación GPS:');
    console.log(`   Coordenadas: ${location.latitude}, ${location.longitude}`);
    console.log(`   Timestamp: ${location.gps_timestamp}`);
    
    // Calcular distancia a oficina
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    const distance = calculateDistance(location.latitude, location.longitude, officeLat, officeLng);
    
    console.log(`🎯 Distancia a tu oficina: ${Math.round(distance)} metros`);
    console.log(`${distance <= 20 ? '✅ DENTRO' : '❌ FUERA'} del geofence de 20m`);
    
    // 2. Llamar directamente al geofence-alerts
    console.log('\n🚨 Ejecutando geofence-alerts directamente...');
    
    try {
      const geofenceAlerts = require('./src/services/geofence-alerts');
      
      const alertData = {
        user_id: location.user_id,
        latitude: location.latitude,
        longitude: location.longitude,
        gps_timestamp: location.gps_timestamp
      };
      
      console.log('📡 Datos para geofence-alerts:', alertData);
      
      await geofenceAlerts.checkGeofenceAlerts(alertData);
      
      console.log('✅ Geofence-alerts ejecutado exitosamente');
      
    } catch (alertError) {
      console.error('❌ Error en geofence-alerts:', alertError.message);
      console.error('Stack:', alertError.stack);
    }
    
    // 3. Verificar si se generó evento
    console.log('\n🔍 Verificando eventos generados...');
    
    const eventsCheck = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp, 
        distance_from_center, telegram_sent
      FROM geofence_events
      WHERE user_id = $1 
        AND event_timestamp > NOW() - INTERVAL '5 minutes'
      ORDER BY event_timestamp DESC
      LIMIT 3
    `, [location.user_id]);
    
    if (eventsCheck.rows.length > 0) {
      console.log('📋 Eventos recientes generados:');
      eventsCheck.rows.forEach((event, i) => {
        const icon = event.event_type === 'entry' ? '🟢' : '🔴';
        console.log(`   ${i+1}. ${icon} ${event.event_type.toUpperCase()}: ${event.location_code}`);
        console.log(`      🕒 ${event.event_timestamp}`);
        console.log(`      📏 ${event.distance_from_center}m`);
        console.log(`      📱 Telegram: ${event.telegram_sent ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ No se generaron eventos recientes');
      
      // Verificar configuración
      console.log('\n🔧 Verificando configuración...');
      
      const officeCheck = await pool.query(`
        SELECT location_code, name, latitude, longitude, geofence_radius, active
        FROM tracking_locations_cache
        WHERE location_code = 'ROBERTO_OFFICE'
      `);
      
      if (officeCheck.rows.length > 0) {
        const office = officeCheck.rows[0];
        console.log(`✅ Oficina configurada: ${office.name}`);
        console.log(`   📍 ${office.latitude}, ${office.longitude}`);
        console.log(`   📏 Radio: ${office.geofence_radius}m`);
        console.log(`   🔛 Activa: ${office.active}`);
      } else {
        console.log('❌ Oficina ROBERTO_OFFICE no encontrada');
      }
      
      // Verificar usuario
      const userCheck = await pool.query(`
        SELECT display_name, tracker_id
        FROM tracking_users
        WHERE id = $1
      `, [location.user_id]);
      
      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        console.log(`✅ Usuario: ${user.display_name} (${user.tracker_id})`);
      } else {
        console.log('❌ Usuario no encontrado');
      }
    }
    
    // 4. Test directo del bot Telegram
    console.log('\n🤖 Testing bot Telegram...');
    
    try {
      const { getBot } = require('./src/telegram/bot');
      const bot = getBot();
      
      if (bot && bot.bot) {
        const testMessage = `🧪 TEST MANUAL GEOFENCE\n\n` +
          `👤 Usuario ID: ${location.user_id}\n` +
          `📍 Ubicación: ${location.latitude}, ${location.longitude}\n` +
          `🎯 Distancia oficina: ${Math.round(distance)}m\n` +
          `⏰ ${new Date().toLocaleString('es-MX')}\n\n` +
          `Si recibes esto, el sistema Telegram funciona ✅`;
        
        await bot.broadcastToAdmins(testMessage);
        console.log('✅ Mensaje de prueba enviado a Telegram');
        
      } else {
        console.log('❌ Bot Telegram no disponible');
      }
      
    } catch (botError) {
      console.error('❌ Error con bot Telegram:', botError.message);
    }
    
    console.log('\n📋 RESUMEN:');
    console.log(`   📍 GPS funcionando: ✅ (${Math.round(distance)}m de oficina)`);
    console.log(`   🏢 Oficina configurada: ✅ (20m radius)`);
    console.log(`   👤 Usuario válido: ✅ (ID: ${location.user_id})`);
    console.log(`   🤖 Bot Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅' : '❌'}`);
    
    if (distance <= 20) {
      console.log('\n🟢 DEBERÍAS HABER RECIBIDO ALERTA DE ENTRADA');
    } else {
      console.log('\n🔴 DEBERÍAS HABER RECIBIDO ALERTA DE SALIDA (si estabas dentro antes)');
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

forceGeofenceTest();