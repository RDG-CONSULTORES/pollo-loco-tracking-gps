require('dotenv').config();
const { Pool } = require('pg');

async function analyzeCerradasAnahuac() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 ANÁLISIS DETALLADO: Cerradas de Anahuac\n');
    
    // 1. Verificar en tracking_locations_cache
    console.log('📊 VERIFICANDO EN tracking_locations_cache:');
    
    const cacheResult = await pool.query(`
      SELECT 
        id, location_code, name, group_name, 
        latitude, longitude, active, synced_at,
        geofence_enabled
      FROM tracking_locations_cache 
      WHERE name ILIKE '%Cerradas%' OR name ILIKE '%Anahuac%'
      ORDER BY name
    `);
    
    console.log(`   📊 Registros encontrados: ${cacheResult.rows.length}`);
    
    if (cacheResult.rows.length > 0) {
      cacheResult.rows.forEach(row => {
        console.log(`   ✅ ID: ${row.id}`);
        console.log(`      Nombre: "${row.name}"`);
        console.log(`      Código: ${row.location_code}`);
        console.log(`      Grupo: ${row.group_name}`);
        console.log(`      Coords: ${parseFloat(row.latitude).toFixed(6)}, ${parseFloat(row.longitude).toFixed(6)}`);
        console.log(`      Activo: ${row.active}`);
        console.log(`      Geofence habilitado: ${row.geofence_enabled}`);
        console.log(`      Sincronizado: ${row.synced_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No se encontraron registros con "Cerradas" o "Anahuac"');
    }
    
    // 2. Verificar ordenamiento - sucursales 80-85
    console.log('📋 VERIFICANDO ORDENAMIENTO (Sucursales 80-85):');
    
    const orderingResult = await pool.query(`
      SELECT id, location_code, name, group_name, active, synced_at
      FROM tracking_locations_cache 
      WHERE name ~ '^(8[0-5]|83) -'
      ORDER BY name
    `);
    
    console.log(`   📊 Sucursales 80-85 encontradas: ${orderingResult.rows.length}`);
    
    orderingResult.rows.forEach(row => {
      console.log(`   ${row.name} - Activo: ${row.active} - ID: ${row.id}`);
    });
    
    // 3. Verificar duplicados
    console.log('\n🔍 VERIFICANDO DUPLICADOS DE "ANAHUAC":');
    
    const duplicatesResult = await pool.query(`
      SELECT id, location_code, name, group_name, active
      FROM tracking_locations_cache 
      WHERE name ILIKE '%Anahuac%'
      ORDER BY name
    `);
    
    console.log(`   📊 Registros con "Anahuac": ${duplicatesResult.rows.length}`);
    
    duplicatesResult.rows.forEach(row => {
      console.log(`   ${row.active ? '✅' : '❌'} "${row.name}" - ${row.group_name} - ID: ${row.id}`);
    });
    
    // 4. Verificar geofences tabla
    console.log('\n🗺️ VERIFICANDO EN GEOFENCES:');
    
    const geofenceResult = await pool.query(`
      SELECT g.id, g.name, g.center_lat, g.center_lng, g.active, b.branch_number
      FROM geofences g
      LEFT JOIN branches b ON g.branch_id = b.id
      WHERE g.name ILIKE '%Cerradas%' OR g.name ILIKE '%Anahuac%'
      ORDER BY g.name
    `);
    
    console.log(`   📊 Geofences encontrados: ${geofenceResult.rows.length}`);
    
    geofenceResult.rows.forEach(row => {
      console.log(`   ${row.active ? '✅' : '❌'} "${row.name}" - Branch #${row.branch_number || 'N/A'}`);
      console.log(`      Coords: ${row.center_lat ? parseFloat(row.center_lat).toFixed(6) + ', ' + parseFloat(row.center_lng).toFixed(6) : 'Sin coordenadas'}`);
    });
    
    // 5. Verificar branches tabla
    console.log('\n🏢 VERIFICANDO EN BRANCHES:');
    
    const branchResult = await pool.query(`
      SELECT id, branch_number, name, latitude, longitude, active
      FROM branches 
      WHERE name ILIKE '%Cerradas%' OR name ILIKE '%Anahuac%'
      ORDER BY branch_number
    `);
    
    console.log(`   📊 Branches encontrados: ${branchResult.rows.length}`);
    
    branchResult.rows.forEach(row => {
      console.log(`   ${row.active ? '✅' : '❌'} #${row.branch_number} "${row.name}"`);
      console.log(`      Coords: ${row.latitude ? parseFloat(row.latitude).toFixed(6) + ', ' + parseFloat(row.longitude).toFixed(6) : 'Sin coordenadas'}`);
    });
    
    // 6. Verificar el total actual
    console.log('\n📊 CONTEO TOTAL:');
    
    const totalActive = await pool.query('SELECT COUNT(*) FROM tracking_locations_cache WHERE active = true');
    const totalWithNumber = await pool.query(`SELECT COUNT(*) FROM tracking_locations_cache WHERE name ~ '^[0-9]+ -' AND active = true`);
    
    console.log(`   Total activos: ${totalActive.rows[0].count}`);
    console.log(`   Con número (formato correcto): ${totalWithNumber.rows[0].count}`);
    
    console.log('\n🎯 DIAGNÓSTICO:');
    
    if (cacheResult.rows.length === 0) {
      console.log('❌ PROBLEMA: Cerradas de Anahuac NO existe en tracking_locations_cache');
      console.log('   Solución: Recrear la entrada');
    } else {
      const cerradas = cacheResult.rows.find(r => r.name.includes('Cerradas'));
      if (!cerradas) {
        console.log('❌ PROBLEMA: No se encuentra "Cerradas" específicamente');
      } else if (!cerradas.active) {
        console.log('❌ PROBLEMA: Cerradas de Anahuac está marcado como inactivo');
        console.log('   Solución: Activar el registro');
      } else {
        console.log('✅ Cerradas de Anahuac existe y está activo');
        console.log('   Problema posible: Ordenamiento en el frontend o cache del navegador');
      }
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en análisis:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar análisis
analyzeCerradasAnahuac().then(result => {
  if (result.success) {
    console.log('\n🔍 ANÁLISIS COMPLETADO');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});