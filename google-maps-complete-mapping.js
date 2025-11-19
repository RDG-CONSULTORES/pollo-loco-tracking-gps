require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');

/**
 * MAPEO COMPLETO DE SUCURSALES EL POLLO LOCO CON GOOGLE MAPS API
 * Sistema completo para obtener coordenadas exactas de todas las sucursales
 */

// Lista completa de todas las sucursales de El Pollo Loco con información de búsqueda precisa
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
    direccion_aprox: "Guasave, Sinaloa" },

  // EXPO
  { codigo: "2247023", nombre: "24 - Exposicion", grupo: "EXPO",
    busqueda: "El Pollo Loco Exposición, Guadalupe, Nuevo León",
    direccion_aprox: "Exposición, Guadalupe, NL" },
  { codigo: "2247024", nombre: "25 - Juarez", grupo: "EXPO",
    busqueda: "El Pollo Loco Juárez, Benito Juárez, Nuevo León",
    direccion_aprox: "Benito Juárez, Nuevo León" },
  { codigo: "2247025", nombre: "26 - Cadereyta", grupo: "EXPO",
    busqueda: "El Pollo Loco Cadereyta Jiménez, Nuevo León",
    direccion_aprox: "Cadereyta Jiménez, Nuevo León" },
  { codigo: "2247026", nombre: "27 - Santiago", grupo: "EXPO",
    busqueda: "El Pollo Loco Santiago, Nuevo León",
    direccion_aprox: "Santiago, Nuevo León" },
  { codigo: "2247027", nombre: "28 - Guerrero", grupo: "EXPO",
    busqueda: "El Pollo Loco Guerrero, Nuevo Laredo, Tamaulipas",
    direccion_aprox: "Guerrero, Nuevo Laredo, Tamaulipas" },
  { codigo: "2247028", nombre: "29 - Pablo Livas", grupo: "EXPO",
    busqueda: "El Pollo Loco Pablo Livas, Guadalupe, Nuevo León",
    direccion_aprox: "Pablo Livas, Guadalupe, NL" },
  { codigo: "2247029", nombre: "30 - Carrizo", grupo: "EXPO",
    busqueda: "El Pollo Loco Carrizo, Nuevo Laredo, Tamaulipas",
    direccion_aprox: "Carrizo, Nuevo Laredo, Tamaulipas" },
  { codigo: "2247030", nombre: "31 - Las Quintas", grupo: "EXPO",
    busqueda: "El Pollo Loco Las Quintas, Guadalupe, Nuevo León",
    direccion_aprox: "Las Quintas, Guadalupe, NL" },
  { codigo: "2247031", nombre: "32 - Allende", grupo: "EXPO",
    busqueda: "El Pollo Loco Allende, Nuevo León",
    direccion_aprox: "Allende, Nuevo León" },
  { codigo: "2247032", nombre: "33 - Eloy Cavazos", grupo: "EXPO",
    busqueda: "El Pollo Loco Eloy Cavazos, Guadalupe, Nuevo León",
    direccion_aprox: "Eloy Cavazos, Guadalupe, NL" },
  { codigo: "2247033", nombre: "34 - Montemorelos", grupo: "EXPO",
    busqueda: "El Pollo Loco Montemorelos, Nuevo León",
    direccion_aprox: "Montemorelos, Nuevo León" },

  // PLOG NUEVO LEÓN
  { codigo: "2247035", nombre: "36 - Apodaca Centro", grupo: "PLOG NUEVO LEON",
    busqueda: "El Pollo Loco Apodaca Centro, Nuevo León",
    direccion_aprox: "Centro, Apodaca, NL" },
  { codigo: "2247036", nombre: "37 - Stiva", grupo: "PLOG NUEVO LEON",
    busqueda: "El Pollo Loco Stiva, Apodaca, Nuevo León",
    direccion_aprox: "Stiva, Apodaca, NL" },
  { codigo: "2247037", nombre: "38 - Gomez Morin", grupo: "PLOG NUEVO LEON",
    busqueda: "El Pollo Loco Gómez Morín, San Pedro Garza García, Nuevo León",
    direccion_aprox: "Gómez Morín, San Pedro Garza García, NL" },
  { codigo: "2247038", nombre: "39 - Lazaro Cardenas", grupo: "PLOG NUEVO LEON",
    busqueda: "El Pollo Loco Lázaro Cárdenas, Monterrey, Nuevo León",
    direccion_aprox: "Lázaro Cárdenas, Monterrey, NL" },
  { codigo: "2247039", nombre: "40 - Plaza 1500", grupo: "PLOG NUEVO LEON",
    busqueda: "El Pollo Loco Plaza 1500, Monterrey, Nuevo León",
    direccion_aprox: "Plaza 1500, Monterrey, NL" },
  { codigo: "2247040", nombre: "41 - Vasconcelos", grupo: "PLOG NUEVO LEON",
    busqueda: "El Pollo Loco Vasconcelos, San Pedro Garza García, Nuevo León",
    direccion_aprox: "Vasconcelos, San Pedro Garza García, NL" },

  // PLOG LAGUNA
  { codigo: "2247041", nombre: "42 - Independencia", grupo: "PLOG LAGUNA",
    busqueda: "El Pollo Loco Independencia, Torreón, Coahuila",
    direccion_aprox: "Independencia, Torreón, Coahuila" },
  { codigo: "2247042", nombre: "43 - Revolucion", grupo: "PLOG LAGUNA",
    busqueda: "El Pollo Loco Revolución, Torreón, Coahuila",
    direccion_aprox: "Revolución, Torreón, Coahuila" },
  { codigo: "2247043", nombre: "44 - Senderos", grupo: "PLOG LAGUNA",
    busqueda: "El Pollo Loco Senderos, Torreón, Coahuila",
    direccion_aprox: "Senderos, Torreón, Coahuila" },
  { codigo: "2247044", nombre: "45 - Triana", grupo: "PLOG LAGUNA",
    busqueda: "El Pollo Loco Triana, Torreón, Coahuila",
    direccion_aprox: "Triana, Torreón, Coahuila" },
  { codigo: "2247045", nombre: "46 - Campestre", grupo: "PLOG LAGUNA",
    busqueda: "El Pollo Loco Campestre, Torreón, Coahuila",
    direccion_aprox: "Campestre, Torreón, Coahuila" },
  { codigo: "2247046", nombre: "47 - San Antonio", grupo: "PLOG LAGUNA",
    busqueda: "El Pollo Loco San Antonio, Torreón, Coahuila",
    direccion_aprox: "San Antonio, Torreón, Coahuila" },

  // PLOG QUERÉTARO  
  { codigo: "2247047", nombre: "48 - Refugio", grupo: "PLOG QUERETARO",
    busqueda: "El Pollo Loco Refugio, Querétaro",
    direccion_aprox: "Refugio, Querétaro, Querétaro" },
  { codigo: "2247048", nombre: "49 - Pueblito", grupo: "PLOG QUERETARO",
    busqueda: "El Pollo Loco Pueblito, Querétaro",
    direccion_aprox: "Pueblito, Querétaro, Querétaro" },
  { codigo: "2247049", nombre: "50 - Patio", grupo: "PLOG QUERETARO",
    busqueda: "El Pollo Loco Patio, Querétaro",
    direccion_aprox: "Patio, Querétaro, Querétaro" },
  { codigo: "2247050", nombre: "51 - Constituyentes", grupo: "PLOG QUERETARO",
    busqueda: "El Pollo Loco Constituyentes, Querétaro",
    direccion_aprox: "Constituyentes, Querétaro, Querétaro" }
];

// Función para buscar coordenadas con Google Maps API
async function buscarCoordenadasGoogle(sucursal) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log(`⚠️ Google Maps API key no configurada. Usando modo simulación para ${sucursal.nombre}`);
    return null;
  }

  try {
    // Intentar varias búsquedas para mayor precisión
    const consultas = [
      sucursal.busqueda,
      `El Pollo Loco ${sucursal.direccion_aprox}`,
      sucursal.direccion_aprox
    ];

    for (const consulta of consultas) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(consulta)}&key=${apiKey}&region=mx`;
      
      const response = await axios.get(url);
      const data = response.data;

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        return {
          lat: location.lat,
          lng: location.lng,
          formatted_address: result.formatted_address,
          consulta_exitosa: consulta,
          precision: result.geometry.location_type
        };
      }
    }
    
    console.log(`❌ No se encontraron coordenadas para ${sucursal.nombre}`);
    return null;

  } catch (error) {
    console.error(`❌ Error buscando ${sucursal.nombre}: ${error.message}`);
    return null;
  }
}

// Función principal de mapeo completo
async function mapearTodasLasSucursales() {
  console.log('🗺️ MAPEO COMPLETO DE TODAS LAS SUCURSALES EL POLLO LOCO');
  console.log('Obteniendo coordenadas exactas con Google Maps API');
  console.log('='.repeat(70));
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ MODO SIMULACIÓN - GOOGLE_MAPS_API_KEY no configurado');
    console.log('Para usar Google Maps API real:');
    console.log('1. Obtén una API key de Google Cloud Platform');
    console.log('2. Habilita Geocoding API');
    console.log('3. Añade a .env: GOOGLE_MAPS_API_KEY=tu_api_key');
    console.log('');
  }

  const resultados = [];
  const errores = [];
  
  console.log(`📍 Procesando ${TODAS_LAS_SUCURSALES.length} sucursales...\n`);
  
  // Procesar en lotes para no saturar la API
  const tamañoLote = 5;
  
  for (let i = 0; i < TODAS_LAS_SUCURSALES.length; i += tamañoLote) {
    const lote = TODAS_LAS_SUCURSALES.slice(i, i + tamañoLote);
    
    console.log(`🔄 Procesando lote ${Math.floor(i/tamañoLote) + 1}/${Math.ceil(TODAS_LAS_SUCURSALES.length/tamañoLote)} (sucursales ${i + 1}-${Math.min(i + tamañoLote, TODAS_LAS_SUCURSALES.length)})`);
    
    const promesasLote = lote.map(async (sucursal) => {
      const coordenadas = await buscarCoordenadasGoogle(sucursal);
      
      if (coordenadas) {
        console.log(`✅ [${sucursal.codigo}] ${sucursal.nombre}`);
        console.log(`   📍 ${coordenadas.lat}, ${coordenadas.lng}`);
        console.log(`   🏷️ ${coordenadas.formatted_address}`);
        console.log('');
        
        resultados.push({
          ...sucursal,
          coordenadas
        });
      } else {
        console.log(`❌ [${sucursal.codigo}] ${sucursal.nombre} - No encontrado`);
        errores.push(sucursal);
      }
    });
    
    await Promise.all(promesasLote);
    
    // Pausa entre lotes para respetar rate limits
    if (i + tamañoLote < TODAS_LAS_SUCURSALES.length) {
      console.log('⏳ Pausa de 2 segundos entre lotes...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('📊 RESUMEN DEL MAPEO:');
  console.log('='.repeat(30));
  console.log(`✅ Éxito: ${resultados.length}/${TODAS_LAS_SUCURSALES.length} sucursales`);
  console.log(`❌ Errores: ${errores.length} sucursales`);
  console.log('');
  
  if (errores.length > 0) {
    console.log('⚠️ SUCURSALES CON PROBLEMAS:');
    errores.forEach(suc => {
      console.log(`   - [${suc.codigo}] ${suc.nombre}`);
    });
    console.log('');
  }
  
  return { resultados, errores };
}

// Función para aplicar coordenadas a la base de datos
async function aplicarCoordenadasBD(resultados) {
  console.log('💾 APLICANDO COORDENADAS A BASE DE DATOS');
  console.log('='.repeat(40));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    let aplicadas = 0;
    
    for (const sucursal of resultados) {
      try {
        const result = await client.query(`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        `, [sucursal.coordenadas.lat, sucursal.coordenadas.lng, sucursal.codigo]);
        
        if (result.rowCount > 0) {
          console.log(`✅ [${sucursal.codigo}] ${sucursal.nombre} - Coordenadas actualizadas`);
          aplicadas++;
        }
      } catch (updateError) {
        console.log(`❌ [${sucursal.codigo}] Error actualizando: ${updateError.message}`);
      }
    }
    
    console.log(`\n🎯 COORDENADAS APLICADAS: ${aplicadas}/${resultados.length}`);
    console.log('✅ Base de datos actualizada');
    
  } catch (error) {
    console.error('❌ Error conectando a base de datos:', error.message);
  } finally {
    await client.end();
  }
}

// Función principal
async function main() {
  try {
    const { resultados, errores } = await mapearTodasLasSucursales();
    
    if (resultados.length > 0) {
      await aplicarCoordenadasBD(resultados);
      
      // Guardar resultados para referencia
      const fs = require('fs');
      fs.writeFileSync(
        '/Users/robertodavila/pollo-loco-tracking-gps/coordenadas-google-maps.json',
        JSON.stringify({ resultados, errores, timestamp: new Date().toISOString() }, null, 2)
      );
      
      console.log('\n🎉 MAPEO COMPLETADO');
      console.log('Resultados guardados en: coordenadas-google-maps.json');
      console.log('\n🌐 Verifica el dashboard:');
      console.log('https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    } else {
      console.log('\n❌ No se obtuvieron coordenadas. Revisa la configuración de Google Maps API');
    }
    
  } catch (error) {
    console.error('💥 Error crítico:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { mapearTodasLasSucursales, aplicarCoordenadasBD };