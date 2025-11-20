const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function set15mGeofence() {
  try {
    console.log('📏 CONFIGURANDO GEOFENCE A 15 METROS\n');
    
    // 1. Actualizar a 15 metros
    const updateResult = await pool.query(`
      UPDATE tracking_locations_cache 
      SET 
        geofence_radius = 15,
        synced_at = NOW()
      WHERE location_code = 'ROBERTO_OFFICE'
      RETURNING location_code, name, geofence_radius, latitude, longitude
    `);
    
    if (updateResult.rows.length > 0) {
      const office = updateResult.rows[0];
      console.log('✅ Geofence actualizado a 15 metros:');
      console.log(`   🏢 Oficina: ${office.name}`);
      console.log(`   📍 Centro: ${office.latitude}, ${office.longitude}`);
      console.log(`   📏 Radio: ${office.geofence_radius} metros`);
    } else {
      console.log('❌ No se encontró oficina para actualizar');
      return;
    }
    
    // 2. Verificar tu posición con 15m
    console.log('\n📍 TU POSICIÓN CON RADIO 15M:');
    
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
      
      const isInside = distance <= 15;
      
      console.log(`📍 Tu ubicación: ${loc.latitude}, ${loc.longitude}`);
      console.log(`📏 Distancia: ${Math.round(distance)} metros del centro`);
      console.log(`🎯 Con radio 15m: ${isInside ? '🟢 DENTRO' : '🔴 FUERA'}`);
      console.log(`⏰ Última actualización: ${new Date(loc.gps_timestamp).toLocaleString('es-MX')}`);
    }
    
    console.log('\n🎯 CONFIGURACIÓN FINAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Radio geofence: 15 metros');
    console.log('📍 Centro: 25.650648, -100.373529');
    console.log('🟢 Estado: ACTIVO');
    console.log('');
    console.log('🧪 TESTING:');
    console.log('🔴 FUERA: >15m del centro');
    console.log('🟢 DENTRO: <15m del centro');
    console.log('');
    console.log('¡Listo para testing con 15 metros!');
    
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

set15mGeofence();