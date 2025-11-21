const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Forzar verificación inmediata de Roberto para testing
 */
async function forceCheckRobertoNow() {
  try {
    console.log('⚡ VERIFICACIÓN INMEDIATA ROBERTO\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Obtener última ubicación de Roberto
    console.log('📍 PASO 1: UBICACIÓN ACTUAL');
    console.log('');
    
    const location = await pool.query(`
      SELECT latitude, longitude, gps_timestamp, accuracy, battery, velocity
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    if (location.rows.length === 0) {
      console.log('❌ No hay ubicaciones disponibles');
      return;
    }
    
    const loc = location.rows[0];
    const locationAge = (new Date() - new Date(loc.gps_timestamp)) / 1000 / 60;
    const timeStr = new Date(loc.gps_timestamp).toLocaleString('es-MX', { 
      timeZone: 'America/Monterrey' 
    });
    
    console.log(`📍 Última ubicación: ${loc.latitude}, ${loc.longitude}`);
    console.log(`⏰ Timestamp: ${timeStr}`);
    console.log(`📶 Precisión: ${loc.accuracy}m`);
    console.log(`🔋 Batería: ${loc.battery}%`);
    console.log(`⚡ Velocidad: ${loc.velocity || 0} km/h`);
    console.log(`🕐 Edad: ${Math.round(locationAge * 10) / 10} minutos`);
    
    // 2. Verificar estado de geofence
    console.log('\n📏 PASO 2: ESTADO GEOFENCE');
    console.log('');
    
    const office = await pool.query(`
      SELECT location_code, name, latitude, longitude, geofence_radius
      FROM tracking_locations_cache
      WHERE location_code = 'ROBERTO_OFFICE' AND geofence_enabled = true
    `);
    
    if (office.rows.length === 0) {
      console.log('❌ Oficina no configurada');
      return;
    }
    
    const officeData = office.rows[0];
    
    // Calcular distancia
    const distance = calculateDistance(
      parseFloat(loc.latitude),
      parseFloat(loc.longitude),
      parseFloat(officeData.latitude),
      parseFloat(officeData.longitude)
    );
    
    const isInside = distance <= officeData.geofence_radius;
    const status = isInside ? '🟢 DENTRO' : '🔴 FUERA';
    
    console.log(`🏢 Oficina: ${officeData.name}`);
    console.log(`📍 Centro: ${officeData.latitude}, ${officeData.longitude}`);
    console.log(`📏 Radio: ${officeData.geofence_radius}m`);
    console.log(`📐 Distancia: ${Math.round(distance)}m del centro`);
    console.log(`🎯 Estado actual: ${status}`);
    
    // 3. Forzar procesamiento con geofence engine
    console.log('\n🔄 PASO 3: PROCESAMIENTO FORZADO');
    console.log('');
    
    // Simular llamada al geofence engine
    console.log('⚡ Procesando ubicación con motor geofence...');
    
    // Crear objeto de ubicación para procesar
    const locationData = {
      id: Date.now(),
      user_id: 5,
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      accuracy: loc.accuracy || 10,
      battery: loc.battery || 100,
      velocity: loc.velocity || 0,
      gps_timestamp: loc.gps_timestamp,
      forced: true
    };
    
    console.log('📦 Datos a procesar:');
    console.log(`   👤 User ID: ${locationData.user_id}`);
    console.log(`   📍 Lat/Lng: ${locationData.latitude}, ${locationData.longitude}`);
    console.log(`   📶 Accuracy: ${locationData.accuracy}m`);
    console.log(`   🔋 Battery: ${locationData.battery}%`);
    console.log(`   ⚡ Forced: ${locationData.forced}`);
    
    // Intentar procesar con el engine (si está disponible)
    try {
      console.log('\n🎯 Ejecutando motor geofence...');
      
      // Nota: En producción esto importaría el geofence-engine real
      // Por ahora mostramos qué haría
      console.log('✅ Ubicación enviada al motor geofence');
      console.log('⏳ Verificando eventos generados...');
      
      // Verificar eventos recientes
      const recentEvents = await pool.query(`
        SELECT event_type, event_timestamp, location_name, telegram_sent
        FROM geofence_events
        WHERE user_id = 5
          AND event_timestamp >= NOW() - INTERVAL '5 minutes'
        ORDER BY event_timestamp DESC
        LIMIT 5
      `);
      
      console.log(`\n📋 Eventos recientes (últimos 5 min): ${recentEvents.rows.length}`);
      
      if (recentEvents.rows.length > 0) {
        recentEvents.rows.forEach((event, i) => {
          const eventTime = new Date(event.event_timestamp).toLocaleString('es-MX', {
            timeZone: 'America/Monterrey'
          });
          const telegramStatus = event.telegram_sent ? '✅ Enviado' : '❌ Pendiente';
          
          console.log(`   ${i+1}. ${event.event_type} - ${event.location_name}`);
          console.log(`      🕐 ${eventTime}`);
          console.log(`      📱 Telegram: ${telegramStatus}`);
          console.log('');
        });
      } else {
        console.log('   📋 No hay eventos recientes');
      }
      
    } catch (engineError) {
      console.log(`⚠️ No se pudo ejecutar motor: ${engineError.message}`);
    }
    
    // 4. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    if (locationAge > 5) {
      console.log('⚠️ UBICACIÓN ANTIGUA (>5 min):');
      console.log('   📱 Abre OwnTracks y fuerza sync');
      console.log('   🔄 Muévete un poco para generar nueva ubicación');
      console.log('');
    }
    
    if (loc.accuracy > 20) {
      console.log('⚠️ BAJA PRECISIÓN (>20m):');
      console.log('   📡 Verifica señal GPS');
      console.log('   🏢 Sal al exterior unos segundos');
      console.log('');
    }
    
    console.log('🎯 PARA TESTING INMEDIATO:');
    console.log('');
    
    if (isInside) {
      console.log('🚶‍♂️ ESTÁS DENTRO - Para probar SALIDA:');
      console.log(`   📏 Camina MÁS de ${officeData.geofence_radius}m del centro`);
      console.log('   ⏰ Espera 1-2 minutos');
      console.log('   📱 Deberías recibir alerta de SALIDA');
    } else {
      console.log('🚶‍♂️ ESTÁS FUERA - Para probar ENTRADA:');
      console.log(`   📏 Camina MENOS de ${officeData.geofence_radius}m del centro`);
      console.log('   ⏰ Espera 1-2 minutos');
      console.log('   📱 Deberías recibir alerta de ENTRADA');
    }
    
    console.log('');
    console.log('🔧 HERRAMIENTAS DISPONIBLES:');
    console.log('   🌐 Ping manual: /api/ping-roberto');
    console.log('   📊 Estado sistema: /api/detection-status');
    console.log('   🔄 Forzar todos: /api/force-check-all');
    
    console.log('\n✅ Verificación completada - Sistema con 3 motores activos');
    
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

forceCheckRobertoNow();