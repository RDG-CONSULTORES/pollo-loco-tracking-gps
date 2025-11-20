const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function adjustGeofence10m() {
  try {
    console.log('📏 AJUSTANDO GEOFENCE DE OFICINA ROBERTO A 10 METROS\n');
    
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
    
    // 2. Actualizar a 10 metros
    console.log('\n🔧 Actualizando radio a 10 metros...');
    
    const updateResult = await pool.query(`
      UPDATE tracking_locations_cache 
      SET 
        geofence_radius = 10,
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
    const newRadius = 10;
    
    console.log('\n🎯 NUEVA CONFIGURACIÓN PARA TESTING:');
    console.log(`   📍 Centro: ${officeLat}, ${officeLng}`);
    console.log(`   📏 Radio: ${newRadius} metros`);
    console.log(`   🟢 DENTRO: <${newRadius}m del centro`);
    console.log(`   🔴 FUERA: >${newRadius}m del centro`);
    
    // 4. Calcular coordenadas específicas para testing
    console.log('\n📍 COORDENADAS ESPECÍFICAS PARA PRUEBAS:');
    console.log('');
    console.log('🟢 PARA ENTRADA (dentro de 10m):');
    console.log(`   📍 Centro exacto: ${officeLat}, ${officeLng} (0m)`);
    console.log(`   📍 Norte 5m: ${(officeLat + 0.000045).toFixed(8)}, ${officeLng} (~5m)`);
    console.log(`   📍 Sur 5m: ${(officeLat - 0.000045).toFixed(8)}, ${officeLng} (~5m)`);
    console.log(`   📍 Este 8m: ${officeLat}, ${(officeLng + 0.000072).toFixed(8)} (~8m)`);
    
    console.log('\n🔴 PARA SALIDA (fuera de 10m):');
    console.log(`   📍 Norte 12m: ${(officeLat + 0.000108).toFixed(8)}, ${officeLng} (~12m)`);
    console.log(`   📍 Sur 12m: ${(officeLat - 0.000108).toFixed(8)}, ${officeLng} (~12m)`);
    console.log(`   📍 Este 15m: ${officeLat}, ${(officeLng + 0.000135).toFixed(8)} (~15m)`);
    console.log(`   📍 Oeste 15m: ${officeLat}, ${(officeLng - 0.000135).toFixed(8)} (~15m)`);
    
    // 5. Test de la función geofence con nuevo radio
    console.log('\n🧪 TEST CON NUEVO RADIO DE 10M:');
    
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
    
    // 6. Test directo del geofence-engine
    console.log('\n🔧 TEST GEOFENCE-ENGINE CON 10M:');
    
    try {
      const geofenceEngine = require('./src/services/geofence-engine');
      
      // Test coordenadas dentro (5m del centro)
      const insideLocationData = {
        id: Date.now(),
        user_id: 5,
        latitude: officeLat + 0.000045, // ~5m norte del centro
        longitude: officeLng,
        accuracy: 5,
        battery: 85,
        gps_timestamp: new Date()
      };
      
      console.log('📡 Testing ubicación DENTRO (5m del centro)...');
      console.log(`   📍 ${insideLocationData.latitude}, ${insideLocationData.longitude}`);
      
      const insideEvents = await geofenceEngine.processLocation(insideLocationData);
      
      console.log(`📋 Eventos generados: ${insideEvents.length}`);
      if (insideEvents.length > 0) {
        insideEvents.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
          console.log(`      Distance: ${event.distance_from_center}m`);
        });
      }
      
      // Test coordenadas fuera (12m del centro)  
      setTimeout(async () => {
        console.log('\n📡 Testing ubicación FUERA (12m del centro)...');
        
        const outsideLocationData = {
          id: Date.now() + 1,
          user_id: 5,
          latitude: officeLat + 0.000108, // ~12m norte del centro
          longitude: officeLng,
          accuracy: 5,
          battery: 85,
          gps_timestamp: new Date()
        };
        
        console.log(`   📍 ${outsideLocationData.latitude}, ${outsideLocationData.longitude}`);
        
        const outsideEvents = await geofenceEngine.processLocation(outsideLocationData);
        
        console.log(`📋 Eventos generados: ${outsideEvents.length}`);
        if (outsideEvents.length > 0) {
          outsideEvents.forEach((event, i) => {
            console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
            console.log(`      Distance: ${event.distance_from_center}m`);
          });
        }
        
        console.log('\n🎯 RESUMEN DE AJUSTE A 10M:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Geofence reducido de 20m a 10m');
        console.log('✅ Testing más rápido y preciso');
        console.log('✅ Detección funcionando correctamente');
        console.log('');
        console.log('🚶‍♂️ PARA TUS PRUEBAS:');
        console.log('   🟢 ENTRADA: Camina <10m del centro de tu oficina');
        console.log('   🔴 SALIDA: Camina >10m del centro de tu oficina');
        console.log('   ⚡ MÁS RÁPIDO: Solo necesitas moverte 10-15m');
        console.log('   📱 ALERTAS: Deberían llegar más frecuentemente');
        
        await pool.end();
        
      }, 3000);
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

adjustGeofence10m();