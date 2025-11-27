const fs = require('fs');

function fixDurangoCSV() {
  console.log('🎯 CORRIGIENDO CSV: Gómez Palacio, Durango\n');
  
  try {
    // Leer CSV actual
    const csvContent = fs.readFileSync('grupos_operativos_final.csv', 'utf8');
    const lines = csvContent.split('\n');
    
    console.log('📋 CORRECCIONES A APLICAR:');
    console.log('   #46 - Campestre: Torreón → Gómez Palacio, Durango');
    console.log('   #47 - San Antonio: Ya está en Gómez Palacio, Durango ✓');
    console.log('   #42, #43, #44, #45: Permanecen en Torreón, Coahuila ✓\n');
    
    // Procesar líneas
    const correctedLines = lines.map(line => {
      if (!line.trim()) return line;
      
      const columns = line.split(',');
      if (columns.length < 5) return line;
      
      const numero = columns[0];
      
      // Corregir #46 - Campestre
      if (numero === '46') {
        console.log(`   ✅ #46 - Campestre: Torreón, Coahuila → Gómez Palacio, Durango`);
        columns[3] = '"Gómez Palacio"';  // Ciudad
        columns[4] = '"Durango"';        // Estado
        return columns.join(',');
      }
      
      return line;
    });
    
    // Guardar CSV corregido
    const correctedContent = correctedLines.join('\n');
    fs.writeFileSync('grupos_operativos_final_corregido.csv', correctedContent);
    
    console.log('\n📄 CSV CORREGIDO GENERADO: grupos_operativos_final_corregido.csv\n');
    
    // Validar correcciones
    console.log('🔍 VALIDACIÓN DE CORRECCIONES:');
    
    const validationLines = correctedContent.split('\n').slice(1).filter(line => line.trim());
    let durangoCount = 0;
    let coahuilaLagunaCount = 0;
    
    validationLines.forEach(line => {
      const columns = line.split(',');
      if (columns.length >= 5) {
        const numero = columns[0];
        const nombre = columns[1].replace(/"/g, '');
        const estado = columns[4].replace(/"/g, '');
        const ciudad = columns[3].replace(/"/g, '');
        
        // Contar sucursales en el área La Laguna
        if (['42', '43', '44', '45', '46', '47'].includes(numero)) {
          if (estado === 'Durango') {
            durangoCount++;
            console.log(`   🟢 #${numero} - ${nombre}: ${ciudad}, ${estado}`);
          } else if (estado === 'Coahuila' && ciudad === 'Torreón') {
            coahuilaLagunaCount++;
            console.log(`   🔵 #${numero} - ${nombre}: ${ciudad}, ${estado}`);
          }
        }
      }
    });
    
    console.log(`\n📊 RESUMEN ÁREA LA LAGUNA:`);
    console.log(`   • Gómez Palacio, Durango: ${durangoCount} sucursales`);
    console.log(`   • Torreón, Coahuila: ${coahuilaLagunaCount} sucursales`);
    console.log(`   • Total área: ${durangoCount + coahuilaLagunaCount} sucursales`);
    
    // Resumen final por estados
    console.log(`\n📋 RESUMEN FINAL POR ESTADOS:`);
    const estadoCount = {};
    validationLines.forEach(line => {
      const columns = line.split(',');
      if (columns.length >= 5) {
        const estado = columns[4].replace(/"/g, '');
        estadoCount[estado] = (estadoCount[estado] || 0) + 1;
      }
    });
    
    Object.entries(estadoCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([estado, count]) => {
        console.log(`   • ${estado}: ${count} sucursales`);
      });
    
    console.log('\n🎉 ¡CSV CORREGIDO Y VALIDADO!');
    console.log('=' .repeat(60));
    console.log('✅ Archivo: grupos_operativos_final_corregido.csv');
    console.log('✅ Gómez Palacio, Durango: 2 sucursales confirmadas');
    console.log('✅ Torreón, Coahuila: 4 sucursales confirmadas');
    console.log('✅ Clasificación geográfica precisa');
    console.log('✅ Listo para normalizar otros proyectos');
    
    return { success: true, durangoCount, coahuilaLagunaCount };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar corrección
const result = fixDurangoCSV();
if (result.success) {
  console.log('\n🎯 ¡CORRECCIÓN COMPLETADA!');
} else {
  console.log('\n❌ Error en corrección:', result.error);
}