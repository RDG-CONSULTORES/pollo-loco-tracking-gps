const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupRobertoOfficeFinal() {
  try {
    console.log('🏢 CONFIGURANDO OFICINA ROBERTO - SETUP FINAL\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Verificar si ya existe
    console.log('📋 PASO 1: VERIFICANDO CONFIGURACIÓN ACTUAL');
    console.log('');
    
    const existing = await pool.query(`
      SELECT location_code, name, latitude, longitude, geofence_radius, active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (existing.rows.length > 0) {
      const current = existing.rows[0];
      console.log('✅ Oficina existente encontrada:');
      console.log(`   🏢 Nombre: ${current.name}`);
      console.log(`   📍 Centro: ${current.latitude}, ${current.longitude}`);
      console.log(`   📏 Radio: ${current.geofence_radius} metros`);
      console.log(`   🟢 Estado: ${current.active ? 'Activo' : 'Inactivo'}`);
      
      // Actualizar a 20 metros
      console.log('\\n🔧 ACTUALIZANDO RADIO A 20 METROS...');
      
      const updateResult = await pool.query(`
        UPDATE tracking_locations_cache 
        SET 
          geofence_radius = 20,
          active = true,
          synced_at = NOW()
        WHERE location_code = 'ROBERTO_OFFICE'
        RETURNING location_code, name, geofence_radius
      `);
      
      console.log('✅ Oficina actualizada exitosamente');
      console.log(`   📏 Nuevo radio: ${updateResult.rows[0].geofence_radius} metros`);
      
    } else {
      console.log('❌ Oficina no encontrada, creando nueva...');
      
      // 2. Crear oficina nueva
      console.log('\\n🏗️ PASO 2: CREANDO OFICINA ROBERTO');
      console.log('');
      
      const insertResult = await pool.query(`
        INSERT INTO tracking_locations_cache (
          location_code, name, address, 
          latitude, longitude, 
          geofence_radius, geofence_enabled, active,
          group_name, director_name, synced_at
        )
        VALUES (
          'ROBERTO_OFFICE', 
          'Oficina Roberto - Testing',
          'Oficina Roberto - Testing (25.650648, -100.373529)',
          25.650648, 
          -100.373529, 
          20, 
          true, 
          true,
          'TESTING',
          'Roberto Davila',
          NOW()
        )
        ON CONFLICT (location_code) DO UPDATE SET
          geofence_radius = 20,
          active = true,
          synced_at = NOW()
        RETURNING id, location_code, name, geofence_radius
      `);
      
      console.log('✅ Oficina creada/actualizada:');
      console.log(`   🆔 ID: ${insertResult.rows[0].id}`);
      console.log(`   📍 Código: ${insertResult.rows[0].location_code}`);
      console.log(`   🏢 Nombre: ${insertResult.rows[0].name}`);
      console.log(`   📏 Radio: ${insertResult.rows[0].geofence_radius} metros`);
    }
    
    // 3. Verificar configuración final
    console.log('\\n📊 PASO 3: VERIFICACIÓN FINAL');
    console.log('');
    
    const finalConfig = await pool.query(`
      SELECT location_code, name, latitude, longitude, geofence_radius, active, synced_at
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (finalConfig.rows.length > 0) {
      const config = finalConfig.rows[0];
      
      console.log('✅ CONFIGURACIÓN FINAL CONFIRMADA:');
      console.log(`   🏢 Nombre: ${config.name}`);
      console.log(`   📍 Latitud: ${config.latitude}`);
      console.log(`   📍 Longitud: ${config.longitude}`);
      console.log(`   📏 Radio geofence: ${config.geofence_radius} metros`);
      console.log(`   🟢 Estado: ${config.active ? 'ACTIVO' : 'INACTIVO'}`);
      console.log(`   ⏰ Última sync: ${new Date(config.synced_at).toLocaleString('es-MX')}`);
    }
    
    // 4. Test de la función geofence
    console.log('\\n🧪 PASO 4: TEST FUNCIÓN GEOFENCE');
    console.log('');
    
    const testLat = 25.650648;
    const testLng = -100.373529;
    
    try {
      const testResult = await pool.query(`
        SELECT * FROM get_nearby_geofences($1, $2, $3)
        WHERE location_code = 'ROBERTO_OFFICE'
      `, [testLat, testLng, 50]);
      
      if (testResult.rows.length > 0) {
        const geofence = testResult.rows[0];
        console.log('✅ Función PostgreSQL verificada:');
        console.log(`   🏢 Store: ${geofence.store_name}`);
        console.log(`   📏 Radio detectado: ${geofence.geofence_radius}m`);
        console.log(`   📍 Distancia al centro: ${Math.round(geofence.distance_meters)}m`);
        console.log(`   🎯 Está dentro: ${geofence.is_inside ? '✅ SÍ' : '❌ NO'}`);
      } else {
        console.log('❌ Función PostgreSQL no detecta geofence');
      }
      
    } catch (testError) {
      console.log('❌ Error en test PostgreSQL:', testError.message);
    }
    
    // 5. Verificar tu ubicación actual
    console.log('\\n📍 PASO 5: TU UBICACIÓN ACTUAL');
    console.log('');
    
    const yourLocation = await pool.query(`
      SELECT latitude, longitude, gps_timestamp, accuracy, battery
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
        25.650648,
        -100.373529
      );
      
      const isInside = distance <= 20;
      const timestamp = new Date(loc.gps_timestamp).toLocaleString('es-MX');
      
      console.log(`📍 Tu ubicación: ${loc.latitude}, ${loc.longitude}`);
      console.log(`⏰ Timestamp: ${timestamp}`);
      console.log(`📏 Distancia a oficina: ${Math.round(distance)} metros`);
      console.log(`🎯 Con radio 20m: ${isInside ? '🟢 DENTRO' : '🔴 FUERA'}`);
      console.log(`🔋 Batería: ${loc.battery}% | Precisión: ${loc.accuracy}m`);
      
      if (!isInside) {
        const needToWalk = Math.round(distance - 20);
        console.log(`🚶‍♂️ Necesitas acercarte ${needToWalk}m más para entrar`);
      }
    } else {
      console.log('❌ No hay ubicaciones GPS recientes');
    }
    
    // 6. Instrucciones de testing
    console.log('\\n🎯 INSTRUCCIONES DE TESTING CON 20 METROS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ CONFIGURACIÓN APLICADA:');
    console.log('   📍 Centro: 25.650648, -100.373529');
    console.log('   📏 Radio: 20 metros (más cómodo para testing)');
    console.log('   🟢 Estado: ACTIVO');
    console.log('');
    console.log('🧪 TESTING:');
    console.log('1. 🚶‍♂️ SAL de tu oficina (camina >20m del centro)');
    console.log('2. ⏰ ESPERA 1-2 minutos');
    console.log('3. 📱 VERIFICA alerta de SALIDA en Telegram');
    console.log('4. 🚶‍♂️ REGRESA a tu oficina (camina <20m del centro)');
    console.log('5. ⏰ ESPERA 1-2 minutos');
    console.log('6. 📱 VERIFICA alerta de ENTRADA en Telegram');
    console.log('');
    console.log('🎯 UBICACIONES DE REFERENCIA:');
    console.log(`🟢 DENTRO: <20m del centro (25.650648, -100.373529)`);
    console.log(`🔴 FUERA: >20m del centro`);
    console.log('');
    console.log('🎉 ¡LISTO PARA TESTING CON 20 METROS!');
    
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

setupRobertoOfficeFinal();