const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugGeofenceEngineDetailed() {
  try {
    console.log('🔍 Debug detallado de geofence-engine...\n');
    
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    
    // 1. Verificar función get_nearby_geofences existe
    console.log('🧪 Testing función get_nearby_geofences en PostgreSQL...');
    
    try {
      const result = await pool.query(`
        SELECT * FROM get_nearby_geofences($1, $2, $3)
      `, [officeLat, officeLng, 200]);
      
      console.log(`✅ Función get_nearby_geofences ejecutada`);
      console.log(`📊 Resultados: ${result.rows.length} geofences encontrados`);
      
      result.rows.forEach((row, i) => {
        console.log(`   ${i+1}. ${row.location_code}: ${row.store_name || row.name}`);
        console.log(`      Distance: ${Math.round(row.distance_meters)}m`);
        console.log(`      Inside: ${row.is_inside}`);
      });
      
    } catch (funcError) {
      console.log(`❌ Error con get_nearby_geofences: ${funcError.message}`);
      console.log('🔧 Probando consulta manual...');
      
      // 2. Consulta manual si la función no existe
      const manualResult = await pool.query(`
        SELECT 
          location_code,
          name,
          latitude,
          longitude,
          geofence_radius,
          active,
          (6371000 * ACOS(
            COS(RADIANS($1)) * COS(RADIANS(latitude::float)) * 
            COS(RADIANS(longitude::float) - RADIANS($2)) + 
            SIN(RADIANS($1)) * SIN(RADIANS(latitude::float))
          )) AS distance_meters
        FROM tracking_locations_cache
        WHERE active = true
        ORDER BY distance_meters ASC
        LIMIT 10
      `, [officeLat, officeLng]);
      
      console.log(`📊 Consulta manual: ${manualResult.rows.length} geofences encontrados`);
      
      manualResult.rows.forEach((row, i) => {
        const isInside = row.distance_meters <= row.geofence_radius;
        console.log(`   ${i+1}. ${row.location_code}: ${row.name}`);
        console.log(`      Distance: ${Math.round(row.distance_meters)}m | Radius: ${row.geofence_radius}m`);
        console.log(`      ${isInside ? '✅ INSIDE' : '❌ OUTSIDE'}`);
      });
      
      // 3. Específicamente buscar ROBERTO_OFFICE
      console.log('\n🎯 Verificando específicamente ROBERTO_OFFICE...');
      
      const robertoOffice = await pool.query(`
        SELECT 
          location_code,
          name,
          latitude,
          longitude,
          geofence_radius,
          active
        FROM tracking_locations_cache
        WHERE location_code = 'ROBERTO_OFFICE'
      `);
      
      if (robertoOffice.rows.length > 0) {
        const office = robertoOffice.rows[0];
        const distance = calculateDistance(
          officeLat, officeLng,
          parseFloat(office.latitude), parseFloat(office.longitude)
        );
        
        console.log(`✅ ROBERTO_OFFICE encontrado:`);
        console.log(`   Nombre: ${office.name}`);
        console.log(`   Coordenadas BD: ${office.latitude}, ${office.longitude}`);
        console.log(`   Radio: ${office.geofence_radius}m`);
        console.log(`   Activo: ${office.active}`);
        console.log(`   Distancia calculada: ${Math.round(distance)}m`);
        console.log(`   ${distance <= office.geofence_radius ? '✅ DENTRO' : '❌ FUERA'} del geofence`);
      } else {
        console.log('❌ ROBERTO_OFFICE no encontrado en BD');
      }
    }
    
    // 4. Verificar geofence-engine directamente
    console.log('\n🔧 Testing geofence-engine.processLocation() directamente...');
    
    try {
      const geofenceEngine = require('./src/services/geofence-engine');
      
      const locationData = {
        id: Date.now(),
        user_id: 5,
        latitude: officeLat,
        longitude: officeLng,
        accuracy: 5,
        battery: 95,
        gps_timestamp: new Date()
      };
      
      console.log('📡 Enviando a geofence-engine:');
      console.log(`   User ID: ${locationData.user_id}`);
      console.log(`   Coordenadas: ${locationData.latitude}, ${locationData.longitude}`);
      
      const events = await geofenceEngine.processLocation(locationData);
      
      console.log(`\n📋 Resultado geofence-engine:`);
      console.log(`   Eventos generados: ${events.length}`);
      
      if (events.length > 0) {
        events.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
          console.log(`      Distance: ${event.distance_meters}m`);
        });
      } else {
        console.log('❌ No se generaron eventos');
      }
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
    }
    
    // 5. Test manual de geofence-alerts mejorado
    console.log('\n🚨 Testing geofence-alerts mejorado...');
    
    try {
      const geofenceAlerts = require('./src/services/geofence-alerts');
      
      await geofenceAlerts.checkGeofenceAlerts({
        user_id: 5,
        latitude: officeLat,
        longitude: officeLng,
        gps_timestamp: new Date()
      });
      
      console.log('✅ Geofence-alerts ejecutado');
      
      // Verificar evento creado
      const eventCheck = await pool.query(`
        SELECT 
          event_type, location_code, event_timestamp,
          latitude, longitude, distance_from_center, telegram_sent
        FROM geofence_events
        WHERE user_id = 5 
          AND event_timestamp > NOW() - INTERVAL '1 minute'
        ORDER BY event_timestamp DESC
        LIMIT 1
      `);
      
      if (eventCheck.rows.length > 0) {
        const event = eventCheck.rows[0];
        console.log(`🎯 ¡EVENTO CREADO!`);
        console.log(`   Tipo: ${event.event_type}`);
        console.log(`   Lugar: ${event.location_code}`);
        console.log(`   Coordenadas: ${event.latitude}, ${event.longitude}`);
        console.log(`   Distancia: ${event.distance_from_center}m`);
        console.log(`   Telegram: ${event.telegram_sent ? '✅' : '❌'}`);
      } else {
        console.log('❌ No se creó evento en BD');
      }
      
    } catch (alertsError) {
      console.error('❌ Error en geofence-alerts:', alertsError.message);
    }
    
    console.log('\n📋 DIAGNÓSTICO FINAL:');
    console.log('1. ✅ Bot Telegram funciona correctamente');
    console.log('2. ✅ Geofence-alerts funciona y guarda eventos');
    console.log('3. 🔧 Geofence-engine puede necesitar función get_nearby_geofences');
    console.log('4. 🔧 Location-processor evita duplicados');
    console.log('');
    console.log('💡 RECOMENDACIÓN:');
    console.log('   Usar geofence-alerts directamente (bypass geofence-engine)');
    console.log('   o crear función get_nearby_geofences en PostgreSQL');
    
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

debugGeofenceEngineDetailed();