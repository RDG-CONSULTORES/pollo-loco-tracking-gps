const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testGeofenceFlow() {
  try {
    console.log('🔍 Testing flujo completo de geofence para Roberto...\n');
    
    // 1. Verificar tabla tracking_locations (estructura real)
    const tableStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_locations' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estructura tracking_locations:');
    tableStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // 2. Buscar ubicaciones GPS recientes (ajustando a estructura real)
    console.log('\n📍 Ubicaciones GPS recientes:');
    
    // Intentar diferentes queries según la estructura
    let locationsResult;
    try {
      // Try query 1: con user_id
      locationsResult = await pool.query(`
        SELECT 
          id, user_id, latitude, longitude, accuracy, battery, 
          gps_timestamp, created_at
        FROM tracking_locations
        ORDER BY gps_timestamp DESC
        LIMIT 10
      `);
      console.log('✅ Query con user_id funcionó');
    } catch (error) {
      try {
        // Try query 2: sin user_id, solo email
        locationsResult = await pool.query(`
          SELECT 
            id, zenput_email as email, latitude, longitude, accuracy, battery, 
            gps_timestamp, created_at
          FROM tracking_locations
          ORDER BY gps_timestamp DESC
          LIMIT 10
        `);
        console.log('✅ Query con zenput_email funcionó');
      } catch (error2) {
        // Try query 3: mínima
        locationsResult = await pool.query(`
          SELECT 
            id, latitude, longitude, gps_timestamp
          FROM tracking_locations
          ORDER BY gps_timestamp DESC
          LIMIT 10
        `);
        console.log('✅ Query mínima funcionó');
      }
    }
    
    if (locationsResult.rows.length > 0) {
      console.log(`📊 ${locationsResult.rows.length} ubicaciones encontradas:`);
      
      locationsResult.rows.forEach((loc, i) => {
        console.log(`   ${i+1}. ID: ${loc.id}`);
        console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`      🕒 ${loc.gps_timestamp}`);
        if (loc.user_id) console.log(`      👤 User ID: ${loc.user_id}`);
        if (loc.email) console.log(`      📧 Email: ${loc.email}`);
        
        // Calcular distancia a oficina Roberto
        const distance = calculateDistance(
          parseFloat(loc.latitude), 
          parseFloat(loc.longitude), 
          25.650648, 
          -100.373529
        );
        console.log(`      🎯 Distancia a oficina Roberto: ${Math.round(distance)}m ${distance <= 20 ? '(DENTRO)' : '(FUERA)'}`);
        console.log('');
      });
      
    } else {
      console.log('❌ No hay ubicaciones GPS en la tabla');
    }
    
    // 3. Verificar tracking_users
    console.log('👤 Usuarios tracking configurados:');
    
    const usersResult = await pool.query(`
      SELECT id, tracker_id, display_name, zenput_email, active
      FROM tracking_users
      WHERE tracker_id ILIKE '%robert%' OR display_name ILIKE '%robert%'
      ORDER BY id
    `);
    
    usersResult.rows.forEach(user => {
      console.log(`   ${user.active ? '✅' : '❌'} ${user.id}: ${user.tracker_id} | ${user.display_name} | ${user.zenput_email}`);
    });
    
    // 4. Test manual del geofence processor
    console.log('\n🧪 Test manual de procesamiento geofence...');
    
    if (locationsResult.rows.length > 0 && usersResult.rows.length > 0) {
      const testLocation = locationsResult.rows[0];
      const testUser = usersResult.rows[0];
      
      console.log('🔄 Simulando procesamiento geofence con:');
      console.log(`   Usuario: ${testUser.display_name} (ID: ${testUser.id})`);
      console.log(`   Ubicación: ${testLocation.latitude}, ${testLocation.longitude}`);
      
      // Simular entrada al location processor
      console.log('\n📡 Simulando payload OwnTracks...');
      
      const simulatedPayload = {
        tid: testUser.tracker_id,
        lat: parseFloat(testLocation.latitude),
        lon: parseFloat(testLocation.longitude),
        tst: Math.floor(Date.now() / 1000),
        acc: 10,
        batt: 85,
        _type: 'location'
      };
      
      console.log('📦 Payload simulado:', JSON.stringify(simulatedPayload, null, 2));
      
      try {
        // Test directo del location processor
        const locationProcessor = require('./src/services/location-processor');
        const result = await locationProcessor.processLocation(simulatedPayload);
        
        console.log('\n✅ Resultado del location processor:');
        console.log(JSON.stringify(result, null, 2));
        
      } catch (error) {
        console.log('\n❌ Error ejecutando location processor:');
        console.log(error.message);
        
        // Si el location processor falla, testeamos el geofence-alerts directamente
        console.log('\n🔄 Probando geofence-alerts directamente...');
        
        try {
          const geofenceAlerts = require('./src/services/geofence-alerts');
          
          await geofenceAlerts.checkGeofenceAlerts({
            user_id: testUser.id,
            latitude: parseFloat(testLocation.latitude),
            longitude: parseFloat(testLocation.longitude),
            gps_timestamp: new Date()
          });
          
          console.log('✅ Geofence alerts ejecutado directamente');
          
        } catch (geofenceError) {
          console.log('❌ Error en geofence-alerts:', geofenceError.message);
        }
      }
    }
    
    // 5. Verificar eventos geofence recientes
    console.log('\n🎯 Eventos geofence para ROBERTO_OFFICE:');
    
    const eventsResult = await pool.query(`
      SELECT 
        id, user_id, event_type, event_timestamp, 
        distance_from_center, telegram_sent
      FROM geofence_events
      WHERE location_code = 'ROBERTO_OFFICE'
      ORDER BY event_timestamp DESC
      LIMIT 5
    `);
    
    if (eventsResult.rows.length > 0) {
      eventsResult.rows.forEach((event, i) => {
        const icon = event.event_type === 'entry' ? '🟢' : '🔴';
        console.log(`   ${i+1}. ${icon} ${event.event_type.toUpperCase()}: User ${event.user_id}`);
        console.log(`      🕒 ${event.event_timestamp}`);
        console.log(`      📏 ${event.distance_from_center}m | Telegram: ${event.telegram_sent ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ No hay eventos geofence para ROBERTO_OFFICE');
    }
    
    console.log('\n📋 DIAGNÓSTICO:');
    
    if (locationsResult.rows.length === 0) {
      console.log('❌ PROBLEMA: No hay ubicaciones GPS');
      console.log('   → Verificar que OwnTracks esté enviando datos');
    } else if (usersResult.rows.length === 0) {
      console.log('❌ PROBLEMA: No hay usuarios Roberto en tracking_users');
      console.log('   → Crear usuario con GPS Wizard');
    } else if (eventsResult.rows.length === 0) {
      console.log('❌ PROBLEMA: GPS funciona pero no se generan eventos geofence');
      console.log('   → El location processor no está llamando geofence-alerts');
      console.log('   → Verificar que user_id en tracking_locations coincida con tracking_users');
    } else {
      console.log('✅ TODO FUNCIONA: El problema está en otro lado');
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

testGeofenceFlow();