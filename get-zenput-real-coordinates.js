require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');

/**
 * EXTRACTOR DE COORDENADAS REALES DESDE ZENPUT API
 * Obtiene las ubicaciones exactas desde el sistema de supervisión operativa
 */

async function getZenputLocations() {
  console.log('🏢 OBTENIENDO LOCATIONS REALES DESDE ZENPUT API');
  console.log('Sistema de supervisión operativa - coordenadas validadas');
  console.log('='.repeat(65));

  const zenputApiKey = process.env.ZENPUT_API_KEY;
  
  if (!zenputApiKey) {
    throw new Error('ZENPUT_API_KEY no está configurado en .env');
  }

  try {
    console.log('🔗 Conectando a Zenput API...');
    
    // Configurar headers para Zenput API - formato directo
    const headers = {
      'X-API-TOKEN': zenputApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Configuración exitosa conocida
    const successfulConfig = {
      endpoint: 'https://app.zenput.com/api/v3/locations',
      authFormat: { headers: { 'X-API-TOKEN': zenputApiKey, 'Accept': 'application/json' } }
    };

    // Obtener todas las páginas de locations
    let allLocations = [];
    let currentUrl = successfulConfig.endpoint;
    let pageCount = 0;

    console.log('📄 Obteniendo todas las páginas de locations...');
    
    while (currentUrl && pageCount < 10) { // Límite de seguridad
      pageCount++;
      console.log(`🔄 Página ${pageCount}: ${currentUrl}`);
      
      const response = await axios.get(currentUrl, {
        ...successfulConfig.authFormat,
        timeout: 15000
      });

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

    console.log('🔍 MUESTRA DE LOCATIONS DE ZENPUT:');
    console.log('='.repeat(40));

    const coordenadasZenput = {};
    const locationsConCoordenadas = [];
    
    // Usar allLocations en lugar de zenputLocations
    allLocations.slice(0, 5).forEach((location, index) => {
      console.log(`${index + 1}. ${location.name || location.location_name}`);
      console.log(`   📍 ID: ${location.id || location.location_id}`);
      console.log(`   🏢 Activo: ${location.active || location.is_active}`);
      console.log(`   🏠 Dirección: ${location.address}`);
      console.log(`   🌎 Ciudad: ${location.city}, ${location.state}`);
      
      // Verificar si tiene coordenadas en la respuesta
      if (location.latitude && location.longitude) {
        console.log(`   📍 Coords: ${location.latitude}, ${location.longitude}`);
        locationsConCoordenadas.push(location);
      } else {
        console.log(`   ⚠️ Sin coordenadas en respuesta directa`);
      }
      console.log('');
    });

    // Filtrar y procesar locations con coordenadas
    allLocations.forEach(location => {
      const name = location.name || location.location_name;
      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);
      
      if (name && !isNaN(lat) && !isNaN(lng)) {
        // Limpiar nombre para mapeo
        const cleanName = name
          .replace(/^Sucursal\s+[A-Z]+\s*-?\s*/i, '') // Remover "Sucursal XX -"
          .replace(/^\d+\s*-?\s*/, '') // Remover números iniciales
          .trim();

        coordenadasZenput[name] = {
          original_name: name,
          clean_name: cleanName,
          lat: lat,
          lng: lng,
          id: location.id || location.location_id,
          active: location.active || location.is_active,
          address: location.address || '',
          zenput_source: true
        };
      }
    });

    console.log(`📊 ESTADÍSTICAS DE ZENPUT:`)
    console.log('='.repeat(35));
    console.log(`📋 Total locations: ${allLocations.length}`);
    console.log(`📍 Con coordenadas válidas: ${Object.keys(coordenadasZenput).length}`);
    console.log(`🎯 Locations activas: ${locationsConCoordenadas.filter(l => l.active || l.is_active).length}`);
    console.log('');

    return {
      zenputLocations: coordenadasZenput,
      rawData: allLocations,
      totalCount: allLocations.length,
      withCoordinates: Object.keys(coordenadasZenput).length
    };

  } catch (error) {
    console.error('❌ Error accediendo Zenput API:', error.message);
    
    if (error.response) {
      console.error(`📄 Status: ${error.response.status}`);
      console.error(`📄 Response: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
    }
    
    throw error;
  }
}

async function compareWithTrackingDatabase(zenputCoordinates) {
  console.log('🔄 COMPARANDO CON BASE DE DATOS DE TRACKING GPS...');
  console.log('='.repeat(50));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL (Tracking GPS)\n');

    // Obtener todas las locations del tracking GPS
    const trackingLocations = await client.query(`
      SELECT 
        location_code,
        name,
        group_name,
        latitude,
        longitude,
        active,
        synced_at
      FROM tracking_locations_cache 
      ORDER BY location_code
    `);

    console.log(`📊 Tracking GPS locations: ${trackingLocations.rows.length}`);
    console.log(`📊 Zenput locations: ${Object.keys(zenputCoordinates).length}`);
    console.log('');

    // Intentar mapear por nombre
    const mappingResults = {
      exactMatches: [],
      partialMatches: [],
      noMatches: [],
      multipleMatches: []
    };

    trackingLocations.rows.forEach(trackingLoc => {
      const trackingName = trackingLoc.name.toLowerCase()
        .replace(/^\d+\s*-?\s*/, '') // Remover números iniciales
        .replace(/^sucursal\s+[a-z]+\s*-?\s*/i, '') // Remover "Sucursal XX"
        .trim();

      // Buscar coincidencias exactas
      const exactMatch = Object.entries(zenputCoordinates).find(([zenputName, data]) => 
        data.clean_name.toLowerCase() === trackingName ||
        zenputName.toLowerCase().includes(trackingName) ||
        trackingName.includes(data.clean_name.toLowerCase())
      );

      if (exactMatch) {
        const [zenputName, zenputData] = exactMatch;
        mappingResults.exactMatches.push({
          trackingCode: trackingLoc.location_code,
          trackingName: trackingLoc.name,
          zenputName: zenputName,
          zenputData: zenputData,
          currentCoords: {
            lat: parseFloat(trackingLoc.latitude),
            lng: parseFloat(trackingLoc.longitude)
          },
          zenputCoords: {
            lat: zenputData.lat,
            lng: zenputData.lng
          }
        });
      } else {
        // Buscar coincidencias parciales
        const partialMatches = Object.entries(zenputCoordinates).filter(([zenputName, data]) => {
          const zenputClean = data.clean_name.toLowerCase();
          return zenputClean.includes(trackingName.split(' ')[0]) || 
                 trackingName.includes(zenputClean.split(' ')[0]);
        });

        if (partialMatches.length > 0) {
          mappingResults.partialMatches.push({
            trackingCode: trackingLoc.location_code,
            trackingName: trackingLoc.name,
            possibleMatches: partialMatches
          });
        } else {
          mappingResults.noMatches.push({
            trackingCode: trackingLoc.location_code,
            trackingName: trackingLoc.name
          });
        }
      }
    });

    console.log('📋 RESULTADOS DEL MAPEO:');
    console.log('='.repeat(30));
    console.log(`✅ Coincidencias exactas: ${mappingResults.exactMatches.length}`);
    console.log(`⚠️ Coincidencias parciales: ${mappingResults.partialMatches.length}`);
    console.log(`❌ Sin coincidencias: ${mappingResults.noMatches.length}`);
    console.log('');

    // Mostrar coincidencias exactas
    if (mappingResults.exactMatches.length > 0) {
      console.log('✅ COINCIDENCIAS EXACTAS ENCONTRADAS:');
      console.log('='.repeat(40));
      
      mappingResults.exactMatches.slice(0, 10).forEach(match => {
        const latDiff = Math.abs(match.currentCoords.lat - match.zenputCoords.lat);
        const lngDiff = Math.abs(match.currentCoords.lng - match.zenputCoords.lng);
        const needsUpdate = latDiff > 0.001 || lngDiff > 0.001;
        
        console.log(`[${match.trackingCode}] ${match.trackingName}`);
        console.log(`   🎯 Zenput: ${match.zenputName}`);
        console.log(`   📍 Actual: ${match.currentCoords.lat}, ${match.currentCoords.lng}`);
        console.log(`   📍 Zenput: ${match.zenputCoords.lat}, ${match.zenputCoords.lng}`);
        console.log(`   ${needsUpdate ? '🔴 NECESITA ACTUALIZACIÓN' : '✅ Coordenadas correctas'}`);
        console.log('');
      });

      if (mappingResults.exactMatches.length > 10) {
        console.log(`   ... y ${mappingResults.exactMatches.length - 10} coincidencias más\n`);
      }
    }

    return mappingResults;

  } finally {
    await client.end();
  }
}

async function main() {
  try {
    console.log('🚀 INICIANDO EXTRACCIÓN DE COORDENADAS ZENPUT');
    console.log('='.repeat(50));
    
    const zenputData = await getZenputLocations();
    const mappingResults = await compareWithTrackingDatabase(zenputData.zenputLocations);

    // Guardar resultados para referencia
    const fs = require('fs');
    const outputPath = '/Users/robertodavila/pollo-loco-tracking-gps/coordenadas-zenput-real.json';
    
    fs.writeFileSync(outputPath, JSON.stringify({
      metadata: {
        timestamp: new Date().toISOString(),
        total_zenput_locations: zenputData.totalCount,
        locations_with_coordinates: zenputData.withCoordinates,
        exact_matches: mappingResults.exactMatches.length,
        partial_matches: mappingResults.partialMatches.length,
        no_matches: mappingResults.noMatches.length
      },
      zenput_coordinates: zenputData.zenputLocations,
      mapping_results: mappingResults,
      raw_zenput_data: zenputData.rawData.slice(0, 3) // Solo muestra para referencia
    }, null, 2));

    console.log(`✅ Datos guardados en: ${outputPath}`);
    console.log('');
    console.log('🎯 SIGUIENTE PASO:');
    console.log('Ejecutar aplicación de coordenadas Zenput validadas');
    console.log('node aplicar-coordenadas-zenput.js');

  } catch (error) {
    console.error('💥 Error crítico:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getZenputLocations, compareWithTrackingDatabase };