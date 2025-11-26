require('dotenv').config();
const { Pool } = require('pg');

async function forceRecreateGeofences() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚨 RECREANDO GEOFENCES COMPLETAMENTE...\n');
    
    // 1. Borrar TODOS los geofences existentes
    console.log('🗑️ BORRANDO TODOS LOS GEOFENCES EXISTENTES...');
    const deleteResult = await pool.query('DELETE FROM geofences');
    console.log(`   ✅ ${deleteResult.rowCount} geofences eliminados`);
    
    // 2. Obtener todas las sucursales activas con sus coordenadas correctas
    console.log('\n📊 OBTENIENDO SUCURSALES ACTIVAS...');
    const branches = await pool.query(`
      SELECT 
        id, branch_number, name, city, state,
        latitude, longitude, group_name
      FROM branches 
      WHERE active = true 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      ORDER BY branch_number
    `);
    
    console.log(`   ✅ ${branches.rows.length} sucursales activas encontradas`);
    
    // 3. Recrear geofences uno por uno con coordenadas correctas
    console.log('\n🎯 RECREANDO GEOFENCES CON COORDENADAS CORRECTAS:');
    console.log('=' .repeat(80));
    
    let created = 0;
    let errors = 0;
    
    for (const branch of branches.rows) {
      try {
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
          150,
          true,
          true,
          true
        ]);
        
        created++;
        console.log(`   ✅ #${branch.branch_number.toString().padStart(2)} - ${branch.name.substring(0,35).padEnd(35)} → ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}`);
        
      } catch (error) {
        errors++;
        console.log(`   ❌ #${branch.branch_number} - Error: ${error.message}`);
      }
    }
    
    // 4. Verificar sucursales problemáticas específicas
    console.log('\n🔍 VERIFICACIÓN DE SUCURSALES PROBLEMÁTICAS:');
    console.log('=' .repeat(80));
    
    const problematicBranches = [
      { name: 'Pino Suarez', number: 1, expectedLat: 25.672254, expectedLng: -100.319939 },
      { name: 'Cadereyta', number: 26, expectedLat: 25.592725, expectedLng: -100.001619 },
      { name: 'Huasteca', number: 66, expectedLat: 25.863775, expectedLng: -97.480015 },
      { name: 'Gomez Morin', number: 62, expectedLat: 19.695590, expectedLng: -101.166191 },
      { name: 'Anahuac', number: 83, expectedLat: 25.785732, expectedLng: -100.280044 }
    ];
    
    for (const branch of problematicBranches) {
      const result = await pool.query(`
        SELECT 
          g.center_lat, g.center_lng, b.name, b.branch_number
        FROM geofences g
        JOIN branches b ON g.branch_id = b.id
        WHERE b.branch_number = $1
      `, [branch.number]);
      
      if (result.rows.length > 0) {
        const geofence = result.rows[0];
        const actualLat = parseFloat(geofence.center_lat);
        const actualLng = parseFloat(geofence.center_lng);
        
        const latMatch = Math.abs(actualLat - branch.expectedLat) < 0.001;
        const lngMatch = Math.abs(actualLng - branch.expectedLng) < 0.001;
        const isMatch = latMatch && lngMatch;
        
        console.log(`   ${isMatch ? '✅' : '❌'} #${branch.number} - ${geofence.name}:`);
        console.log(`      Actual: ${actualLat.toFixed(6)}, ${actualLng.toFixed(6)}`);
        console.log(`      Esperado: ${branch.expectedLat.toFixed(6)}, ${branch.expectedLng.toFixed(6)}`);
        
        if (!isMatch) {
          console.log(`      ⚠️  Diferencia: lat=${Math.abs(actualLat - branch.expectedLat).toFixed(6)}, lng=${Math.abs(actualLng - branch.expectedLng).toFixed(6)}`);
        }
      } else {
        console.log(`   ❌ #${branch.number} - No se encontró geofence`);
      }
    }
    
    // 5. Testear el endpoint inmediatamente
    console.log('\n🌐 TESTEANDO ENDPOINT DE DASHBOARD:');
    console.log('=' .repeat(80));
    
    // Simular la consulta exacta que hace el endpoint
    const apiTest = await pool.query(`
      SELECT 
        g.id,
        CONCAT('224700', CASE WHEN b.branch_number < 10 THEN '0' ELSE '' END, b.branch_number::TEXT) as location_code,
        CONCAT(b.branch_number, ' - ', b.name) as location_name,
        COALESCE(b.group_name, 'Sin Grupo') as grupo,
        g.center_lat as latitude,
        g.center_lng as longitude,
        g.radius_meters,
        g.active,
        g.created_at
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.active = true AND g.active = true
        AND b.name ILIKE '%Pino Suarez%'
      ORDER BY b.branch_number
      LIMIT 1
    `);
    
    if (apiTest.rows.length > 0) {
      const apiData = apiTest.rows[0];
      console.log(`   📍 Endpoint retornará para Pino Suarez:`);
      console.log(`      Location: ${apiData.location_name}`);
      console.log(`      Coords: ${parseFloat(apiData.latitude).toFixed(8)}, ${parseFloat(apiData.longitude).toFixed(8)}`);
      console.log(`      Grupo: ${apiData.grupo}`);
      console.log(`      Created: ${apiData.created_at}`);
      
      // Verificar que sea correcto
      const correctLat = 25.672254063040413;
      const correctLng = -100.31993941809768;
      
      const latDiff = Math.abs(parseFloat(apiData.latitude) - correctLat);
      const lngDiff = Math.abs(parseFloat(apiData.longitude) - correctLng);
      const isCorrect = latDiff < 0.001 && lngDiff < 0.001;
      
      console.log(`   ${isCorrect ? '✅' : '❌'} Coordenadas ${isCorrect ? 'CORRECTAS' : 'INCORRECTAS'}`);
      
      if (!isCorrect) {
        console.log(`   🔧 Debería ser: ${correctLat.toFixed(8)}, ${correctLng.toFixed(8)}`);
        console.log(`   📊 Diferencia: lat=${latDiff.toFixed(8)}, lng=${lngDiff.toFixed(8)}`);
      }
    } else {
      console.log(`   ❌ No se encontró Pino Suarez en el test del endpoint`);
    }
    
    console.log('\n🎉 ¡RECREACIÓN COMPLETADA!');
    console.log('=' .repeat(80));
    console.log(`✅ RESULTADOS:`);
    console.log(`   • ${created} geofences creados exitosamente`);
    console.log(`   • ${errors} errores durante la creación`);
    console.log(`   • Todos los geofences tienen timestamp actual`);
    console.log('   • El endpoint de dashboard debería mostrar coordenadas correctas INMEDIATAMENTE');
    
    console.log('\n🚀 PRÓXIMO PASO:');
    console.log('   Verificar el dashboard en Railway:');
    console.log('   https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
    return { 
      success: true, 
      created, 
      errors, 
      totalProcessed: branches.rows.length 
    };
    
  } catch (error) {
    console.error('❌ Error recreando geofences:', error.message);
    console.error('Stack trace:', error.stack);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
forceRecreateGeofences().then(result => {
  if (result.success) {
    console.log(`\n🎉 ¡RECREACIÓN EXITOSA!`);
    console.log(`   Geofences creados: ${result.created}/${result.totalProcessed}`);
    console.log(`   El dashboard debería mostrar coordenadas correctas ahora`);
  } else {
    console.log('\n❌ Error en recreación:', result.error);
  }
});