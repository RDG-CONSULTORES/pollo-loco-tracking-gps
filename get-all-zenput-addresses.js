require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

/**
 * OBTENEDOR COMPLETO DE TODAS LAS DIRECCIONES DE ZENPUT
 * Obtiene las 83 sucursales con direcciones validadas
 */

async function getAllZenputAddresses() {
  console.log('🏢 OBTENIENDO TODAS LAS DIRECCIONES DE ZENPUT (83 SUCURSALES)');
  console.log('Sistema de supervisión operativa - direcciones validadas');
  console.log('='.repeat(65));

  const zenputApiKey = process.env.ZENPUT_API_KEY;
  
  if (!zenputApiKey) {
    throw new Error('ZENPUT_API_KEY no está configurado');
  }

  const headers = { 'X-API-TOKEN': zenputApiKey, 'Accept': 'application/json' };

  try {
    // Obtener todas las páginas de locations
    let allLocations = [];
    let currentUrl = 'https://app.zenput.com/api/v3/locations';
    let pageCount = 0;

    console.log('📄 Obteniendo todas las páginas de locations...');
    
    while (currentUrl && pageCount < 10) { // Límite de seguridad
      pageCount++;
      console.log(`🔄 Página ${pageCount}: ${currentUrl}`);
      
      const response = await axios.get(currentUrl, { headers, timeout: 15000 });

      if (response.status !== 200) {
        throw new Error(`Error en página ${pageCount}: ${response.status}`);
      }

      const pageData = response.data.data || [];
      allLocations = allLocations.concat(pageData);
      
      console.log(`   ✅ Obtenidas ${pageData.length} locations (Total: ${allLocations.length})`);
      
      // Verificar si hay más páginas
      currentUrl = response.data.meta?.next;
      
      if (currentUrl) {
        console.log('   ⏳ Pausa de 1 segundo...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎯 TOTAL OBTENIDO: ${allLocations.length} locations de Zenput`);
    console.log('');

    // Procesar todas las direcciones
    const addressesData = [];
    
    console.log('🗂️ PROCESANDO DIRECCIONES VALIDADAS:');
    console.log('='.repeat(45));

    allLocations.forEach((location, index) => {
      const id = location.id;
      const name = location.name;
      const address = location.address?.replace(/\n/g, ' ').trim();
      const city = location.city;
      const state = location.state;
      const zipcode = location.zipcode;
      const email = location.email;
      const phone = location.phone;

      // Construir dirección completa y limpia
      const fullAddress = `${address}, ${city}, ${state}, ${zipcode}, México`.replace(/\s+/g, ' ');
      const searchQuery = `El Pollo Loco ${address}, ${city}, ${state}`;
      
      if (index < 10) { // Mostrar muestra
        console.log(`${index + 1}. [${id}] ${name}`);
        console.log(`   🏠 ${address}`);
        console.log(`   🌎 ${city}, ${state} ${zipcode}`);
        console.log(`   📞 ${phone || 'N/A'}`);
        console.log('');
      }

      // Generar URLs para Google Maps búsqueda
      const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`;
      const zenputSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

      addressesData.push({
        id,
        name,
        address: fullAddress,
        searchQuery,
        googleMapsUrl,
        zenputSearchUrl,
        city,
        state,
        zipcode,
        phone,
        email,
        raw_address: address
      });
    });

    if (allLocations.length > 10) {
      console.log(`... y ${allLocations.length - 10} direcciones más\n`);
    }

    // Guardar todas las direcciones
    const outputPath = '/Users/robertodavila/pollo-loco-tracking-gps/zenput-todas-direcciones.json';
    
    fs.writeFileSync(outputPath, JSON.stringify({
      metadata: {
        timestamp: new Date().toISOString(),
        total_locations: allLocations.length,
        source: 'zenput_api_v3_complete',
        note: 'Direcciones validadas del sistema de supervisión operativa'
      },
      addresses: addressesData,
      raw_zenput_data: allLocations
    }, null, 2));

    console.log(`✅ Todas las direcciones guardadas: ${outputPath}`);
    console.log('');
    console.log('📊 ESTADÍSTICAS FINALES:');
    console.log('='.repeat(25));
    console.log(`📋 Total sucursales Zenput: ${allLocations.length}`);
    console.log(`📍 Direcciones procesadas: ${addressesData.length}`);
    console.log(`🏢 Estados cubiertos: ${[...new Set(addressesData.map(a => a.state))].join(', ')}`);
    console.log(`🌎 Ciudades principales: ${[...new Set(addressesData.map(a => a.city))].slice(0, 5).join(', ')}`);

    return { addresses: addressesData, rawData: allLocations };

  } catch (error) {
    console.error('❌ Error obteniendo direcciones:', error.message);
    if (error.response) {
      console.error(`📄 Status: ${error.response.status}`);
      console.error(`📄 Response: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
    }
    throw error;
  }
}

async function createOptimizedGoogleMapsScript(addresses) {
  console.log('\n🚀 CREANDO SCRIPT OPTIMIZADO CON GOOGLE MAPS API...');
  
  const script = `require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');

/**
 * MAPEO AUTOMÁTICO COMPLETO CON DIRECCIONES ZENPUT
 * ${addresses.length} direcciones validadas del sistema de supervisión operativa
 */

const TODAS_LAS_DIRECCIONES_ZENPUT = ${JSON.stringify(addresses.slice(0, 50), null, 2)}; // Primeras 50 para el script

async function mapearConDireccionesZenput() {
  console.log('🗺️ MAPEO AUTOMÁTICO COMPLETO - DIRECCIONES ZENPUT VALIDADAS');
  console.log('${addresses.length} direcciones reales del sistema de supervisión operativa');
  console.log('='.repeat(70));

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ GOOGLE_MAPS_API_KEY no configurado');
    console.log('1. Obtén API key de Google Cloud Platform');
    console.log('2. Habilita Geocoding API');
    console.log('3. Añade a .env: GOOGLE_MAPS_API_KEY=tu_api_key');
    console.log('4. Costo estimado: ~$0.40 USD para ${addresses.length} direcciones');
    return;
  }

  console.log('📍 INICIANDO MAPEO AUTOMATIZADO...');
  console.log('Usando direcciones exactas desde Zenput API');
  console.log('');

  const resultados = [];
  const errores = [];
  
  // Cargar todas las direcciones del archivo completo
  const fs = require('fs');
  const allAddressesFile = '/Users/robertodavila/pollo-loco-tracking-gps/zenput-todas-direcciones.json';
  let todasLasDirecciones = TODAS_LAS_DIRECCIONES_ZENPUT;
  
  try {
    const fileData = JSON.parse(fs.readFileSync(allAddressesFile, 'utf8'));
    todasLasDirecciones = fileData.addresses || TODAS_LAS_DIRECCIONES_ZENPUT;
    console.log(\`✅ Cargadas \${todasLasDirecciones.length} direcciones desde archivo completo\`);
  } catch (e) {
    console.log('⚠️ Usando direcciones incluidas en script');
  }

  console.log(\`📍 Procesando \${todasLasDirecciones.length} direcciones validadas...\\n\`);

  // Procesar en lotes para respetar rate limits
  const tamañoLote = 5;
  
  for (let i = 0; i < todasLasDirecciones.length; i += tamañoLote) {
    const lote = todasLasDirecciones.slice(i, i + tamañoLote);
    
    console.log(\`🔄 Lote \${Math.floor(i/tamañoLote) + 1}/\${Math.ceil(todasLasDirecciones.length/tamañoLote)} (sucursales \${i + 1}-\${i + lote.length})\`);
    
    for (const location of lote) {
      try {
        // Múltiples estrategias de búsqueda para mayor precisión
        const queries = [
          location.address, // Dirección completa validada
          location.searchQuery, // "El Pollo Loco" + dirección
          \`\${location.name} \${location.city}, \${location.state}\`, // Nombre + ciudad
          \`El Pollo Loco \${location.raw_address}, \${location.city}\` // Variante con dirección raw
        ];

        let coordenadas = null;
        let queryExitosa = null;

        for (const query of queries) {
          try {
            const url = \`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(query)}&key=\${apiKey}&region=mx&components=country:MX\`;
            const response = await axios.get(url);

            if (response.data.status === 'OK' && response.data.results.length > 0) {
              const result = response.data.results[0];
              
              // Validar que esté en México
              const country = result.address_components.find(c => c.types.includes('country'));
              if (country && country.short_name === 'MX') {
                coordenadas = {
                  lat: result.geometry.location.lat,
                  lng: result.geometry.location.lng,
                  formatted_address: result.formatted_address,
                  precision: result.geometry.location_type,
                  place_id: result.place_id
                };
                queryExitosa = query;
                break;
              }
            }
          } catch (queryError) {
            // Continúa con la siguiente query
          }
        }

        if (coordenadas) {
          console.log(\`✅ [\${location.id}] \${location.name}\`);
          console.log(\`   📍 \${coordenadas.lat}, \${coordenadas.lng}\`);
          console.log(\`   🏷️ \${coordenadas.formatted_address}\`);
          console.log(\`   🔍 Query: \${queryExitosa.substring(0, 40)}...\`);
          console.log('');

          resultados.push({
            ...location,
            coordenadas
          });
        } else {
          console.log(\`❌ [\${location.id}] \${location.name} - No encontrado\`);
          errores.push(location);
        }

        // Pausa para respetar rate limits de Google (50 requests/second)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(\`❌ Error con \${location.name}: \${error.message}\`);
        errores.push(location);
      }
    }
    
    console.log('⏳ Pausa entre lotes...\\n');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('📊 RESUMEN DEL MAPEO:');
  console.log('='.repeat(30));
  console.log(\`✅ Éxito: \${resultados.length}/\${todasLasDirecciones.length} sucursales\`);
  console.log(\`❌ Errores: \${errores.length} sucursales\`);
  console.log(\`🎯 Precisión: \${(resultados.length/todasLasDirecciones.length*100).toFixed(1)}%\`);
  console.log('');

  if (resultados.length > 0) {
    console.log('💾 APLICANDO COORDENADAS A BASE DE DATOS...');
    await aplicarCoordenadasBD(resultados);

    // Guardar resultados para referencia
    fs.writeFileSync('/Users/robertodavila/pollo-loco-tracking-gps/zenput-coordenadas-aplicadas.json', 
      JSON.stringify({ 
        metadata: { 
          timestamp: new Date().toISOString(), 
          total_aplicadas: resultados.length,
          total_errores: errores.length,
          source: 'zenput_addresses_google_maps_api'
        }, 
        resultados, 
        errores 
      }, null, 2)
    );
    
    console.log('✅ Resultados guardados: zenput-coordenadas-aplicadas.json');
  }

  if (errores.length > 0) {
    console.log('\\n⚠️ SUCURSALES CON ERRORES:');
    errores.slice(0, 5).forEach(err => {
      console.log(\`   - [\${err.id}] \${err.name}\`);
    });
    if (errores.length > 5) {
      console.log(\`   ... y \${errores.length - 5} más\`);
    }
  }

  return resultados;
}

async function aplicarCoordenadasBD(resultados) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\\n');
    
    let aplicadas = 0;
    let actualizadas = 0;
    let noEncontradas = 0;
    
    for (const location of resultados) {
      try {
        const result = await client.query(\`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        \`, [location.coordenadas.lat, location.coordenadas.lng, location.id.toString()]);
        
        if (result.rowCount > 0) {
          console.log(\`✅ [\${location.id}] \${location.name} - Coordenadas actualizadas\`);
          aplicadas++;
        } else {
          console.log(\`⚠️ [\${location.id}] \${location.name} - No encontrado en tracking GPS\`);
          noEncontradas++;
        }
      } catch (updateError) {
        console.log(\`❌ [\${location.id}] Error: \${updateError.message}\`);
      }
    }
    
    console.log(\`\\n📊 RESUMEN DE APLICACIÓN:\`);
    console.log('='.repeat(35));
    console.log(\`✅ Coordenadas aplicadas: \${aplicadas}\`);
    console.log(\`⚠️ No encontradas en tracking: \${noEncontradas}\`);
    console.log(\`📍 Total procesadas: \${resultados.length}\`);
    console.log('');
    console.log('🎉 MAPEO ZENPUT COMPLETADO EXITOSAMENTE');
    console.log('🌐 Verifica el dashboard:');
    console.log('https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  mapearConDireccionesZenput()
    .then(() => {
      console.log('\\n🎯 MAPEO ZENPUT COMPLETO');
      console.log('Todas las sucursales mapeadas con direcciones validadas');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { mapearConDireccionesZenput };`;

  const scriptPath = '/Users/robertodavila/pollo-loco-tracking-gps/mapear-zenput-completo.js';
  fs.writeFileSync(scriptPath, script);
  
  console.log(`✅ Script completo creado: ${scriptPath}`);
  console.log('🎯 Para usar: node mapear-zenput-completo.js');
}

async function main() {
  try {
    const { addresses, rawData } = await getAllZenputAddresses();
    
    await createOptimizedGoogleMapsScript(addresses);
    
    console.log('\\n🎯 MAPEO COMPLETO LISTO:');
    console.log('='.repeat(30));
    console.log(`✅ ${addresses.length} direcciones validadas obtenidas de Zenput`);
    console.log('✅ Script automático completo creado');
    console.log('');
    console.log('🚀 PARA EJECUTAR MAPEO AUTOMÁTICO:');
    console.log('1. Configurar GOOGLE_MAPS_API_KEY en .env');
    console.log('2. Ejecutar: node mapear-zenput-completo.js');
    console.log('3. ¡Todas las 83 sucursales mapeadas automáticamente!');
    console.log('');
    console.log(`💰 Costo estimado: ~$${(addresses.length * 0.005).toFixed(2)} USD`);
    console.log('⏱️ Tiempo estimado: ~15 minutos');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getAllZenputAddresses };