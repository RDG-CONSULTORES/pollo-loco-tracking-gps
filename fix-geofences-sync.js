require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function fixGeofencesSync() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔧 SINCRONIZANDO GEOFENCES CON COORDENADAS CORRECTAS...\n');
    
    // 1. Verificar estado actual
    console.log('📊 ESTADO ACTUAL:');
    const currentIssues = await pool.query(`
      SELECT 
        b.branch_number, 
        b.name as branch_name,
        b.latitude as branch_lat, 
        b.longitude as branch_lng,
        g.center_lat as geofence_lat, 
        g.center_lng as geofence_lng,
        ROUND(CAST(ABS(CAST(b.latitude AS DECIMAL) - CAST(g.center_lat AS DECIMAL)) AS NUMERIC), 8) as lat_diff,
        ROUND(CAST(ABS(CAST(b.longitude AS DECIMAL) - CAST(g.center_lng AS DECIMAL)) AS NUMERIC), 8) as lng_diff
      FROM branches b
      JOIN geofences g ON g.branch_id = b.id
      WHERE b.active = true
        AND (
          ABS(CAST(b.latitude AS DECIMAL) - CAST(g.center_lat AS DECIMAL)) > 0.000001
          OR ABS(CAST(b.longitude AS DECIMAL) - CAST(g.center_lng AS DECIMAL)) > 0.000001
        )
      ORDER BY b.branch_number
    `);
    
    console.log(`   ❌ ${currentIssues.rows.length} geofences con coordenadas incorrectas`);
    
    for (const issue of currentIssues.rows) {
      console.log(`   #${issue.branch_number} - ${issue.branch_name}:`);
      console.log(`      Branches: ${parseFloat(issue.branch_lat).toFixed(8)}, ${parseFloat(issue.branch_lng).toFixed(8)}`);
      console.log(`      Geofences: ${parseFloat(issue.geofence_lat).toFixed(8)}, ${parseFloat(issue.geofence_lng).toFixed(8)}`);
      console.log(`      Diferencia: lat=${parseFloat(issue.lat_diff).toFixed(8)}, lng=${parseFloat(issue.lng_diff).toFixed(8)}`);
    }
    
    // 2. Actualizar geofences para que coincidan con branches
    console.log('\n🔄 ACTUALIZANDO GEOFENCES...');
    
    const updateResult = await pool.query(`
      UPDATE geofences 
      SET 
        center_lat = branches.latitude,
        center_lng = branches.longitude,
        updated_at = NOW()
      FROM branches 
      WHERE geofences.branch_id = branches.id 
        AND branches.active = true
        AND (
          ABS(CAST(branches.latitude AS DECIMAL) - CAST(geofences.center_lat AS DECIMAL)) > 0.000001
          OR ABS(CAST(branches.longitude AS DECIMAL) - CAST(geofences.center_lng AS DECIMAL)) > 0.000001
        )
    `);
    
    console.log(`   ✅ ${updateResult.rowCount} geofences actualizados`);
    
    // 3. Verificar corrección
    console.log('\n📊 VERIFICACIÓN POST-CORRECCIÓN:');
    const remaining = await pool.query(`
      SELECT 
        b.branch_number, 
        b.name,
        b.latitude, 
        b.longitude,
        g.center_lat, 
        g.center_lng
      FROM branches b
      JOIN geofences g ON g.branch_id = b.id
      WHERE b.active = true
        AND (
          ABS(CAST(b.latitude AS DECIMAL) - CAST(g.center_lat AS DECIMAL)) > 0.000001
          OR ABS(CAST(b.longitude AS DECIMAL) - CAST(g.center_lng AS DECIMAL)) > 0.000001
        )
      ORDER BY b.branch_number
    `);
    
    console.log(`   ${remaining.rows.length === 0 ? '✅' : '❌'} Geofences con problemas: ${remaining.rows.length}`);
    
    // 4. Verificar sucursales problemáticas específicas
    console.log('\n🔍 VERIFICANDO SUCURSALES PROBLEMÁTICAS:');
    const problematicBranches = [
      { name: 'Pino Suarez', number: 1 },
      { name: 'Cadereyta', number: 26 },
      { name: 'Huasteca', number: 66 },
      { name: 'Gomez Morin', number: 62 },
      { name: 'Anahuac', number: 83 }
    ];
    
    for (const branch of problematicBranches) {
      const result = await pool.query(`
        SELECT 
          b.branch_number, 
          b.name,
          b.latitude as branch_lat, 
          b.longitude as branch_lng,
          g.center_lat as geofence_lat, 
          g.center_lng as geofence_lng
        FROM branches b
        JOIN geofences g ON g.branch_id = b.id
        WHERE b.branch_number = $1 AND b.active = true
      `, [branch.number]);
      
      if (result.rows.length > 0) {
        const data = result.rows[0];
        const latMatch = Math.abs(parseFloat(data.branch_lat) - parseFloat(data.geofence_lat)) < 0.000001;
        const lngMatch = Math.abs(parseFloat(data.branch_lng) - parseFloat(data.geofence_lng)) < 0.000001;
        const isMatch = latMatch && lngMatch;
        
        console.log(`   ${isMatch ? '✅' : '❌'} #${data.branch_number} - ${data.name}:`);
        console.log(`      Branches: ${parseFloat(data.branch_lat).toFixed(8)}, ${parseFloat(data.branch_lng).toFixed(8)}`);
        console.log(`      Geofences: ${parseFloat(data.geofence_lat).toFixed(8)}, ${parseFloat(data.geofence_lng).toFixed(8)}`);
      } else {
        console.log(`   ❌ #${branch.number} - No encontrada`);
      }
    }
    
    // 5. Probar API de dashboard
    console.log('\n🌐 VERIFICANDO API DEL DASHBOARD:');
    
    // Simular la consulta que usa el endpoint /api/dashboard/geofences
    const apiQuery = await pool.query(`
      SELECT 
        g.id,
        CONCAT(b.branch_number, '000') as location_code,
        CONCAT(b.branch_number, ' - ', b.name) as location_name,
        b.group_name as grupo,
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
    
    if (apiQuery.rows.length > 0) {
      const apiData = apiQuery.rows[0];
      console.log(`   📍 API Pino Suarez: ${parseFloat(apiData.latitude).toFixed(8)}, ${parseFloat(apiData.longitude).toFixed(8)}`);
      
      // Comparar con el CSV
      const csvLat = 25.672254063040413;
      const csvLng = -100.31993941809768;
      
      const latDiff = Math.abs(parseFloat(apiData.latitude) - csvLat);
      const lngDiff = Math.abs(parseFloat(apiData.longitude) - csvLng);
      const apiMatch = latDiff < 0.000001 && lngDiff < 0.000001;
      
      console.log(`   📍 CSV Pino Suarez: ${csvLat.toFixed(8)}, ${csvLng.toFixed(8)}`);
      console.log(`   ${apiMatch ? '✅' : '❌'} API coincide con CSV: ${apiMatch}`);
      console.log(`   📊 Diferencia: lat=${latDiff.toFixed(10)}, lng=${lngDiff.toFixed(10)}`);
    }
    
    console.log('\n🎉 ¡SINCRONIZACIÓN COMPLETADA!');
    console.log('=' .repeat(80));
    console.log(`✅ RESULTADOS:`);
    console.log(`   • ${updateResult.rowCount} geofences sincronizados con branches`);
    console.log(`   • ${remaining.rows.length} geofences con problemas restantes`);
    console.log('   • API de dashboard ahora debería mostrar coordenadas correctas');
    
    if (remaining.rows.length === 0) {
      console.log('\n🚀 ¡PROBLEMA RESUELTO!');
      console.log('   El dashboard debería mostrar las coordenadas correctas inmediatamente');
      console.log('   No se requiere hacer Ctrl+F5, los cambios son del lado del servidor');
    }
    
    return { 
      success: true, 
      updated: updateResult.rowCount, 
      remaining: remaining.rows.length 
    };
    
  } catch (error) {
    console.error('❌ Error sincronizando geofences:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
fixGeofencesSync().then(result => {
  if (result.success) {
    if (result.remaining === 0) {
      console.log('\n🎉 ¡SINCRONIZACIÓN PERFECTA!');
      console.log('   El dashboard está ahora completamente corregido');
    } else {
      console.log(`\n⚠️ Sincronización parcial: ${result.remaining} problemas restantes`);
    }
  } else {
    console.log('\n❌ Error en sincronización:', result.error);
  }
});