const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function adjustGeofence15m() {
  try {
    console.log('📏 AJUSTANDO GEOFENCE DE OFICINA ROBERTO A 15 METROS\n');
    
    // 1. Ver configuración actual
    console.log('📋 Configuración actual:');
    
    const current = await pool.query(`
      SELECT location_code, name, latitude, longitude, geofence_radius, active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (current.rows.length > 0) {
      const office = current.rows[0];
      console.log(`   🏢 Nombre: ${office.name}`);
      console.log(`   📍 Centro: ${office.latitude}, ${office.longitude}`);
      console.log(`   📏 Radio ACTUAL: ${office.geofence_radius} metros`);
      console.log(`   🟢 Estado: ${office.active ? 'Activo' : 'Inactivo'}`);
    } else {
      console.log('❌ No se encontró oficina Roberto');
      return;
    }
    
    // 2. Actualizar a 15 metros
    console.log('\n🔧 Actualizando radio a 15 metros...');
    
    const updateResult = await pool.query(`
      UPDATE tracking_locations_cache 
      SET 
        geofence_radius = 15,
        synced_at = NOW()
      WHERE location_code = 'ROBERTO_OFFICE'
      RETURNING location_code, name, geofence_radius
    `);
    
    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('✅ ¡Geofence actualizado exitosamente!');
      console.log(`   📏 Nuevo radio: ${updated.geofence_radius} metros`);
      console.log(`   🏢 Oficina: ${updated.name}`);
    }
    
    // 3. Calcular nueva área de cobertura
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    const newRadius = 15;
    
    console.log('\n🎯 NUEVA CONFIGURACIÓN PARA TESTING:');
    console.log(`   📍 Centro: ${officeLat}, ${officeLng}`);
    console.log(`   📏 Radio: ${newRadius} metros`);
    console.log(`   🟢 DENTRO: <${newRadius}m del centro`);
    console.log(`   🔴 FUERA: >${newRadius}m del centro`);
    
    // 4. Calcular coordenadas específicas para testing con 15m
    console.log('\n📍 COORDENADAS ESPECÍFICAS PARA PRUEBAS:');
    console.log('');
    console.log('🟢 PARA ENTRADA (dentro de 15m):');
    console.log(`   📍 Centro exacto: ${officeLat}, ${officeLng} (0m)`);
    console.log(`   📍 Norte 10m: ${(officeLat + 0.00009).toFixed(8)}, ${officeLng} (~10m)`);
    console.log(`   📍 Sur 10m: ${(officeLat - 0.00009).toFixed(8)}, ${officeLng} (~10m)`);
    console.log(`   📍 Este 12m: ${officeLat}, ${(officeLng + 0.000108).toFixed(8)} (~12m)`);
    console.log(`   📍 Oeste 12m: ${officeLat}, ${(officeLng - 0.000108).toFixed(8)} (~12m)`);
    
    console.log('\n🔴 PARA SALIDA (fuera de 15m):');
    console.log(`   📍 Norte 18m: ${(officeLat + 0.000162).toFixed(8)}, ${officeLng} (~18m)`);
    console.log(`   📍 Sur 18m: ${(officeLat - 0.000162).toFixed(8)}, ${officeLng} (~18m)`);
    console.log(`   📍 Este 20m: ${officeLat}, ${(officeLng + 0.00018).toFixed(8)} (~20m)`);
    console.log(`   📍 Oeste 20m: ${officeLat}, ${(officeLng - 0.00018).toFixed(8)} (~20m)`);
    
    // 5. Test de la función geofence con nuevo radio
    console.log('\n🧪 TEST CON NUEVO RADIO DE 15M:');
    
    try {
      const testResult = await pool.query(`
        SELECT * FROM get_nearby_geofences($1, $2, $3)
        WHERE location_code = 'ROBERTO_OFFICE'
      `, [officeLat, officeLng, 50]);
      
      if (testResult.rows.length > 0) {
        const geofence = testResult.rows[0];
        console.log('✅ Función PostgreSQL actualizada:');
        console.log(`   📏 Radio detectado: ${geofence.geofence_radius}m`);
        console.log(`   📍 Distancia al centro: ${Math.round(geofence.distance_meters)}m`);
        console.log(`   🎯 Está dentro: ${geofence.is_inside ? '✅ SÍ' : '❌ NO'}`);
      } else {
        console.log('❌ No se detectó geofence en función PostgreSQL');
      }
      
    } catch (testError) {
      console.error('❌ Error en test PostgreSQL:', testError.message);
    }
    
    // 6. Calcular tu distancia actual con 15m
    console.log('\n📍 VERIFICANDO TU UBICACIÓN ACTUAL:');
    
    const yourLocation = await pool.query(`
      SELECT latitude, longitude, gps_timestamp, accuracy
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    if (yourLocation.rows.length > 0) {
      const loc = yourLocation.rows[0];
      const distance = calculateDistance(
        parseFloat(loc.latitude),
        parseFloat(loc.longitude),
        officeLat,
        officeLng
      );
      
      const isInside = distance <= 15;
      const timestamp = new Date(loc.gps_timestamp).toLocaleString('es-MX');
      
      console.log(`   📍 Tu última ubicación: ${loc.latitude}, ${loc.longitude}`);
      console.log(`   ⏰ Timestamp: ${timestamp}`);
      console.log(`   📏 Distancia actual: ${Math.round(distance)}m del centro`);
      console.log(`   🎯 Con radio 15m: ${isInside ? '🟢 DENTRO' : '🔴 FUERA'}`);
      console.log(`   🎯 Accuracy: ${loc.accuracy}m`);
      
      if (isInside) {
        console.log(`   ✅ Ahora estás dentro del geofence de 15m`);
      } else {
        const needToMove = Math.round(distance - 15);
        console.log(`   📏 Necesitas acercarte ${needToMove}m más para entrar`);
      }
    }
    
    // 7. Test directo del geofence-engine con 15m
    console.log('\n🧪 TEST GEOFENCE-ENGINE CON 15M:');
    
    try {
      const geofenceEngine = require('./src/services/geofence-engine');
      
      // Test coordenadas dentro (10m del centro)
      const insideLocationData = {
        id: Date.now(),
        user_id: 5,
        latitude: officeLat + 0.00009, // ~10m norte del centro
        longitude: officeLng,
        accuracy: 5,
        battery: 85,
        gps_timestamp: new Date()
      };
      
      console.log('📡 Testing ubicación DENTRO (10m del centro)...');
      console.log(`   📍 ${insideLocationData.latitude}, ${insideLocationData.longitude}`);
      
      const insideEvents = await geofenceEngine.processLocation(insideLocationData);
      
      console.log(`📋 Eventos generados: ${insideEvents.length}`);
      if (insideEvents.length > 0) {
        insideEvents.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
          console.log(`      Distance: ${event.distance_from_center}m`);
        });
      }
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
    }
    
    console.log('\n🎯 RESUMEN DE AJUSTE A 15M:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Geofence actualizado: 10m → 15m');
    console.log('✅ Más tolerante para ubicaciones no exactas');
    console.log('✅ Mayor área para detectar entrada/salida');
    console.log('');
    console.log('🚶‍♂️ PARA TUS PRUEBAS:');
    console.log('   🟢 ENTRADA: Camina <15m del centro de tu oficina');
    console.log('   🔴 SALIDA: Camina >15m del centro de tu oficina');
    console.log('   📏 TOLERANCIA: 50% más área que con 10m');
    console.log('   📱 ALERTAS: Más fácil de activar con posición no exacta');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Función para calcular distancia entre dos puntos GPS
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
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

adjustGeofence15m();