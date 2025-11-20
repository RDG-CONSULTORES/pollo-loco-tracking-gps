const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function adjustGeofenceRadius() {
  try {
    console.log('📏 Ajustando radio del geofence de la oficina Roberto...\n');
    
    // 1. Mostrar configuración actual
    const currentResult = await pool.query(`
      SELECT 
        id,
        location_code,
        name,
        latitude,
        longitude,
        geofence_radius,
        active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (currentResult.rows.length === 0) {
      console.log('❌ No se encontró la oficina de Roberto');
      return;
    }
    
    const current = currentResult.rows[0];
    console.log('📍 Configuración actual:');
    console.log(`   Oficina: ${current.name}`);
    console.log(`   Coordenadas: ${current.latitude}, ${current.longitude}`);
    console.log(`   Radio actual: ${current.geofence_radius} metros`);
    console.log(`   Estado: ${current.active ? 'ACTIVA' : 'INACTIVA'}`);
    
    // 2. Cambiar radio a 20 metros
    console.log('\n🔄 Cambiando radio de geofence a 20 metros...');
    
    await pool.query(`
      UPDATE tracking_locations_cache 
      SET 
        geofence_radius = 20,
        synced_at = NOW()
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    // 3. También actualizar en tracking_locations si existe
    try {
      await pool.query(`
        UPDATE tracking_locations 
        SET 
          geofence_radius = 20,
          updated_at = NOW()
        WHERE location_code = 'ROBERTO_OFFICE'
      `);
      console.log('✅ También actualizado en tracking_locations');
    } catch (error) {
      console.log('ℹ️ tracking_locations no necesita actualización');
    }
    
    // 4. Verificar cambio
    const updatedResult = await pool.query(`
      SELECT 
        id,
        location_code,
        name,
        latitude,
        longitude,
        geofence_radius,
        active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    const updated = updatedResult.rows[0];
    console.log('\n✅ Nueva configuración:');
    console.log(`   Oficina: ${updated.name}`);
    console.log(`   Coordenadas: ${updated.latitude}, ${updated.longitude}`);
    console.log(`   Radio NUEVO: ${updated.geofence_radius} metros`);
    console.log(`   Estado: ${updated.active ? 'ACTIVA' : 'INACTIVA'}`);
    
    console.log('\n🎯 Área de detección actualizada:');
    console.log(`   📍 Centro: ${updated.latitude}, ${updated.longitude}`);
    console.log(`   📏 Radio: ${updated.geofence_radius}m (muy preciso para pruebas)`);
    console.log(`   🎯 Diámetro total: ${updated.geofence_radius * 2}m`);
    
    console.log('\n📱 Para testing:');
    console.log('1. Párate FUERA del radio de 20m de tu oficina');
    console.log('2. Abre OwnTracks y verifica que esté enviando ubicación');
    console.log('3. Camina HACIA tu oficina hasta entrar en el radio');
    console.log('4. Deberías recibir alerta de ENTRADA');
    console.log('5. Camina FUERA del radio de 20m');
    console.log('6. Deberías recibir alerta de SALIDA');
    
    console.log('\n⚠️  IMPORTANTE:');
    console.log('- 20m es muy preciso, perfecto para pruebas');
    console.log('- GPS móvil tiene precisión de ~3-10m típicamente');
    console.log('- Si quieres área más amplia, usa 50-100m');
    
  } catch (error) {
    console.error('❌ Error ajustando radio:', error.message);
  } finally {
    await pool.end();
  }
}

adjustGeofenceRadius();