require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs');

/**
 * OBTENEDOR DE COORDENADAS INDIVIDUALES DE ZENPUT
 * Obtiene coordenadas específicas para cada location desde diferentes endpoints
 */

async function getZenputLocationDetails() {
  console.log('📍 OBTENIENDO COORDENADAS INDIVIDUALES DE ZENPUT');
  console.log('Probando múltiples endpoints para coordenadas');
  console.log('='.repeat(60));

  const zenputApiKey = process.env.ZENPUT_API_KEY;
  
  if (!zenputApiKey) {
    throw new Error('ZENPUT_API_KEY no está configurado');
  }

  const headers = { 'X-API-TOKEN': zenputApiKey, 'Accept': 'application/json' };

  try {
    // Primero cargar la data de locations ya obtenida
    const rawDataPath = '/Users/robertodavila/pollo-loco-tracking-gps/coordenadas-zenput-real.json';
    let zenputRawData = [];
    
    try {
      const rawFile = fs.readFileSync(rawDataPath, 'utf8');
      const rawJson = JSON.parse(rawFile);
      zenputRawData = rawJson.raw_zenput_data || [];
      console.log(`✅ Cargadas ${zenputRawData.length} locations desde archivo previo`);
    } catch (e) {
      console.log('⚠️ No se pudo cargar data previa, obteniendo desde API...');
      // Si no existe el archivo, obtener locations de nuevo
      const response = await axios.get('https://app.zenput.com/api/v3/locations', { headers });
      zenputRawData = response.data.data || [];
    }

    // Endpoint potenciales para coordenadas
    const coordinateEndpoints = [
      '/api/v3/locations/{id}',
      '/api/v3/locations/{id}/details',
      '/api/v3/locations/{id}/coordinates',
      '/api/v2/locations/{id}',
      '/api/locations/{id}',
      '/api/locations/{id}/coordinates'
    ];

    const locationsWithCoords = [];
    const failedLocations = [];

    console.log('🔄 Probando obtener coordenadas individuales...');
    console.log(`📋 Procesando ${Math.min(zenputRawData.length, 10)} locations para prueba\n`);

    // Probar con las primeras 10 locations
    for (let i = 0; i < Math.min(zenputRawData.length, 10); i++) {
      const location = zenputRawData[i];
      const locationId = location.id;
      const locationName = location.name;
      
      console.log(`${i + 1}. [${locationId}] ${locationName}`);

      let coordinatesFound = false;

      // Probar cada endpoint
      for (const endpointTemplate of coordinateEndpoints) {
        if (coordinatesFound) break;

        const endpoint = `https://app.zenput.com${endpointTemplate.replace('{id}', locationId)}`;
        
        try {
          const response = await axios.get(endpoint, { headers, timeout: 5000 });
          
          if (response.status === 200 && response.data) {
            const data = response.data.data || response.data;
            
            // Buscar coordenadas en diferentes formatos
            const lat = data.latitude || data.lat || data.location?.latitude || data.coordinates?.lat;
            const lng = data.longitude || data.lng || data.location?.longitude || data.coordinates?.lng;
            
            if (lat && lng) {
              console.log(`   ✅ Coordenadas encontradas en: ${endpoint}`);
              console.log(`   📍 ${lat}, ${lng}`);
              
              locationsWithCoords.push({
                id: locationId,
                name: locationName,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                address: location.address,
                city: location.city,
                state: location.state,
                endpoint: endpoint,
                source: 'zenput_api'
              });
              
              coordinatesFound = true;
            } else {
              console.log(`   ⚠️ ${endpoint}: Sin coordenadas en respuesta`);
            }
          }
        } catch (error) {
          const status = error.response?.status || 'error';
          console.log(`   ❌ ${endpoint}: ${status}`);
        }
      }

      if (!coordinatesFound) {
        console.log(`   🔴 No se encontraron coordenadas para ${locationName}`);
        failedLocations.push({ id: locationId, name: locationName });
      }
      
      console.log('');
      
      // Pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('📊 RESUMEN DE OBTENCIÓN DE COORDENADAS:');
    console.log('='.repeat(45));
    console.log(`✅ Con coordenadas: ${locationsWithCoords.length}`);
    console.log(`❌ Sin coordenadas: ${failedLocations.length}`);
    console.log(`📋 Total procesadas: ${Math.min(zenputRawData.length, 10)}`);
    console.log('');

    if (locationsWithCoords.length > 0) {
      console.log('🎯 UBICACIONES CON COORDENADAS ENCONTRADAS:');
      console.log('='.repeat(45));
      
      locationsWithCoords.forEach(loc => {
        console.log(`[${loc.id}] ${loc.name}`);
        console.log(`   📍 ${loc.lat}, ${loc.lng}`);
        console.log(`   🏠 ${loc.address}`);
        console.log(`   🌎 ${loc.city}, ${loc.state}`);
        console.log(`   🔗 ${loc.endpoint}`);
        console.log('');
      });

      // Si encontramos un endpoint que funciona, procesar todas las locations
      if (locationsWithCoords.length > 0) {
        const workingEndpoint = locationsWithCoords[0].endpoint.replace(/\/\d+$/, '/{id}');
        console.log(`🚀 ¡Endpoint funcional encontrado! ${workingEndpoint}`);
        console.log('¿Procesar todas las 83 locations? (Esto puede tomar unos minutos)');
        
        return await processAllLocations(zenputRawData, workingEndpoint, headers);
      }
    } else {
      console.log('❌ No se encontraron coordenadas en ningún endpoint');
      console.log('💡 Las coordenadas podrían estar en un endpoint diferente o requerir otros parámetros');
      
      // Intentar endpoints alternativos
      console.log('\n🔄 Probando endpoints alternativos...');
      return await tryAlternativeEndpoints(zenputRawData.slice(0, 3), headers);
    }

  } catch (error) {
    console.error('❌ Error obteniendo coordenadas:', error.message);
    throw error;
  }
}

async function processAllLocations(locations, endpointTemplate, headers) {
  console.log('\n🚀 PROCESANDO TODAS LAS 83 LOCATIONS...');
  console.log('='.repeat(45));
  
  const allCoordinates = [];
  const batchSize = 5;
  
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    
    console.log(`🔄 Lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(locations.length/batchSize)} (${i + 1}-${i + batch.length})`);
    
    const promises = batch.map(async (location) => {
      try {
        const endpoint = endpointTemplate.replace('{id}', location.id);
        const response = await axios.get(`https://app.zenput.com${endpoint}`, { headers });
        
        const data = response.data.data || response.data;
        const lat = data.latitude || data.lat || data.location?.latitude;
        const lng = data.longitude || data.lng || data.location?.longitude;
        
        if (lat && lng) {
          return {
            id: location.id,
            name: location.name,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            address: location.address,
            city: location.city,
            state: location.state
          };
        }
      } catch (error) {
        console.log(`   ❌ Error con ${location.name}: ${error.response?.status || error.message}`);
      }
      return null;
    });
    
    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);
    
    allCoordinates.push(...validResults);
    console.log(`   ✅ Obtenidas ${validResults.length}/${batch.length} coordenadas`);
    
    // Pausa entre lotes
    if (i + batchSize < locations.length) {
      console.log('   ⏳ Pausa de 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return allCoordinates;
}

async function tryAlternativeEndpoints(sampleLocations, headers) {
  console.log('🔍 INTENTANDO ENDPOINTS ALTERNATIVOS...');
  
  const alternativeEndpoints = [
    'https://app.zenput.com/api/v3/forms',
    'https://app.zenput.com/api/v3/submissions',
    'https://app.zenput.com/api/v3/location_data',
    'https://app.zenput.com/api/v2/locations',
    'https://api.zenput.com/v3/locations'
  ];
  
  for (const endpoint of alternativeEndpoints) {
    try {
      console.log(`🔄 Probando: ${endpoint}`);
      const response = await axios.get(endpoint, { headers });
      
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📄 Estructura: ${JSON.stringify(Object.keys(response.data)).substring(0, 100)}...`);
      
      // Buscar coordenadas en la respuesta
      const searchText = JSON.stringify(response.data).toLowerCase();
      if (searchText.includes('latitude') || searchText.includes('coordinate')) {
        console.log('   🎯 ¡Posibles coordenadas encontradas!');
        console.log(`   📄 Muestra: ${JSON.stringify(response.data).substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status || error.message}`);
    }
  }
  
  return [];
}

async function main() {
  try {
    const coordinates = await getZenputLocationDetails();
    
    if (coordinates && coordinates.length > 0) {
      console.log(`\n🎉 ¡COORDENADAS OBTENIDAS EXITOSAMENTE!`);
      console.log(`📊 Total: ${coordinates.length} locations con coordenadas`);
      
      // Guardar coordenadas
      const outputPath = '/Users/robertodavila/pollo-loco-tracking-gps/zenput-coordenadas-completas.json';
      fs.writeFileSync(outputPath, JSON.stringify({
        metadata: {
          timestamp: new Date().toISOString(),
          total_locations: coordinates.length,
          source: 'zenput_api_individual'
        },
        coordinates
      }, null, 2));
      
      console.log(`✅ Coordenadas guardadas en: ${outputPath}`);
      console.log('\n🎯 Ejecutar aplicación a tracking GPS:');
      console.log('node aplicar-zenput-coordenadas-completas.js');
    }
    
  } catch (error) {
    console.error('💥 Error crítico:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getZenputLocationDetails };