require('dotenv').config();
const { Pool } = require('pg');

async function analyzeLagunaArea() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 ANÁLISIS GEOGRÁFICO DEL ÁREA DE LA LAGUNA\n');
    console.log('Validando límites entre Torreón, Coahuila y Gómez Palacio, Durango\n');
    
    // Obtener sucursales en el área de La Laguna
    const result = await pool.query(`
      SELECT 
        name,
        location_code,
        latitude,
        longitude,
        group_name,
        synced_at
      FROM tracking_locations_cache 
      WHERE active = true
        AND latitude BETWEEN 25.45 AND 25.65
        AND longitude BETWEEN -103.6 AND -103.3
      ORDER BY longitude DESC, latitude DESC
    `);
    
    console.log(`📊 SUCURSALES EN ÁREA LA LAGUNA: ${result.rows.length}\n`);
    
    result.rows.forEach((row, index) => {
      const nameMatch = row.name.match(/^(\d+)\s*-\s*(.+)$/);
      const sucursalNumber = nameMatch ? nameMatch[1] : 'N/A';
      const sucursalName = nameMatch ? nameMatch[2].trim() : row.name;
      
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      
      console.log(`${index + 1}. #${sucursalNumber} - ${sucursalName}`);
      console.log(`   📍 Coordenadas: ${lat.toFixed(8)}, ${lng.toFixed(8)}`);
      console.log(`   🏢 Grupo: ${row.group_name}`);
      console.log(`   🆔 Code: ${row.location_code}`);
      
      // Análisis geográfico basado en límites reales
      let geograficoAnalisis;
      
      // Límite aproximado entre estados en esta zona:
      // Gómez Palacio, Durango está al este del Río Nazas
      // Torreón, Coahuila está al oeste del Río Nazas
      // Aproximadamente longitud -103.48 es el límite
      
      if (lng > -103.48) {
        // Zona este = Gómez Palacio, Durango
        geograficoAnalisis = {
          estado: 'Durango',
          ciudad: 'Gómez Palacio',
          razon: 'Al este del límite estatal (Río Nazas aprox)'
        };
      } else {
        // Zona oeste = Torreón, Coahuila  
        geograficoAnalisis = {
          estado: 'Coahuila',
          ciudad: 'Torreón',
          razon: 'Al oeste del límite estatal (Río Nazas aprox)'
        };
      }
      
      console.log(`   🌍 Análisis geográfico: ${geograficoAnalisis.ciudad}, ${geograficoAnalisis.estado}`);
      console.log(`   ⚖️  Razón: ${geograficoAnalisis.razon}`);
      
      // Verificar con nombres de sucursales para contexto adicional
      const nombreContexto = sucursalName.toLowerCase();
      let contextoNombre = '';
      
      if (nombreContexto.includes('antonio') || nombreContexto.includes('palacio')) {
        contextoNombre = '🎯 Nombre sugiere Gómez Palacio';
      } else if (nombreContexto.includes('torreon') || nombreContexto.includes('laguna')) {
        contextoNombre = '🎯 Nombre sugiere Torreón';
      } else {
        contextoNombre = '📝 Nombre no específico de ciudad';
      }
      
      console.log(`   ${contextoNombre}`);
      console.log('');
    });
    
    console.log('📋 RESUMEN DEL ANÁLISIS:\n');
    
    let durangoCount = 0;
    let coahuilaCount = 0;
    
    result.rows.forEach(row => {
      const lng = parseFloat(row.longitude);
      const nameMatch = row.name.match(/^(\d+)\s*-\s*(.+)$/);
      const sucursalNumber = nameMatch ? nameMatch[1] : 'N/A';
      const sucursalName = nameMatch ? nameMatch[2].trim() : row.name;
      
      if (lng > -103.48) {
        durangoCount++;
        console.log(`   🟢 #${sucursalNumber} - ${sucursalName} → DURANGO (Gómez Palacio)`);
      } else {
        coahuilaCount++;
        console.log(`   🔵 #${sucursalNumber} - ${sucursalName} → COAHUILA (Torreón)`);
      }
    });
    
    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`   • Gómez Palacio, Durango: ${durangoCount} sucursales`);
    console.log(`   • Torreón, Coahuila: ${coahuilaCount} sucursales`);
    console.log(`   • Total área La Laguna: ${result.rows.length} sucursales`);
    
    console.log('\n🗺️ METODOLOGÍA:');
    console.log('   • Límite estatal: Río Nazas (aprox. longitud -103.48)');
    console.log('   • Este del río = Gómez Palacio, Durango');
    console.log('   • Oeste del río = Torreón, Coahuila');
    console.log('   • Análisis basado en coordenadas geográficas reales');
    
    if (durangoCount !== 1) {
      console.log('\n⚠️ DISCREPANCIA DETECTADA:');
      console.log(`   El CSV actual muestra 1 sucursal en Durango`);
      console.log(`   El análisis geográfico sugiere ${durangoCount} sucursales en Durango`);
      console.log('   Se recomienda corrección del CSV');
    } else {
      console.log('\n✅ VALIDACIÓN CORRECTA:');
      console.log('   El CSV actual coincide con el análisis geográfico');
    }
    
    return { 
      success: true, 
      durangoCount, 
      coahuilaCount,
      totalLaguna: result.rows.length,
      needsCorrection: durangoCount !== 1
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar análisis
analyzeLagunaArea().then(result => {
  if (result.success) {
    console.log('\n🎯 ANÁLISIS COMPLETADO');
    if (result.needsCorrection) {
      console.log(`Corrección requerida: ${result.durangoCount} sucursales en Durango`);
    } else {
      console.log('Datos geográficos validados correctamente');
    }
  } else {
    console.log('\n❌ Error:', result.error);
  }
});