require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function verifyAnahuacCoordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO COORDENADAS ESPECÍFICAS DE ANAHUAC...\n');
    
    // 1. Leer CSV normalizado
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log('📊 BUSCANDO ANAHUAC EN CSV:');
    
    // 2. Buscar Anahuac en CSV
    let anahuacCsv = null;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const csvRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
      const parts = line.split(csvRegex);
      if (parts.length < 7) continue;
      
      const csvNum = parseInt(parts[1]);
      const csvName = parts[2];
      let csvCoordsStr = parts[6];
      
      if (csvName.toLowerCase().includes('anahuac')) {
        console.log(`   Encontrada en CSV: #${csvNum} - ${csvName}`);
        
        if (!csvCoordsStr || csvCoordsStr.trim() === '' || csvCoordsStr.trim() === '""') {
          console.log('   ❌ Sin coordenadas en CSV');
          continue;
        }
        
        csvCoordsStr = csvCoordsStr.replace(/^"|"$/g, '').trim();
        const coordParts = csvCoordsStr.split(',');
        
        if (coordParts.length === 2) {
          const csvLat = parseFloat(coordParts[0].trim());
          const csvLng = parseFloat(coordParts[1].trim());
          
          if (!isNaN(csvLat) && !isNaN(csvLng)) {
            anahuacCsv = {
              number: csvNum,
              name: csvName,
              lat: csvLat,
              lng: csvLng
            };
            console.log(`   📍 Coordenadas CSV: ${csvLat}, ${csvLng}`);
            break;
          }
        }
      }
    }
    
    if (!anahuacCsv) {
      console.log('   ❌ No se encontró Anahuac en el CSV');
      return { success: false, error: 'Anahuac no encontrada en CSV' };
    }
    
    // 3. Buscar Anahuac en la base de datos
    console.log('\n📊 BUSCANDO ANAHUAC EN BASE DE DATOS:');
    
    const dbData = await pool.query(`
      SELECT branch_number, name, latitude, longitude, city, state, group_id, group_name
      FROM branches 
      WHERE active = true AND (
        name ILIKE '%anahuac%' OR 
        branch_number = $1
      )
      ORDER BY branch_number
    `, [anahuacCsv.number]);
    
    if (dbData.rows.length === 0) {
      console.log('   ❌ No se encontró Anahuac en base de datos');
      return { success: false, error: 'Anahuac no encontrada en DB' };
    }
    
    // 4. Comparar coordenadas
    console.log('\n🔍 COMPARACIÓN DETALLADA:');
    console.log('=' .repeat(80));
    
    let foundIssue = false;
    
    for (const branch of dbData.rows) {
      console.log(`\n📍 SUCURSAL #${branch.branch_number}: ${branch.name}`);
      console.log(`   🏙️ Ubicación: ${branch.city}, ${branch.state}`);
      console.log(`   👥 Grupo: ${branch.group_id} (${branch.group_name})`);
      
      const dbLat = parseFloat(branch.latitude);
      const dbLng = parseFloat(branch.longitude);
      
      const latDiff = Math.abs(dbLat - anahuacCsv.lat);
      const lngDiff = Math.abs(dbLng - anahuacCsv.lng);
      const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
      
      console.log(`\n   📊 COORDENADAS:`);
      console.log(`      CSV:  ${anahuacCsv.lat.toFixed(10)}, ${anahuacCsv.lng.toFixed(10)}`);
      console.log(`      DB:   ${dbLat.toFixed(10)}, ${dbLng.toFixed(10)}`);
      console.log(`      Diff: lat=${latDiff.toFixed(12)}, lng=${lngDiff.toFixed(12)}`);
      console.log(`      ${isMatch ? '✅ COINCIDEN' : '❌ NO COINCIDEN'}`);
      
      if (!isMatch) {
        foundIssue = true;
        console.log(`\n   🚨 ¡COORDENADAS INCORRECTAS!`);
        console.log(`   🔧 CORRECCIÓN NECESARIA:`);
        console.log(`      Actualizar #${branch.branch_number} con coordenadas del CSV`);
        
        // 5. Aplicar corrección inmediatamente
        console.log(`\n   🔄 APLICANDO CORRECCIÓN...`);
        try {
          await pool.query(`
            UPDATE branches 
            SET 
              latitude = $1,
              longitude = $2,
              updated_at = NOW()
            WHERE branch_number = $3
          `, [anahuacCsv.lat, anahuacCsv.lng, branch.branch_number]);
          
          console.log(`   ✅ Coordenadas corregidas en base de datos`);
          
          // Verificar la corrección
          const updated = await pool.query(`
            SELECT latitude, longitude 
            FROM branches 
            WHERE branch_number = $1
          `, [branch.branch_number]);
          
          if (updated.rows.length > 0) {
            const newLat = parseFloat(updated.rows[0].latitude);
            const newLng = parseFloat(updated.rows[0].longitude);
            console.log(`   ✅ Verificación: ${newLat.toFixed(10)}, ${newLng.toFixed(10)}`);
          }
          
        } catch (updateError) {
          console.log(`   ❌ Error actualizando: ${updateError.message}`);
        }
      }
    }
    
    if (!foundIssue) {
      console.log('\n✅ TODAS LAS COORDENADAS DE ANAHUAC SON CORRECTAS');
    } else {
      console.log('\n🔧 COORDENADAS DE ANAHUAC CORREGIDAS');
    }
    
    return { success: true, corrected: foundIssue };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

verifyAnahuacCoordinates();