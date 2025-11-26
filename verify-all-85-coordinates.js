require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function verifyAll85Coordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO TODAS LAS 85 COORDENADAS DEL CSV...\n');
    
    // 1. Leer CSV normalizado
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log('📊 PROCESANDO CSV NORMALIZADO:');
    console.log(`   ✅ ${lines.length - 1} líneas encontradas en CSV`);
    
    // 2. Crear mapa de coordenadas del CSV
    const csvCoords = {};
    let csvProcessed = 0;
    
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
          csvProcessed++;
        }
      }
    }
    
    console.log(`   ✅ ${csvProcessed} coordenadas válidas procesadas del CSV`);
    
    // 3. Obtener todas las sucursales de la base de datos
    console.log('\n📊 OBTENIENDO SUCURSALES DE PRODUCCIÓN:');
    
    const allBranches = await pool.query(`
      SELECT 
        b.branch_number, b.name, b.latitude, b.longitude, b.city, b.state, b.group_name,
        g.center_lat as geofence_lat, g.center_lng as geofence_lng
      FROM branches b
      LEFT JOIN geofences g ON g.branch_id = b.id
      WHERE b.active = true
      ORDER BY b.branch_number
    `);
    
    console.log(`   ✅ ${allBranches.rows.length} sucursales encontradas en producción`);
    
    // 4. Verificar cada sucursal
    console.log('\n🔍 VERIFICANDO COORDENADAS SUCURSAL POR SUCURSAL:');
    console.log('=' .repeat(100));
    console.log('NUM  NOMBRE                          CSV_COORDS              DB_COORDS               MATCH');
    console.log('=' .repeat(100));
    
    let matches = 0;
    let mismatches = 0;
    let csvNotFound = 0;
    let dbNotFound = 0;
    
    // Verificar todas las del CSV
    for (const [csvNum, csvData] of Object.entries(csvCoords)) {
      const branchNum = parseInt(csvNum);
      const dbBranch = allBranches.rows.find(b => b.branch_number === branchNum);
      
      if (dbBranch) {
        const dbLat = parseFloat(dbBranch.latitude);
        const dbLng = parseFloat(dbBranch.longitude);
        
        const latDiff = Math.abs(dbLat - csvData.lat);
        const lngDiff = Math.abs(csvData.lng - dbLng);
        const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
        
        const status = isMatch ? '✅ SI' : '❌ NO';
        const csvCoordStr = `${csvData.lat.toFixed(6)}, ${csvData.lng.toFixed(6)}`;
        const dbCoordStr = `${dbLat.toFixed(6)}, ${dbLng.toFixed(6)}`;
        
        console.log(`${branchNum.toString().padStart(3)}  ${csvData.name.substring(0, 30).padEnd(30)} ${csvCoordStr.padEnd(22)} ${dbCoordStr.padEnd(22)} ${status}`);
        
        if (isMatch) {
          matches++;
        } else {
          mismatches++;
          console.log(`     ⚠️  Diferencia: lat=${latDiff.toFixed(8)}, lng=${lngDiff.toFixed(8)}`);
        }
      } else {
        console.log(`${branchNum.toString().padStart(3)}  ${csvData.name.substring(0, 30).padEnd(30)} ${('CSV: ' + csvData.lat.toFixed(6) + ', ' + csvData.lng.toFixed(6)).padEnd(22)} ${'NO FOUND IN DB'.padEnd(22)} ❌ NO`);
        csvNotFound++;
      }
    }
    
    // Verificar si hay sucursales en DB que no están en CSV
    for (const dbBranch of allBranches.rows) {
      if (!csvCoords[dbBranch.branch_number]) {
        console.log(`${dbBranch.branch_number.toString().padStart(3)}  ${dbBranch.name.substring(0, 30).padEnd(30)} ${'NOT IN CSV'.padEnd(22)} ${(parseFloat(dbBranch.latitude).toFixed(6) + ', ' + parseFloat(dbBranch.longitude).toFixed(6)).padEnd(22)} ❌ NO`);
        dbNotFound++;
      }
    }
    
    // 5. Verificar geofences también
    console.log('\n📊 VERIFICANDO SINCRONIZACIÓN GEOFENCES:');
    console.log('=' .repeat(80));
    
    let geofenceMatches = 0;
    let geofenceMismatches = 0;
    
    for (const dbBranch of allBranches.rows) {
      if (csvCoords[dbBranch.branch_number] && dbBranch.geofence_lat && dbBranch.geofence_lng) {
        const csvData = csvCoords[dbBranch.branch_number];
        const geoLat = parseFloat(dbBranch.geofence_lat);
        const geoLng = parseFloat(dbBranch.geofence_lng);
        
        const latDiff = Math.abs(geoLat - csvData.lat);
        const lngDiff = Math.abs(geoLng - csvData.lng);
        const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
        
        if (isMatch) {
          geofenceMatches++;
        } else {
          geofenceMismatches++;
          console.log(`   ❌ #${dbBranch.branch_number} ${dbBranch.name}: geofence no sincronizado`);
        }
      }
    }
    
    // 6. Resumen final
    console.log('\n📊 RESUMEN FINAL DE VERIFICACIÓN:');
    console.log('=' .repeat(80));
    console.log(`✅ COORDENADAS QUE COINCIDEN:     ${matches}/${csvProcessed}`);
    console.log(`❌ COORDENADAS QUE NO COINCIDEN:  ${mismatches}`);
    console.log(`⚠️  EN CSV PERO NO EN DB:         ${csvNotFound}`);
    console.log(`⚠️  EN DB PERO NO EN CSV:         ${dbNotFound}`);
    console.log(`📊 TOTAL SUCURSALES CSV:          ${csvProcessed}`);
    console.log(`📊 TOTAL SUCURSALES DB:           ${allBranches.rows.length}`);
    
    console.log('\n🗺️ GEOFENCES SINCRONIZADOS:');
    console.log(`✅ GEOFENCES CORRECTOS:           ${geofenceMatches}`);
    console.log(`❌ GEOFENCES INCORRECTOS:         ${geofenceMismatches}`);
    
    // 7. Verificación específica de sucursales problemáticas
    console.log('\n🚨 VERIFICACIÓN DE SUCURSALES CRÍTICAS:');
    console.log('=' .repeat(80));
    
    const criticalBranches = [
      { name: 'Pino Suarez', number: 1 },
      { name: 'Cadereyta', number: 26 },
      { name: 'Huasteca', number: 66 },
      { name: 'Gomez Morin', number: 62 },
      { name: 'Anahuac', number: 83 },
      { name: 'Harold R. Pape', number: 57 },
      { name: 'Aeropuerto Nuevo Laredo', number: 82 },
      { name: 'Cerradas de Anahuac', number: 83 },
      { name: 'Aeropuerto del Norte', number: 84 },
      { name: 'Diego Diaz', number: 85 }
    ];
    
    for (const critical of criticalBranches) {
      const csvData = csvCoords[critical.number];
      const dbBranch = allBranches.rows.find(b => b.branch_number === critical.number);
      
      if (csvData && dbBranch) {
        const dbLat = parseFloat(dbBranch.latitude);
        const dbLng = parseFloat(dbBranch.longitude);
        const latDiff = Math.abs(dbLat - csvData.lat);
        const lngDiff = Math.abs(dbLng - csvData.lng);
        const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
        
        console.log(`   ${isMatch ? '✅' : '❌'} #${critical.number} ${critical.name}: ${isMatch ? 'CORRECTO' : 'INCORRECTO'}`);
        
        if (!isMatch) {
          console.log(`      CSV:  ${csvData.lat.toFixed(8)}, ${csvData.lng.toFixed(8)}`);
          console.log(`      DB:   ${dbLat.toFixed(8)}, ${dbLng.toFixed(8)}`);
          console.log(`      Diff: ${latDiff.toFixed(8)}, ${lngDiff.toFixed(8)}`);
        }
      } else if (!csvData) {
        console.log(`   ⚠️  #${critical.number} ${critical.name}: No en CSV`);
      } else if (!dbBranch) {
        console.log(`   ⚠️  #${critical.number} ${critical.name}: No en DB`);
      }
    }
    
    // 8. Status final
    console.log('\n🎯 ESTADO FINAL:');
    console.log('=' .repeat(80));
    
    const successRate = (matches / csvProcessed) * 100;
    
    if (successRate === 100) {
      console.log('🎉 ¡PERFECTO! TODAS LAS 85 SUCURSALES TIENEN COORDENADAS CORRECTAS DEL CSV');
      console.log('✅ Sistema GPS completamente sincronizado');
      console.log('✅ Dashboard mostrará ubicaciones precisas');
    } else {
      console.log(`⚠️  ${successRate.toFixed(1)}% de las sucursales están correctas`);
      console.log(`🔧 ${mismatches} sucursales necesitan corrección`);
    }
    
    return { 
      success: true, 
      matches, 
      mismatches, 
      total: csvProcessed,
      successRate: successRate.toFixed(1)
    };
    
  } catch (error) {
    console.error('❌ Error verificando coordenadas:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
verifyAll85Coordinates().then(result => {
  if (result.success) {
    if (result.successRate === '100.0') {
      console.log('\n🚀 ¡CONFIRMACIÓN TOTAL!');
      console.log('   Todas las coordenadas coinciden perfectamente con tu CSV');
    } else {
      console.log(`\n📊 Verificación completada: ${result.successRate}% correctas`);
    }
  } else {
    console.log('\n❌ Error:', result.error);
  }
});