require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function verifySpecificCoordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO COORDENADAS ESPECÍFICAS PROBLEMÁTICAS...\n');
    
    // 1. Sucursales específicas que Roberto menciona
    const problematicBranches = [
      'Pino Suarez',
      'Cadereyta', 
      'Huasteca',
      'Gomez Morin'
    ];
    
    // 2. Leer CSV
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // 3. Crear mapa de coordenadas del CSV
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
      if (coordParts.length !== 2) continue;
      
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
    
    // 4. Obtener coordenadas actuales de la base de datos
    const dbData = await pool.query(`
      SELECT branch_number, name, latitude, longitude, city, state
      FROM branches 
      WHERE active = true 
      ORDER BY branch_number
    `);
    
    console.log('🚨 VERIFICACIÓN DE SUCURSALES PROBLEMÁTICAS:');
    console.log('=' .repeat(80));
    
    // 5. Verificar cada sucursal problemática
    let foundIssues = 0;
    
    for (const problemBranch of problematicBranches) {
      console.log(`\n🔍 Buscando: ${problemBranch}`);
      
      // Buscar en la base de datos
      const matchingDb = dbData.rows.filter(branch => 
        branch.name.toLowerCase().includes(problemBranch.toLowerCase())
      );
      
      if (matchingDb.length === 0) {
        console.log(`   ❌ No encontrada en base de datos`);
        foundIssues++;
        continue;
      }
      
      for (const dbBranch of matchingDb) {
        const csvData = csvCoords[dbBranch.branch_number];
        
        console.log(`\n📍 SUCURSAL #${dbBranch.branch_number}: ${dbBranch.name}`);
        console.log(`   🏙️ Ubicación: ${dbBranch.city}, ${dbBranch.state}`);
        
        if (csvData) {
          const dbLat = parseFloat(dbBranch.latitude);
          const dbLng = parseFloat(dbBranch.longitude);
          
          const latDiff = Math.abs(dbLat - csvData.lat);
          const lngDiff = Math.abs(dbLng - csvData.lng);
          const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
          
          console.log(`   📊 CSV:  ${csvData.lat.toFixed(8)}, ${csvData.lng.toFixed(8)}`);
          console.log(`   📊 DB:   ${dbLat.toFixed(8)}, ${dbLng.toFixed(8)}`);
          console.log(`   ${isMatch ? '✅' : '❌'} Diferencia: lat=${latDiff.toFixed(10)}, lng=${lngDiff.toFixed(10)}`);
          
          if (!isMatch) {
            foundIssues++;
            console.log(`   🚨 ¡COORDENADAS NO COINCIDEN!`);
            console.log(`   🔧 CORRECCIÓN NECESARIA:`);
            console.log(`      UPDATE branches SET latitude = ${csvData.lat}, longitude = ${csvData.lng} WHERE branch_number = ${dbBranch.branch_number};`);
          }
        } else {
          console.log(`   ❌ No encontrada en CSV con número ${dbBranch.branch_number}`);
          foundIssues++;
        }
      }
    }
    
    // 6. Verificar todas las sucursales similares por si acaso
    console.log('\n🔍 VERIFICACIÓN ADICIONAL DE SUCURSALES SIMILARES:');
    console.log('=' .repeat(80));
    
    const similarNames = [
      'Pino', 'Suarez', 'Cadereyta', 'Huasteca', 'Gomez', 'Morin', 'Garcia'
    ];
    
    for (const name of similarNames) {
      const similar = dbData.rows.filter(branch => 
        branch.name.toLowerCase().includes(name.toLowerCase())
      );
      
      for (const branch of similar) {
        const csvData = csvCoords[branch.branch_number];
        if (csvData) {
          const dbLat = parseFloat(branch.latitude);
          const dbLng = parseFloat(branch.longitude);
          const latDiff = Math.abs(dbLat - csvData.lat);
          const lngDiff = Math.abs(dbLng - csvData.lng);
          const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
          
          if (!isMatch) {
            console.log(`\n❌ #${branch.branch_number} ${branch.name}:`);
            console.log(`   CSV: ${csvData.lat}, ${csvData.lng}`);
            console.log(`   DB:  ${dbLat}, ${dbLng}`);
            console.log(`   Diff: ${latDiff.toFixed(10)}, ${lngDiff.toFixed(10)}`);
          }
        }
      }
    }
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`   ${foundIssues === 0 ? '✅' : '❌'} Problemas encontrados: ${foundIssues}`);
    
    if (foundIssues > 0) {
      console.log('\n🔧 ACCIÓN REQUERIDA:');
      console.log('   Necesito corregir las coordenadas que no coinciden');
    } else {
      console.log('\n✅ TODAS LAS COORDENADAS COINCIDEN PERFECTAMENTE');
    }
    
    return { success: true, issues: foundIssues };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

verifySpecificCoordinates();