require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function verifyCsvCoordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO SI ESTOY USANDO LAS COORDENADAS CORRECTAS DEL CSV...\n');
    
    // 1. Leer CSV
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log('📊 COMPARANDO CSV vs BASE DE DATOS:');
    console.log('Num | CSV Coordinates | DB Coordinates | ¿Coinciden?');
    console.log('----|----------------|----------------|-------------');
    
    let matches = 0;
    let differences = 0;
    
    // 2. Obtener coordenadas de la base de datos
    const dbCoords = await pool.query(`
      SELECT branch_number, latitude, longitude, name
      FROM branches 
      WHERE active = true 
      ORDER BY branch_number
    `);
    
    const dbMap = {};
    dbCoords.rows.forEach(row => {
      dbMap[row.branch_number] = {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        name: row.name
      };
    });
    
    // 3. Comparar cada línea del CSV
    for (let i = 1; i < lines.length; i++) { // Saltar header
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Usar regex para parsear CSV con comillas
      const csvRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
      const parts = line.split(csvRegex);
      if (parts.length < 7) continue;
      
      const csvNum = parseInt(parts[1]);
      const csvName = parts[2];
      let csvCoordsStr = parts[6];
      
      // Limpiar coordenadas
      if (!csvCoordsStr || csvCoordsStr.trim() === '' || csvCoordsStr.trim() === '""') continue;
      csvCoordsStr = csvCoordsStr.replace(/^"|"$/g, '').trim(); // Quitar comillas del inicio y final
      
      if (!csvCoordsStr || csvCoordsStr === '') continue;
      
      // Parsear coordenadas del CSV
      const coordParts = csvCoordsStr.split(',');
      if (coordParts.length !== 2) continue;
      
      const csvLat = parseFloat(coordParts[0].trim());
      const csvLng = parseFloat(coordParts[1].trim());
      
      if (isNaN(csvLat) || isNaN(csvLng)) continue;
      
      // Comparar con base de datos
      const dbData = dbMap[csvNum];
      if (dbData) {
        const latDiff = Math.abs(dbData.lat - csvLat);
        const lngDiff = Math.abs(dbData.lng - csvLng);
        const isMatch = latDiff < 0.0001 && lngDiff < 0.0001; // Tolerancia de 0.0001 grados
        
        const status = isMatch ? '✅ SÍ' : '❌ NO';
        if (isMatch) matches++;
        else differences++;
        
        console.log(`${csvNum.toString().padStart(3)} | ${csvLat.toFixed(6)}, ${csvLng.toFixed(6)} | ${dbData.lat.toFixed(6)}, ${dbData.lng.toFixed(6)} | ${status}`);
        
        if (!isMatch) {
          console.log(`    ⚠️ DIFERENCIA: ${csvName}`);
          console.log(`       CSV: ${csvLat}, ${csvLng}`);
          console.log(`       DB:  ${dbData.lat}, ${dbData.lng}`);
          console.log(`       Diff: lat=${latDiff.toFixed(8)}, lng=${lngDiff.toFixed(8)}\n`);
        }
      } else {
        console.log(`${csvNum.toString().padStart(3)} | ${csvLat.toFixed(6)}, ${csvLng.toFixed(6)} | NO ENCONTRADA | ❌ NO`);
        differences++;
      }
    }
    
    console.log('\n📊 RESUMEN DE VERIFICACIÓN:');
    console.log(`   ✅ Coincidencias: ${matches}`);
    console.log(`   ❌ Diferencias: ${differences}`);
    console.log(`   📊 Total verificadas: ${matches + differences}`);
    
    if (differences > 0) {
      console.log('\n⚠️ HAY DIFERENCIAS - NO ESTOY USANDO TU CSV CORRECTAMENTE');
      console.log('   Necesito aplicar las coordenadas de tu CSV a la base de datos');
    } else {
      console.log('\n✅ PERFECTO - ESTOY USANDO EXACTAMENTE TU CSV');
      console.log('   Todas las coordenadas coinciden con las que validaste');
    }
    
    // 4. Verificar específicamente Harold R. Pape y Aeropuerto Nuevo Laredo
    console.log('\n🔍 VERIFICACIÓN ESPECÍFICA:');
    
    // Harold R. Pape (#57)
    const harold = dbMap[57];
    if (harold) {
      console.log(`   #57 Harold R. Pape: ${harold.lat}, ${harold.lng}`);
    }
    
    // Aeropuerto Nuevo Laredo (#82)
    const aeropuerto = dbMap[82];
    if (aeropuerto) {
      console.log(`   #82 Aeropuerto Nuevo Laredo: ${aeropuerto.lat}, ${aeropuerto.lng}`);
    }
    
    return { success: true, matches, differences };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

verifyCsvCoordinates();