require('dotenv').config();

/**
 * SOLUCIÓN TEMPORAL - GENERADOR DE URLs DE GOOGLE MAPS
 * Para obtener coordenadas manualmente mientras se configura API key
 */

// Lista completa de sucursales con búsquedas optimizadas
const TODAS_LAS_SUCURSALES = [
  // TEPEYAC - MONTERREY CENTRO
  { codigo: "2247000", nombre: "1 - Pino Suarez", grupo: "TEPEYAC", 
    busqueda: "El Pollo Loco Pino Suarez, Monterrey, Nuevo León", 
    direccion_aprox: "Pino Suárez, Centro, Monterrey, NL" },
  { codigo: "2247001", nombre: "2 - Madero", grupo: "TEPEYAC",
    busqueda: "El Pollo Loco Madero, Centro, Monterrey, Nuevo León",
    direccion_aprox: "Francisco I. Madero, Centro, Monterrey, NL" },
  { codigo: "2247002", nombre: "3 - Matamoros", grupo: "TEPEYAC",
    busqueda: "El Pollo Loco Matamoros, Centro, Monterrey, Nuevo León",
    direccion_aprox: "Mariano Matamoros, Centro, Monterrey, NL" },
  { codigo: "2247003", nombre: "Sucursal SC - Santa Catarina", grupo: "TEPEYAC",
    busqueda: "El Pollo Loco Santa Catarina, Nuevo León",
    direccion_aprox: "Santa Catarina, Nuevo León" },
  { codigo: "2247004", nombre: "5 - Felix U. Gomez", grupo: "TEPEYAC",
    busqueda: "El Pollo Loco Felix U Gomez, Monterrey, Nuevo León",
    direccion_aprox: "Félix U. Gómez, Monterrey, NL" },
  { codigo: "2247005", nombre: "Sucursal GC - Garcia", grupo: "TEPEYAC",
    busqueda: "El Pollo Loco García, Nuevo León",
    direccion_aprox: "García, Nuevo León" },
  { codigo: "2247006", nombre: "Sucursal LH - La Huasteca", grupo: "TEPEYAC",
    busqueda: "El Pollo Loco La Huasteca, Santa Catarina, Nuevo León",
    direccion_aprox: "La Huasteca, Santa Catarina, NL" },

  // OGAS - ÁREA METROPOLITANA NORTE
  { codigo: "2247007", nombre: "8 - Gonzalitos", grupo: "OGAS",
    busqueda: "El Pollo Loco Gonzalitos, Monterrey, Nuevo León",
    direccion_aprox: "Gonzalitos, Monterrey, NL" },
  { codigo: "2247008", nombre: "9 - Anahuac", grupo: "OGAS",
    busqueda: "El Pollo Loco Anahuac, San Nicolás de los Garza, Nuevo León",
    direccion_aprox: "Anáhuac, San Nicolás de los Garza, NL" },
  { codigo: "2247009", nombre: "10 - Barragan", grupo: "OGAS",
    busqueda: "El Pollo Loco Barragán, Monterrey, Nuevo León",
    direccion_aprox: "Barragán, Monterrey, NL" },
  { codigo: "2247010", nombre: "11 - Lincoln", grupo: "OGAS",
    busqueda: "El Pollo Loco Lincoln, Monterrey, Nuevo León",
    direccion_aprox: "Lincoln, Monterrey, NL" },
  { codigo: "2247011", nombre: "12 - Concordia", grupo: "OGAS",
    busqueda: "El Pollo Loco Concordia, Monterrey, Nuevo León",
    direccion_aprox: "Concordia, Monterrey, NL" },
  { codigo: "2247012", nombre: "13 - Escobedo", grupo: "OGAS",
    busqueda: "El Pollo Loco Escobedo, Nuevo León",
    direccion_aprox: "General Escobedo, Nuevo León" },
  { codigo: "2247013", nombre: "14 - Aztlan", grupo: "OGAS",
    busqueda: "El Pollo Loco Aztlán, Guadalupe, Nuevo León",
    direccion_aprox: "Aztlán, Guadalupe, NL" },
  { codigo: "2247014", nombre: "15 - Ruiz Cortinez", grupo: "OGAS",
    busqueda: "El Pollo Loco Ruiz Cortines, Guadalupe, Nuevo León",
    direccion_aprox: "Ruiz Cortines, Guadalupe, NL" },

  // EPL SO
  { codigo: "2247015", nombre: "16 - Solidaridad", grupo: "EPL SO",
    busqueda: "El Pollo Loco Solidaridad, Monterrey, Nuevo León",
    direccion_aprox: "Solidaridad, Monterrey, NL" },

  // EFM
  { codigo: "2247016", nombre: "17 - Romulo Garza", grupo: "EFM",
    busqueda: "El Pollo Loco Rómulo Garza, San Nicolás de los Garza, Nuevo León",
    direccion_aprox: "Rómulo Garza, San Nicolás de los Garza, NL" },
  { codigo: "2247017", nombre: "18 - Linda Vista", grupo: "EFM",
    busqueda: "El Pollo Loco Linda Vista, Guadalupe, Nuevo León",
    direccion_aprox: "Linda Vista, Guadalupe, NL" },
  { codigo: "2247018", nombre: "19 - Valle Soleado", grupo: "EFM",
    busqueda: "El Pollo Loco Valle Soleado, Guadalupe, Nuevo León",
    direccion_aprox: "Valle Soleado, Guadalupe, NL" },

  // TEC
  { codigo: "2247019", nombre: "20 - Tecnológico", grupo: "TEC",
    busqueda: "El Pollo Loco Tecnológico, Monterrey, Nuevo León",
    direccion_aprox: "Tecnológico, Monterrey, NL" },
  { codigo: "2247020", nombre: "21 - Chapultepec", grupo: "TEC",
    busqueda: "El Pollo Loco Chapultepec, Monterrey, Nuevo León",
    direccion_aprox: "Chapultepec, Monterrey, NL" },
  { codigo: "2247021", nombre: "22 - Satelite", grupo: "TEC",
    busqueda: "El Pollo Loco Satélite, Monterrey, Nuevo León",
    direccion_aprox: "Satélite, Monterrey, NL" },
  { codigo: "2247022", nombre: "23 - Guasave", grupo: "TEC",
    busqueda: "El Pollo Loco Guasave, Sinaloa",
    direccion_aprox: "Guasave, Sinaloa" }
];

function generarUrlsMapsParaBusqueda() {
  console.log('🗺️ GENERADOR DE URLs DE GOOGLE MAPS PARA BÚSQUEDA MANUAL');
  console.log('Mientras configuras la API key, puedes buscar coordenadas manualmente');
  console.log('='.repeat(70));
  console.log('');

  console.log('📋 INSTRUCCIONES:');
  console.log('='.repeat(20));
  console.log('1. 🖱️ Haz clic en cada URL de búsqueda');
  console.log('2. 🎯 Ubica El Pollo Loco en el mapa');
  console.log('3. 📍 Haz clic derecho en el restaurante');
  console.log('4. 📋 Copia las coordenadas que aparecen');
  console.log('5. ✅ Anota código + coordenadas para aplicar después');
  console.log('');

  // Generar URLs para sucursales prioritarias primero
  const sucursalesPrioritarias = TODAS_LAS_SUCURSALES.filter(s => 
    ['2247000', '2247003', '2247006', '2247010', '2247016', '2247017', '2247030', '2247037', '2247040'].includes(s.codigo)
  );

  console.log('🚨 SUCURSALES PRIORITARIAS (las que están muy mal ubicadas):');
  console.log('='.repeat(60));

  sucursalesPrioritarias.forEach((sucursal, index) => {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(sucursal.busqueda)}`;
    const placeUrl = `https://www.google.com/maps/search/${encodeURIComponent(sucursal.direccion_aprox)}`;
    
    console.log(`${index + 1}. [${sucursal.codigo}] ${sucursal.nombre}`);
    console.log(`   🏢 Grupo: ${sucursal.grupo}`);
    console.log(`   🔍 Búsqueda específica: ${searchUrl}`);
    console.log(`   📍 Búsqueda por área: ${placeUrl}`);
    console.log(`   📝 ANOTA AQUÍ → LAT: _______, LNG: _______`);
    console.log('');
  });

  console.log('📋 TODAS LAS DEMÁS SUCURSALES:');
  console.log('='.repeat(35));
  
  const otrasSuccursales = TODAS_LAS_SUCURSALES.filter(s => 
    !sucursalesPrioritarias.some(p => p.codigo === s.codigo)
  );

  otrasSuccursales.forEach((sucursal, index) => {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(sucursal.busqueda)}`;
    
    console.log(`${index + 1}. [${sucursal.codigo}] ${sucursal.nombre} (${sucursal.grupo})`);
    console.log(`   🔍 ${searchUrl}`);
    console.log('');
  });

  console.log('💡 DESPUÉS DE OBTENER LAS COORDENADAS:');
  console.log('='.repeat(40));
  console.log('Ejecuta:');
  console.log('node aplicar-coordenadas-manuales.js');
  console.log('');
  console.log('📊 ESTADÍSTICAS:');
  console.log(`   • Sucursales prioritarias: ${sucursalesPrioritarias.length}`);
  console.log(`   • Todas las sucursales: ${TODAS_LAS_SUCURSALES.length}`);
  console.log(`   • Estimado de tiempo manual: ~${TODAS_LAS_SUCURSALES.length * 2} minutos`);
  console.log('');
  console.log('⚡ RECOMENDACIÓN:');
  console.log('   Mejor obtén Google Maps API key - será 100x más rápido');
  console.log('   Costo estimado: ~$0.40 USD para todas las sucursales');
}

if (require.main === module) {
  generarUrlsMapsParaBusqueda();
}

module.exports = { generarUrlsMapsParaBusqueda };