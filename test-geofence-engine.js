const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testGeofenceEngine() {
  try {
    console.log('🧪 Testing geofence-engine directamente...\n');
    
    // 1. Usar tu ubicación GPS más reciente
    const recentGPS = await pool.query(`
      SELECT user_id, latitude, longitude, gps_timestamp, accuracy, battery
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    const location = recentGPS.rows[0];
    console.log('📍 Tu última ubicación GPS:');
    console.log(`   User ID: ${location.user_id}`);
    console.log(`   Coordenadas: ${location.latitude}, ${location.longitude}`);
    console.log(`   Timestamp: ${location.gps_timestamp}`);
    
    // 2. Calcular distancia a oficina manualmente
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    const distance = calculateDistance(location.latitude, location.longitude, officeLat, officeLng);
    
    console.log(`🎯 Distancia a oficina: ${Math.round(distance)}m`);
    console.log(`${distance <= 20 ? '✅ DENTRO' : '❌ FUERA'} del geofence de 20m\n`);
    
    // 3. Test directo del geofence-engine
    console.log('🔧 Testing geofence-engine.processLocation()...');
    
    try {
      const geofenceEngine = require('./src/services/geofence-engine');
      
      const locationData = {
        id: location.id || Date.now(), // Mock ID si no existe
        user_id: location.user_id,
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        accuracy: location.accuracy,
        battery: location.battery,
        gps_timestamp: location.gps_timestamp
      };
      
      console.log('📡 Enviando a geofence-engine:', locationData);
      
      const events = await geofenceEngine.processLocation(locationData);
      
      console.log(`\n✅ Geofence-engine completado. Eventos detectados: ${events.length}`);
      
      if (events.length > 0) {
        console.log('📋 Eventos generados:');
        events.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
          console.log(`      Distance: ${event.distance_meters}m`);
          console.log(`      User: ${event.user_id}`);
        });
        
        // Si hay eventos, el location-processor debería llamar a geofence-alerts
        console.log('\n🚨 Ahora testing geofence-alerts (que debería ser llamado por location-processor)...');
        
        try {
          const geofenceAlerts = require('./src/services/geofence-alerts');
          
          await geofenceAlerts.checkGeofenceAlerts({
            user_id: location.user_id,
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
            gps_timestamp: location.gps_timestamp
          });
          
          console.log('✅ Geofence-alerts ejecutado exitosamente');
          
        } catch (alertsError) {
          console.error('❌ Error en geofence-alerts:', alertsError.message);
        }
        
      } else {
        console.log('❌ No se detectaron eventos de geofence');
        console.log('\n🔍 Debugging por qué no se detectaron eventos...');
        
        // Debug: verificar geofences cercanos manualmente
        const nearbyCheck = await pool.query(`
          SELECT 
            location_code,
            name,
            latitude,
            longitude,
            geofence_radius,
            active
          FROM tracking_locations_cache
          WHERE active = true
        `);
        
        console.log(`📊 Total geofences activos: ${nearbyCheck.rows.length}`);
        
        nearbyCheck.rows.forEach(geofence => {
          const dist = calculateDistance(
            parseFloat(location.latitude),
            parseFloat(location.longitude),
            parseFloat(geofence.latitude),
            parseFloat(geofence.longitude)
          );
          
          const isNear = dist <= (geofence.geofence_radius + 50); // +50m buffer para debug
          console.log(`   ${isNear ? '🎯' : '📍'} ${geofence.location_code}: ${geofence.name}`);
          console.log(`      Distance: ${Math.round(dist)}m | Radius: ${geofence.geofence_radius}m`);
          console.log(`      ${dist <= geofence.geofence_radius ? '✅ INSIDE' : '❌ OUTSIDE'}`);
        });
      }
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
      console.error('Stack:', engineError.stack);
    }
    
    // 4. Verificar eventos en BD
    console.log('\n🗄️ Verificando eventos en base de datos...');
    
    const eventsCheck = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp,
        distance_from_center, telegram_sent
      FROM geofence_events
      WHERE user_id = $1 
        AND event_timestamp > NOW() - INTERVAL '10 minutes'
      ORDER BY event_timestamp DESC
      LIMIT 5
    `, [location.user_id]);
    
    if (eventsCheck.rows.length > 0) {
      console.log('📋 Eventos recientes en BD:');
      eventsCheck.rows.forEach((event, i) => {
        console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
        console.log(`      Timestamp: ${event.event_timestamp}`);
        console.log(`      Distance: ${event.distance_from_center}m`);
        console.log(`      Telegram sent: ${event.telegram_sent ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ No hay eventos recientes en BD');
    }
    
    console.log('\n📋 DIAGNÓSTICO FINAL:');
    
    if (events && events.length > 0) {
      console.log('✅ Geofence-engine funciona - detecta eventos');
      console.log('🔧 Problema: Verificar que location-processor llame correctamente a geofence-alerts');
    } else {
      console.log('❌ Geofence-engine NO detecta eventos');
      console.log('🔧 Problema: Geofence-engine no encuentra geofences cercanos o no detecta cambios de estado');
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

testGeofenceEngine();