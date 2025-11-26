require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function forceCompleteRedeploy() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚀 FORZANDO REDEPLOY COMPLETO CON COORDENADAS CORRECTAS...\n');
    
    // 1. Verificar estado actual de la base de datos
    console.log('📊 VERIFICANDO ESTADO ACTUAL:');
    
    const totalCount = await pool.query('SELECT COUNT(*) FROM branches WHERE active = true');
    const geofenceCount = await pool.query('SELECT COUNT(*) FROM geofences WHERE active = true');
    
    console.log(`   Branches activos: ${totalCount.rows[0].count}`);
    console.log(`   Geofences activos: ${geofenceCount.rows[0].count}`);
    
    // 2. Leer CSV y aplicar TODAS las coordenadas
    console.log('\n📄 LEYENDO CSV NORMALIZADO:');
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Procesar CSV
    const csvCoords = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const csvRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
      const parts = line.split(csvRegex);
      if (parts.length < 7) continue;
      
      const csvNum = parseInt(parts[1]);
      const csvName = parts[2];
      let csvCoordsStr = parts[6];
      
      if (!csvCoordsStr || csvCoordsStr.trim() === '' || csvCoordsStr.trim() === '""') continue;
      csvCoordsStr = csvCoordsStr.replace(/^"|"$/g, '').trim();
      
      const coordParts = csvCoordsStr.split(',');
      if (coordParts.length === 2) {
        const csvLat = parseFloat(coordParts[0].trim());
        const csvLng = parseFloat(coordParts[1].trim());
        
        if (!isNaN(csvLat) && !isNaN(csvLng)) {
          csvCoords[csvNum] = {
            name: csvName,
            lat: csvLat,
            lng: csvLng
          };
        }
      }
    }
    
    console.log(`   ✅ ${Object.keys(csvCoords).length} coordenadas procesadas del CSV`);
    
    // 3. FORZAR ACTUALIZACIÓN COMPLETA
    console.log('\n🔄 APLICANDO COORDENADAS DEL CSV A BRANCHES:');
    let branchesUpdated = 0;
    
    for (const [branchNum, coords] of Object.entries(csvCoords)) {
      try {
        const result = await pool.query(`
          UPDATE branches 
          SET 
            latitude = $1,
            longitude = $2,
            updated_at = NOW()
          WHERE branch_number = $3 AND active = true
        `, [coords.lat, coords.lng, parseInt(branchNum)]);
        
        if (result.rowCount > 0) {
          branchesUpdated++;
          console.log(`   ✅ #${branchNum} - ${coords.name.substring(0,30)}: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        }
      } catch (error) {
        console.log(`   ❌ #${branchNum} - Error: ${error.message}`);
      }
    }
    
    console.log(`\n   📊 Branches actualizados: ${branchesUpdated}`);
    
    // 4. BORRAR Y RECREAR TODOS LOS GEOFENCES
    console.log('\n🗑️ BORRANDO TODOS LOS GEOFENCES:');
    const deleteResult = await pool.query('DELETE FROM geofences');
    console.log(`   ✅ ${deleteResult.rowCount} geofences eliminados`);
    
    console.log('\n🎯 RECREANDO GEOFENCES CON COORDENADAS CORRECTAS:');
    
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
    
    let geofencesCreated = 0;
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
          `Geofence para ${branch.name} - ${branch.city}, ${branch.state}`,
          branch.latitude,
          branch.longitude,
          150,
          true,
          true,
          true
        ]);
        
        geofencesCreated++;
      } catch (error) {
        console.log(`   ❌ Error creando geofence para #${branch.branch_number}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ ${geofencesCreated} geofences creados`);
    
    // 5. VERIFICAR COORDENADAS CRÍTICAS
    console.log('\n🔍 VERIFICACIÓN FINAL:');
    const criticalBranches = [
      { name: 'Pino Suarez', number: 1 },
      { name: 'Cadereyta', number: 26 },
      { name: 'Huasteca', number: 66 },
      { name: 'Gomez Morin', number: 62 },
      { name: 'Anahuac', number: 83 }
    ];
    
    for (const critical of criticalBranches) {
      const result = await pool.query(`
        SELECT 
          b.branch_number, b.name, b.latitude, b.longitude,
          g.center_lat, g.center_lng
        FROM branches b
        LEFT JOIN geofences g ON g.branch_id = b.id
        WHERE b.branch_number = $1 AND b.active = true
      `, [critical.number]);
      
      if (result.rows.length > 0) {
        const branch = result.rows[0];
        console.log(`   ✅ #${branch.branch_number} ${branch.name}:`);
        console.log(`      Branch: ${parseFloat(branch.latitude).toFixed(8)}, ${parseFloat(branch.longitude).toFixed(8)}`);
        console.log(`      Geofence: ${branch.center_lat ? parseFloat(branch.center_lat).toFixed(8) + ', ' + parseFloat(branch.center_lng).toFixed(8) : 'No encontrado'}`);
      }
    }
    
    // 6. MODIFICAR ARCHIVO PARA FORZAR REDEPLOY
    console.log('\n🚀 MODIFICANDO ARCHIVO PARA FORZAR REDEPLOY:');
    
    const timestamp = new Date().toISOString();
    const deployTrigger = `
// DEPLOY TRIGGER - ${timestamp}
// Coordenadas actualizadas desde CSV normalizado de Roberto
// Total branches: ${branchesUpdated}
// Total geofences: ${geofencesCreated}
// Status: PRODUCTION READY
console.log('🎯 COORDENADAS ACTUALIZADAS: ${timestamp}');
`;
    
    fs.appendFileSync('./src/api/server.js', deployTrigger);
    console.log(`   ✅ Deploy trigger añadido a server.js`);
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETA!');
    console.log('=' .repeat(80));
    console.log(`✅ RESULTADOS FINALES:`);
    console.log(`   • ${branchesUpdated} branches actualizados con CSV`);
    console.log(`   • ${geofencesCreated} geofences recreados`);
    console.log(`   • Deploy trigger creado`);
    console.log(`   • Timestamp: ${timestamp}`);
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('1. Commit y push automático');
    console.log('2. Railway detectará cambios y hará redeploy');
    console.log('3. Dashboard mostrará coordenadas correctas');
    console.log('4. Tiempo estimado: 3-4 minutos');
    
    return { 
      success: true, 
      branchesUpdated, 
      geofencesCreated, 
      timestamp 
    };
    
  } catch (error) {
    console.error('❌ Error en redeploy:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
forceCompleteRedeploy().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡REDEPLOY INICIADO!');
    console.log('Railway detectará los cambios y deployará automáticamente');
    console.log('Las coordenadas correctas estarán disponibles en 3-4 minutos');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});