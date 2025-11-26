require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function applyAllCsvCoordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 APLICANDO TODAS LAS COORDENADAS DEL CSV VALIDADO POR ROBERTO...\n');
    
    // 1. Leer CSV
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log('📊 PROCESANDO COORDENADAS DEL CSV:');
    
    let updated = 0;
    let errors = 0;
    
    // 2. Procesar cada línea del CSV
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
      if (!csvCoordsStr || csvCoordsStr.trim() === '' || csvCoordsStr.trim() === '""') {
        console.log(`   ⚠️ #${csvNum} - Sin coordenadas en CSV`);
        continue;
      }
      
      csvCoordsStr = csvCoordsStr.replace(/^"|"$/g, '').trim(); // Quitar comillas del inicio y final
      
      if (!csvCoordsStr || csvCoordsStr === '') {
        console.log(`   ⚠️ #${csvNum} - Coordenadas vacías`);
        continue;
      }
      
      // Parsear coordenadas del CSV
      const coordParts = csvCoordsStr.split(',');
      if (coordParts.length !== 2) {
        console.log(`   ⚠️ #${csvNum} - Formato de coordenadas inválido: ${csvCoordsStr}`);
        continue;
      }
      
      const csvLat = parseFloat(coordParts[0].trim());
      const csvLng = parseFloat(coordParts[1].trim());
      
      if (isNaN(csvLat) || isNaN(csvLng)) {
        console.log(`   ⚠️ #${csvNum} - Coordenadas no numéricas: ${csvCoordsStr}`);
        continue;
      }
      
      try {
        // 3. Actualizar en la base de datos por número de sucursal
        const result = await pool.query(`
          UPDATE branches 
          SET 
            latitude = $1,
            longitude = $2,
            updated_at = NOW()
          WHERE branch_number = $3 AND active = true
        `, [csvLat, csvLng, csvNum]);
        
        if (result.rowCount > 0) {
          console.log(`   ✅ #${csvNum} - ${csvName.substring(0,25).padEnd(25)} → ${csvLat.toFixed(6)}, ${csvLng.toFixed(6)}`);
          updated++;
        } else {
          console.log(`   ❌ #${csvNum} - No encontrada en base de datos`);
          errors++;
        }
      } catch (error) {
        console.log(`   ❌ #${csvNum} - Error: ${error.message}`);
        errors++;
      }
    }
    
    // 4. Verificar resultados
    console.log(`\n📊 RESUMEN DE ACTUALIZACIÓN:`);
    console.log(`   ✅ Coordenadas actualizadas: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📊 Total procesadas: ${updated + errors}`);
    
    // 5. Verificar que todas las sucursales tienen coordenadas
    console.log('\n🔍 VERIFICANDO ESTADO FINAL:');
    const finalCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords,
        COUNT(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 END) as without_coords
      FROM branches 
      WHERE active = true
    `);
    
    const stats = finalCheck.rows[0];
    console.log(`   📍 Total sucursales: ${stats.total}`);
    console.log(`   ✅ Con coordenadas: ${stats.with_coords}`);
    console.log(`   ❌ Sin coordenadas: ${stats.without_coords}`);
    
    if (parseInt(stats.without_coords) > 0) {
      // Mostrar cuáles no tienen coordenadas
      const missing = await pool.query(`
        SELECT branch_number, name 
        FROM branches 
        WHERE active = true AND (latitude IS NULL OR longitude IS NULL)
        ORDER BY branch_number
      `);
      
      console.log('\n⚠️ SUCURSALES SIN COORDENADAS:');
      missing.rows.forEach(branch => {
        console.log(`   #${branch.branch_number} - ${branch.name}`);
      });
    }
    
    // 6. Verificar las 3 nuevas sucursales específicamente
    console.log('\n🆕 VERIFICANDO LAS 3 NUEVAS SUCURSALES:');
    const newOnes = await pool.query(`
      SELECT branch_number, name, latitude, longitude, group_id, group_name
      FROM branches 
      WHERE branch_number IN (83, 84, 85)
      ORDER BY branch_number
    `);
    
    newOnes.rows.forEach(branch => {
      const hasCoords = branch.latitude && branch.longitude;
      const statusIcon = hasCoords ? '✅' : '❌';
      console.log(`   ${statusIcon} #${branch.branch_number} - ${branch.name}`);
      if (hasCoords) {
        console.log(`      Coordenadas: ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}`);
        console.log(`      Grupo: ${branch.group_id} (${branch.group_name})`);
      }
    });
    
    console.log('\n🎉 ¡COORDENADAS DEL CSV APLICADAS COMPLETAMENTE!');
    console.log('\n✅ RESULTADO:');
    console.log(`   • ${updated} sucursales actualizadas con coordenadas validadas por Roberto`);
    console.log('   • Grupos operativos corregidos conservados');
    console.log('   • Sistema listo para sincronizar geofences');
    
    return { success: true, updated, errors };
    
  } catch (error) {
    console.error('❌ Error aplicando coordenadas:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  const result = await applyAllCsvCoordinates();
  
  if (result.success) {
    console.log(`\n🚀 ACTUALIZACIÓN EXITOSA - ${result.updated} coordenadas aplicadas`);
    console.log('\n🌐 PRÓXIMOS PASOS:');
    console.log('   1. Sincronizar geofences con coordenadas actualizadas');
    console.log('   2. Verificar que todo está correcto');
    console.log('   3. Hacer commit a Railway');
  } else {
    console.log('\n❌ Error en actualización:', result.error);
  }
  
  process.exit(0);
}

main();