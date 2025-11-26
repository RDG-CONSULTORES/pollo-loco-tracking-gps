require('dotenv').config();
const { Pool } = require('pg');

async function syncGeofencesWithOperationalGroups() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 SINCRONIZANDO GEOFENCES CON GRUPOS OPERATIVOS CORRECTOS...\n');
    
    // 1. Obtener todas las coordenadas con sus grupos operativos
    console.log('📊 Paso 1: Obteniendo todas las sucursales con grupos operativos...');
    const branches = await pool.query(`
      SELECT 
        id, branch_number, name, city, state, municipality,
        latitude, longitude, zenput_id,
        group_id, group_name, region,
        director_id, director_name
      FROM branches 
      WHERE active = true AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY branch_number
    `);
    
    console.log(`   ✅ ${branches.rows.length} sucursales encontradas con coordenadas`);
    
    // 2. Verificar estado actual de geofences
    console.log('\n📊 Paso 2: Limpiando tabla geofences...');
    const currentGeofences = await pool.query(`SELECT COUNT(*) as count FROM geofences`);
    console.log(`   📍 ${currentGeofences.rows[0].count} geofences existentes`);
    
    await pool.query(`DELETE FROM geofences`);
    console.log('   ✅ Tabla geofences limpiada');
    
    // 3. Crear geofences con grupos operativos correctos
    console.log('\n📍 Paso 3: Creando geofences con grupos operativos...');
    
    let insertedCount = 0;
    for (const branch of branches.rows) {
      await pool.query(`
        INSERT INTO geofences (
          name, branch_id, description,
          center_lat, center_lng, radius_meters, 
          active, alert_on_enter, alert_on_exit, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        branch.name,
        branch.id,
        `Geofence para ${branch.name} - Grupo: ${branch.group_name} - ${branch.city}, ${branch.state}`,
        branch.latitude,
        branch.longitude,
        150, // 150 metros de radio
        true,
        true, // alerta al entrar
        true  // alerta al salir
      ]);
      
      insertedCount++;
      console.log(`   ✅ #${branch.branch_number} - ${branch.name} → ${branch.group_name}`);
    }
    
    // 4. Verificar sincronización
    console.log(`\n📊 Paso 4: Verificando sincronización...`);
    const finalGeofences = await pool.query(`SELECT COUNT(*) as count FROM geofences WHERE active = true`);
    console.log(`   📍 ${finalGeofences.rows[0].count} geofences creados`);
    console.log(`   📊 ${insertedCount} sucursales sincronizadas`);
    
    console.log('\n🎉 ¡SINCRONIZACIÓN COMPLETADA EXITOSAMENTE!');
    
    return { success: true, synced: insertedCount };
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  const result = await syncGeofencesWithOperationalGroups();
  
  if (result.success) {
    console.log(`\n🚀 SINCRONIZACIÓN EXITOSA - ${result.synced} geofences actualizados`);
  } else {
    console.log('\n❌ Error en sincronización:', result.error);
  }
  
  process.exit(0);
}

main();