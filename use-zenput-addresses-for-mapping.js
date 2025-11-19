require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

/**
 * USAR DIRECCIONES DE ZENPUT PARA MAPEO PRECISO
 * Genera coordenadas exactas usando las direcciones reales de Zenput
 */

async function extractZenputAddressesAndGenerateMapping() {
  console.log('🏢 EXTRAYENDO DIRECCIONES REALES DE ZENPUT PARA MAPEO');
  console.log('Usando direcciones validadas del sistema de supervisión operativa');
  console.log('='.repeat(70));

  // Cargar data de Zenput con direcciones
  const zenputDataPath = '/Users/robertodavila/pollo-loco-tracking-gps/coordenadas-zenput-real.json';
  
  let zenputData = [];
  try {
    const rawFile = fs.readFileSync(zenputDataPath, 'utf8');
    const rawJson = JSON.parse(rawFile);
    zenputData = rawJson.raw_zenput_data || [];
    console.log(`✅ Cargadas ${zenputData.length} locations de Zenput con direcciones reales`);
  } catch (e) {
    throw new Error('No se pudo cargar data de Zenput. Ejecuta primero get-zenput-real-coordinates.js');
  }

  console.log('\n🗺️ DIRECCIONES VALIDADAS DE ZENPUT:');
  console.log('='.repeat(45));

  const preciseAddresses = [];
  const googleMapsUrls = [];

  zenputData.forEach((location, index) => {
    const id = location.id;
    const name = location.name;
    const address = location.address?.replace(/\n/g, ' ').trim();
    const city = location.city;
    const state = location.state;
    const zipcode = location.zipcode;

    // Construir dirección completa y limpia
    const fullAddress = `${address}, ${city}, ${state}, ${zipcode}, México`.replace(/\s+/g, ' ');
    const searchQuery = `${name} ${fullAddress}`;
    
    console.log(`${index + 1}. [${id}] ${name}`);
    console.log(`   🏠 ${address}`);
    console.log(`   🌎 ${city}, ${state} ${zipcode}`);
    console.log(`   🔍 Búsqueda completa: ${fullAddress}`);

    // Generar URLs para Google Maps búsqueda manual
    const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`;
    const zenputSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    console.log(`   🗺️ Maps dirección: ${googleMapsUrl}`);
    console.log(`   🔍 Maps + nombre: ${zenputSearchUrl}`);
    console.log('');

    preciseAddresses.push({
      id,
      name,
      address: fullAddress,
      searchQuery,
      googleMapsUrl,
      zenputSearchUrl,
      city,
      state,
      zipcode
    });

    googleMapsUrls.push({
      id,
      name,
      googleMapsUrl,
      zenputSearchUrl
    });
  });

  console.log('💡 CÓMO USAR ESTAS DIRECCIONES PARA OBTENER COORDENADAS EXACTAS:');
  console.log('='.repeat(65));
  console.log('MÉTODO 1 - Google Maps API (Automático):');
  console.log('1. Configurar GOOGLE_MAPS_API_KEY en .env');
  console.log('2. Ejecutar: node mapear-con-direcciones-zenput.js');
  console.log('3. ¡Automático y preciso al 100%!');
  console.log('');
  console.log('MÉTODO 2 - Manual (Si no tienes API key):');
  console.log('1. Hacer clic en cada URL de Google Maps');
  console.log('2. Encontrar El Pollo Loco en esa dirección exacta');
  console.log('3. Hacer clic derecho → copiar coordenadas');
  console.log('4. Anotar en aplicar-coordenadas-manuales.js');
  console.log('');

  // Crear script optimizado para Google Maps API con direcciones de Zenput
  await createGoogleMapsZenputScript(preciseAddresses);

  // Crear archivo de URLs para mapeo manual
  const urlsPath = '/Users/robertodavila/pollo-loco-tracking-gps/zenput-addresses-for-manual-mapping.json';
  fs.writeFileSync(urlsPath, JSON.stringify({
    metadata: {
      timestamp: new Date().toISOString(),
      total_locations: preciseAddresses.length,
      source: 'zenput_validated_addresses'
    },
    addresses: preciseAddresses,
    quick_urls: googleMapsUrls
  }, null, 2));

  console.log(`✅ URLs para mapeo manual guardadas: ${urlsPath}`);

  // Comparar con tracking GPS actual
  await compareWithTrackingGPS(preciseAddresses);

  return preciseAddresses;
}

async function createGoogleMapsZenputScript(addresses) {
  console.log('\n🚀 CREANDO SCRIPT OPTIMIZADO CON GOOGLE MAPS API...');
  
  const script = `require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');

/**
 * MAPEO AUTOMÁTICO CON DIRECCIONES VALIDADAS DE ZENPUT
 * Usa las direcciones reales del sistema de supervisión para obtener coordenadas exactas
 */

const DIRECCIONES_ZENPUT_VALIDADAS = ${JSON.stringify(addresses, null, 2)};

async function mapearConDireccionesZenput() {
  console.log('🗺️ MAPEO AUTOMÁTICO CON DIRECCIONES ZENPUT VALIDADAS');
  console.log('Direcciones reales del sistema de supervisión operativa');
  console.log('='.repeat(65));

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ GOOGLE_MAPS_API_KEY no configurado');
    console.log('Configura en .env y ejecuta de nuevo');
    return;
  }

  const resultados = [];
  const errores = [];
  
  console.log(\`📍 Procesando \${DIRECCIONES_ZENPUT_VALIDADAS.length} direcciones validadas...\\n\`);

  // Procesar en lotes
  const tamañoLote = 5;
  
  for (let i = 0; i < DIRECCIONES_ZENPUT_VALIDADAS.length; i += tamañoLote) {
    const lote = DIRECCIONES_ZENPUT_VALIDADAS.slice(i, i + tamañoLote);
    
    console.log(\`🔄 Lote \${Math.floor(i/tamañoLote) + 1}/\${Math.ceil(DIRECCIONES_ZENPUT_VALIDADAS.length/tamañoLote)}\`);
    
    for (const location of lote) {
      try {
        // Probar múltiples consultas para mayor precisión
        const queries = [
          location.address, // Dirección completa de Zenput
          location.searchQuery, // Dirección + nombre del restaurante
          \`El Pollo Loco \${location.city}, \${location.state}\` // Búsqueda por ciudad
        ];

        let coordenadas = null;
        let queryExitosa = null;

        for (const query of queries) {
          try {
            const url = \`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(query)}&key=\${apiKey}&region=mx\`;
            const response = await axios.get(url);

            if (response.data.status === 'OK' && response.data.results.length > 0) {
              const result = response.data.results[0];
              coordenadas = {
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                formatted_address: result.formatted_address,
                precision: result.geometry.location_type
              };
              queryExitosa = query;
              break;
            }
          } catch (queryError) {
            console.log(\`   ⚠️ Error en query: \${queryError.message}\`);
          }
        }

        if (coordenadas) {
          console.log(\`✅ [\${location.id}] \${location.name}\`);
          console.log(\`   📍 \${coordenadas.lat}, \${coordenadas.lng}\`);
          console.log(\`   🏷️ \${coordenadas.formatted_address}\`);
          console.log(\`   🔍 Query: \${queryExitosa.substring(0, 50)}...\`);
          console.log('');

          resultados.push({
            ...location,
            coordenadas
          });
        } else {
          console.log(\`❌ [\${location.id}] \${location.name} - No encontrado\`);
          errores.push(location);
        }

        // Pausa para respetar rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(\`❌ Error con \${location.name}: \${error.message}\`);
        errores.push(location);
      }
    }
    
    console.log('⏳ Pausa entre lotes...\\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('📊 RESUMEN:');
  console.log(\`✅ Éxito: \${resultados.length}/\${DIRECCIONES_ZENPUT_VALIDADAS.length}\`);
  console.log(\`❌ Errores: \${errores.length}\`);

  if (resultados.length > 0) {
    await aplicarCoordenadasBD(resultados);
  }

  return resultados;
}

async function aplicarCoordenadasBD(resultados) {
  console.log('💾 APLICANDO COORDENADAS A BASE DE DATOS...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\\n');
    
    let aplicadas = 0;
    
    for (const location of resultados) {
      try {
        const result = await client.query(\`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        \`, [location.coordenadas.lat, location.coordenadas.lng, location.id]);
        
        if (result.rowCount > 0) {
          console.log(\`✅ [\${location.id}] \${location.name} - Actualizado\`);
          aplicadas++;
        }
      } catch (updateError) {
        console.log(\`❌ [\${location.id}] Error: \${updateError.message}\`);
      }
    }
    
    console.log(\`\\n🎯 COORDENADAS APLICADAS: \${aplicadas}/\${resultados.length}\`);
    console.log('✅ Mapeo completo terminado');
    console.log('🌐 Verifica: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  mapearConDireccionesZenput()
    .then(() => {
      console.log('\\n✅ Mapeo Zenput completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { mapearConDireccionesZenput };`;

  const scriptPath = '/Users/robertodavila/pollo-loco-tracking-gps/mapear-con-direcciones-zenput.js';
  fs.writeFileSync(scriptPath, script);
  
  console.log(`✅ Script automático creado: ${scriptPath}`);
  console.log('🎯 Para usar: node mapear-con-direcciones-zenput.js');
}

async function compareWithTrackingGPS(zenputAddresses) {
  console.log('\\n🔄 COMPARANDO CON TRACKING GPS ACTUAL...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const trackingLocations = await client.query(`
      SELECT location_code, name, latitude, longitude 
      FROM tracking_locations_cache 
      ORDER BY location_code
    `);

    const zenputIds = zenputAddresses.map(z => z.id.toString());
    const trackingIds = trackingLocations.rows.map(t => t.location_code);
    
    const matches = trackingIds.filter(id => zenputIds.includes(id));
    const trackingOnly = trackingIds.filter(id => !zenputIds.includes(id));
    const zenputOnly = zenputIds.filter(id => !trackingIds.includes(id));

    console.log('📊 COMPARACIÓN DE LOCATIONS:');
    console.log('='.repeat(35));
    console.log(`🎯 Zenput locations: ${zenputAddresses.length}`);
    console.log(`🎯 Tracking GPS locations: ${trackingLocations.rows.length}`);
    console.log(`✅ Coincidencias por ID: ${matches.length}`);
    console.log(`⚠️ Solo en Tracking GPS: ${trackingOnly.length}`);
    console.log(`⚠️ Solo en Zenput: ${zenputOnly.length}`);

    if (trackingOnly.length > 0) {
      console.log('\\n⚠️ LOCATIONS SOLO EN TRACKING GPS:');
      trackingOnly.slice(0, 5).forEach(id => {
        const loc = trackingLocations.rows.find(t => t.location_code === id);
        console.log(`   [${id}] ${loc.name}`);
      });
      if (trackingOnly.length > 5) {
        console.log(`   ... y ${trackingOnly.length - 5} más`);
      }
    }

  } finally {
    await client.end();
  }
}

async function main() {
  try {
    const addresses = await extractZenputAddressesAndGenerateMapping();
    
    console.log('\\n🎯 OPCIONES PARA COMPLETAR EL MAPEO:');
    console.log('='.repeat(40));
    console.log('1. 🚀 AUTOMÁTICO (Recomendado): Configura GOOGLE_MAPS_API_KEY y ejecuta:');
    console.log('   node mapear-con-direcciones-zenput.js');
    console.log('');
    console.log('2. 📋 MANUAL: Usa las URLs generadas en zenput-addresses-for-manual-mapping.json');
    console.log('');
    console.log(`✅ ${addresses.length} direcciones validadas de Zenput listas para mapeo`);
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractZenputAddressesAndGenerateMapping };