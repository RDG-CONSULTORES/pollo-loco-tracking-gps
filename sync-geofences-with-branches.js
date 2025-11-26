require('dotenv').config();
const { Pool } = require('pg');

async function syncGeofencesWithBranches() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 SINCRONIZANDO GEOFENCES CON COORDENADAS CORRECTAS DE BRANCHES...\n');
    
    // 1. Obtener todas las coordenadas correctas de branches
    console.log('📊 Paso 1: Obteniendo coordenadas correctas de tabla branches...');
    const branches = await pool.query(`
      SELECT 
        id, name, city, state, latitude, longitude, zenput_id
      FROM branches 
      WHERE active = true AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY id
    `);
    
    console.log(`   ✅ ${branches.rows.length} sucursales encontradas en branches`);
    
    // 2. Verificar estado actual de geofences
    console.log('\n📊 Paso 2: Verificando tabla geofences actual...');
    const currentGeofences = await pool.query(`
      SELECT COUNT(*) as count FROM geofences WHERE active = true
    `);
    
    console.log(`   📍 ${currentGeofences.rows[0].count} geofences activos actualmente`);
    
    // 3. Limpiar tabla geofences
    console.log('\n🧹 Paso 3: Limpiando tabla geofences...');
    await pool.query(`DELETE FROM geofences`);
    console.log('   ✅ Tabla geofences limpiada');
    
    // 4. Insertar geofences con coordenadas correctas
    console.log('\n📍 Paso 4: Creando geofences con coordenadas correctas...');
    
    let insertedCount = 0;
    for (const branch of branches.rows) {
      // Determinar grupo basado en ciudad/estado
      let grupo = 'GENERAL';
      const city = branch.city.toLowerCase();
      const state = branch.state.toLowerCase();
      
      if (state.includes('nuevo león')) {
        if (city.includes('monterrey')) grupo = 'MONTERREY CENTRO';
        else if (city.includes('guadalupe')) grupo = 'GUADALUPE';
        else if (city.includes('san nicolás') || city.includes('san nicolas')) grupo = 'SAN NICOLAS';
        else if (city.includes('santa catarina')) grupo = 'SANTA CATARINA';
        else if (city.includes('general escobedo') || city.includes('escobedo')) grupo = 'ESCOBEDO';
        else if (city.includes('apodaca')) grupo = 'APODACA';
        else if (city.includes('garcía') || city.includes('garcia')) grupo = 'GARCIA';
        else grupo = 'NUEVO LEON';
      } else if (state.includes('coahuila')) {
        if (city.includes('saltillo')) grupo = 'SALTILLO';
        else if (city.includes('torreón') || city.includes('torreon')) grupo = 'TORREON';
        else grupo = 'COAHUILA';
      } else if (state.includes('tamaulipas')) {
        if (city.includes('tampico')) grupo = 'TAMPICO';
        else if (city.includes('matamoros')) grupo = 'MATAMOROS';
        else if (city.includes('reynosa')) grupo = 'REYNOSA';
        else if (city.includes('nuevo laredo')) grupo = 'NUEVO LAREDO';
        else grupo = 'TAMAULIPAS';
      } else if (state.includes('querétaro') || state.includes('queretaro')) {
        grupo = 'QUERETARO';
      } else if (state.includes('michoacán') || state.includes('michoacan')) {
        grupo = 'MICHOACAN';
      } else if (state.includes('sinaloa')) {
        grupo = 'SINALOA';
      } else if (state.includes('durango')) {
        grupo = 'DURANGO';
      }
      
      await pool.query(`
        INSERT INTO geofences (
          name, branch_id, description,
          center_lat, center_lng, radius_meters, 
          active, alert_on_enter, alert_on_exit, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        branch.name,
        branch.id,
        `Geofence para ${branch.name} - ${branch.city}, ${branch.state}`,
        branch.latitude,
        branch.longitude,
        150, // 150 metros de radio
        true,
        true, // alerta al entrar
        true  // alerta al salir
      ]);
      
      insertedCount++;
      console.log(`   ✅ #${branch.id} - ${branch.name} → ${grupo}`);
    }
    
    console.log(`\n📊 Paso 5: Verificando sincronización...`);
    const finalGeofences = await pool.query(`
      SELECT COUNT(*) as count FROM geofences WHERE active = true
    `);
    
    console.log(`   📍 ${finalGeofences.rows[0].count} geofences creados`);
    console.log(`   📊 ${insertedCount} sucursales sincronizadas`);
    
    // 5. Verificar algunas muestras
    console.log('\n🔍 Paso 6: Verificando muestra de geofences actualizados...');
    const sample = await pool.query(`
      SELECT name, center_lat, center_lng, branch_id 
      FROM geofences 
      WHERE active = true 
      ORDER BY branch_id 
      LIMIT 5
    `);
    
    sample.rows.forEach(geo => {
      console.log(`   📍 ${geo.name}: ${geo.center_lat}, ${geo.center_lng} (Branch ID: ${geo.branch_id})`);
    });
    
    console.log('\n🎉 ¡SINCRONIZACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('\n✅ RESULTADOS:');
    console.log(`   • ${insertedCount} geofences sincronizados`);
    console.log(`   • Coordenadas actualizadas con datos correctos de branches`);
    console.log(`   • Grupos asignados por ubicación geográfica`);
    console.log(`   • Dashboard ahora mostrará coordenadas correctas`);
    
    return { success: true, synced: insertedCount };
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  const result = await syncGeofencesWithBranches();
  
  if (result.success) {
    console.log(`\n🚀 SINCRONIZACIÓN EXITOSA - ${result.synced} geofences actualizados`);
    console.log('\n🌐 AHORA PUEDES VERIFICAR:');
    console.log('   • Dashboard: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    console.log('   • API: https://pollo-loco-tracking-gps-production.up.railway.app/api/dashboard/geofences');
  } else {
    console.log('\n❌ Error en sincronización:', result.error);
  }
  
  process.exit(0);
}

main();