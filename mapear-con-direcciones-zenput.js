require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');

/**
 * MAPEO AUTOMÁTICO CON DIRECCIONES VALIDADAS DE ZENPUT
 * Usa las direcciones reales del sistema de supervisión para obtener coordenadas exactas
 */

const DIRECCIONES_ZENPUT_VALIDADAS = [
  {
    "id": 2247000,
    "name": "1 - Pino Suarez",
    "address": "Av. Pino Suarez #500 sur Col. Centro, Monterrey, NL, 64000, México",
    "searchQuery": "1 - Pino Suarez Av. Pino Suarez #500 sur Col. Centro, Monterrey, NL, 64000, México",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Pino%20Suarez%20%23500%20sur%20Col.%20Centro%2C%20Monterrey%2C%20NL%2C%2064000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/1%20-%20Pino%20Suarez%20Av.%20Pino%20Suarez%20%23500%20sur%20Col.%20Centro%2C%20Monterrey%2C%20NL%2C%2064000%2C%20M%C3%A9xico",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64000"
  },
  {
    "id": 2247009,
    "name": "10 - Barragan",
    "address": "Av. Manuel I. Barragán #1401, San Nicolas de los Garza, NL, 66428, México",
    "searchQuery": "10 - Barragan Av. Manuel I. Barragán #1401, San Nicolas de los Garza, NL, 66428, México",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Manuel%20I.%20Barraga%CC%81n%20%231401%2C%20San%20Nicolas%20de%20los%20Garza%2C%20NL%2C%2066428%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/10%20-%20Barragan%20Av.%20Manuel%20I.%20Barraga%CC%81n%20%231401%2C%20San%20Nicolas%20de%20los%20Garza%2C%20NL%2C%2066428%2C%20M%C3%A9xico",
    "city": "San Nicolas de los Garza",
    "state": "NL",
    "zipcode": "66428"
  },
  {
    "id": 2247010,
    "name": "11 - Lincoln",
    "address": "Av. Paseo de Cumbres #1001-C, Monterrey, NL, 64346, México",
    "searchQuery": "11 - Lincoln Av. Paseo de Cumbres #1001-C, Monterrey, NL, 64346, México",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Paseo%20de%20Cumbres%20%231001-C%2C%20Monterrey%2C%20NL%2C%2064346%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/11%20-%20Lincoln%20Av.%20Paseo%20de%20Cumbres%20%231001-C%2C%20Monterrey%2C%20NL%2C%2064346%2C%20M%C3%A9xico",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64346"
  }
];

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
  
  console.log(`📍 Procesando ${DIRECCIONES_ZENPUT_VALIDADAS.length} direcciones validadas...\n`);

  // Procesar en lotes
  const tamañoLote = 5;
  
  for (let i = 0; i < DIRECCIONES_ZENPUT_VALIDADAS.length; i += tamañoLote) {
    const lote = DIRECCIONES_ZENPUT_VALIDADAS.slice(i, i + tamañoLote);
    
    console.log(`🔄 Lote ${Math.floor(i/tamañoLote) + 1}/${Math.ceil(DIRECCIONES_ZENPUT_VALIDADAS.length/tamañoLote)}`);
    
    for (const location of lote) {
      try {
        // Probar múltiples consultas para mayor precisión
        const queries = [
          location.address, // Dirección completa de Zenput
          location.searchQuery, // Dirección + nombre del restaurante
          `El Pollo Loco ${location.city}, ${location.state}` // Búsqueda por ciudad
        ];

        let coordenadas = null;
        let queryExitosa = null;

        for (const query of queries) {
          try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&region=mx`;
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
            console.log(`   ⚠️ Error en query: ${queryError.message}`);
          }
        }

        if (coordenadas) {
          console.log(`✅ [${location.id}] ${location.name}`);
          console.log(`   📍 ${coordenadas.lat}, ${coordenadas.lng}`);
          console.log(`   🏷️ ${coordenadas.formatted_address}`);
          console.log(`   🔍 Query: ${queryExitosa.substring(0, 50)}...`);
          console.log('');

          resultados.push({
            ...location,
            coordenadas
          });
        } else {
          console.log(`❌ [${location.id}] ${location.name} - No encontrado`);
          errores.push(location);
        }

        // Pausa para respetar rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error con ${location.name}: ${error.message}`);
        errores.push(location);
      }
    }
    
    console.log('⏳ Pausa entre lotes...\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('📊 RESUMEN:');
  console.log(`✅ Éxito: ${resultados.length}/${DIRECCIONES_ZENPUT_VALIDADAS.length}`);
  console.log(`❌ Errores: ${errores.length}`);

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
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    let aplicadas = 0;
    
    for (const location of resultados) {
      try {
        const result = await client.query(`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        `, [location.coordenadas.lat, location.coordenadas.lng, location.id]);
        
        if (result.rowCount > 0) {
          console.log(`✅ [${location.id}] ${location.name} - Actualizado`);
          aplicadas++;
        }
      } catch (updateError) {
        console.log(`❌ [${location.id}] Error: ${updateError.message}`);
      }
    }
    
    console.log(`\n🎯 COORDENADAS APLICADAS: ${aplicadas}/${resultados.length}`);
    console.log('✅ Mapeo completo terminado');
    console.log('🌐 Verifica: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  mapearConDireccionesZenput()
    .then(() => {
      console.log('\n✅ Mapeo Zenput completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { mapearConDireccionesZenput };