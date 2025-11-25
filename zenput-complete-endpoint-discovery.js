require('dotenv').config();
const https = require('https');

/**
 * DISCOVERY COMPLETO DE ENDPOINTS ZENPUT API
 * Basado en documentación oficial: developer.zenput.com
 * Probando TODOS los endpoints posibles con X-API-TOKEN
 */

class ZenputEndpointDiscovery {
  constructor() {
    this.apiToken = process.env.ZENPUT_API_KEY;
    this.baseUrls = [
      'https://www.zenput.com/api',
      'https://staging.zenput.com/api'
    ];
  }

  async makeRequest(url) {
    return new Promise((resolve) => {
      console.log(`🌐 Testing: ${url}`);
      
      const options = {
        method: 'GET',
        headers: {
          'X-API-TOKEN': this.apiToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'EPL-CAS-Discovery/1.0'
        },
        timeout: 8000
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          console.log(`📡 ${res.statusCode} | Length: ${data.length} chars`);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              console.log(`✅ SUCCESS - JSON válido`);
              
              // Analizar estructura
              let itemCount = 0;
              let dataType = 'object';
              
              if (Array.isArray(parsed)) {
                itemCount = parsed.length;
                dataType = 'direct_array';
              } else if (parsed.data && Array.isArray(parsed.data)) {
                itemCount = parsed.data.length;
                dataType = 'data_array';
              } else if (parsed.results && Array.isArray(parsed.results)) {
                itemCount = parsed.results.length;
                dataType = 'results_array';
              } else if (parsed.locations && Array.isArray(parsed.locations)) {
                itemCount = parsed.locations.length;
                dataType = 'locations_array';
              }
              
              console.log(`📊 Items: ${itemCount} (${dataType})`);
              console.log(`🔑 Keys: ${Object.keys(parsed).slice(0, 5).join(', ')}`);
              
              // Preview del primer item si es array
              if (itemCount > 0) {
                const items = Array.isArray(parsed) ? parsed : 
                             parsed.data || parsed.results || parsed.locations || [];
                if (items[0]) {
                  console.log(`🎯 First item: ${JSON.stringify(items[0]).substring(0, 100)}...`);
                }
              }
              
              resolve({ 
                success: true, 
                status: res.statusCode, 
                data: parsed, 
                itemCount,
                dataType
              });
            } catch (e) {
              console.log(`✅ SUCCESS - Non-JSON: ${data.substring(0, 50)}...`);
              resolve({ 
                success: true, 
                status: res.statusCode, 
                raw: data.substring(0, 200)
              });
            }
          } else {
            console.log(`❌ HTTP ${res.statusCode}: ${data.substring(0, 100)}`);
            resolve({ 
              success: false, 
              status: res.statusCode, 
              error: data.substring(0, 200)
            });
          }
        });
      });

      req.on('error', (error) => {
        console.log(`❌ Error: ${error.message}`);
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        console.log(`⏰ Timeout`);
        req.destroy();
        resolve({ success: false, error: 'Timeout' });
      });

      req.end();
    });
  }

  async discoverAllEndpoints() {
    console.log('🔍 DISCOVERY COMPLETO ZENPUT API ENDPOINTS\n');
    console.log(`🔑 API Token: ${this.apiToken.substring(0, 8)}...\n`);
    
    // TODOS los endpoints posibles basados en documentación
    const endpoints = [
      // === V1 ENDPOINTS ===
      '/v1/forms',
      '/v1/forms/list_templates',
      '/v1/forms/list_templates/',
      '/v1/locations',
      '/v1/locations/',
      '/v1/stores',
      '/v1/sites',
      '/v1/users',
      '/v1/tasks',
      '/v1/activities',
      '/v1/submissions',
      '/v1/companies',
      '/v1/organization',
      '/v1/teams',
      
      // === V2 ENDPOINTS ===
      '/v2/locations',
      '/v2/users',
      '/v2/storage',
      
      // === V3 ENDPOINTS ===
      '/v3/locations',
      '/v3/locations/',
      '/v3/location',
      '/v3/users',
      '/v3/users/',
      '/v3/teams',
      '/v3/teams/',
      '/v3/userroles',
      '/v3/userroles/',
      '/v3/tasks',
      '/v3/forms',
      '/v3/activities',
      '/v3/companies',
      '/v3/organizations',
      '/v3/stores',
      '/v3/sites',
      
      // === ENDPOINTS SIN VERSIÓN ===
      '/locations',
      '/locations/',
      '/stores',
      '/sites',
      '/users',
      '/forms',
      '/tasks'
    ];

    let successfulEndpoints = [];

    // Probar cada endpoint en ambas URLs base
    for (const baseUrl of this.baseUrls) {
      console.log(`\n🏗️ PROBANDO BASE URL: ${baseUrl}`);
      console.log('━'.repeat(60));
      
      for (const endpoint of endpoints) {
        const fullUrl = `${baseUrl}${endpoint}`;
        
        const result = await this.makeRequest(fullUrl);
        
        if (result.success) {
          successfulEndpoints.push({
            url: fullUrl,
            baseUrl,
            endpoint,
            ...result
          });
          
          // Si encontramos muchos items, probablemente son locations
          if (result.itemCount > 50) {
            console.log(`🎯 POTENTIAL LOCATIONS ENDPOINT: ${result.itemCount} items!`);
          }
        }
        
        // Pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return successfulEndpoints;
  }
}

async function main() {
  const discovery = new ZenputEndpointDiscovery();
  const successfulEndpoints = await discovery.discoverAllEndpoints();
  
  console.log('\n🎉 RESUMEN DE ENDPOINTS EXITOSOS:');
  console.log('━'.repeat(60));
  
  if (successfulEndpoints.length > 0) {
    // Ordenar por número de items (más items = más probable que sean locations)
    successfulEndpoints.sort((a, b) => (b.itemCount || 0) - (a.itemCount || 0));
    
    successfulEndpoints.forEach((ep, i) => {
      console.log(`${i + 1}. ${ep.endpoint} (${ep.baseUrl})`);
      console.log(`   📊 Items: ${ep.itemCount || 0} | Type: ${ep.dataType || 'N/A'}`);
      console.log(`   📡 Status: ${ep.status}`);
      console.log('');
    });

    // Identificar el mejor endpoint para locations
    const bestForLocations = successfulEndpoints.find(ep => 
      ep.itemCount > 50 || 
      ep.endpoint.includes('location') ||
      ep.endpoint.includes('store') ||
      ep.endpoint.includes('site')
    );

    if (bestForLocations) {
      console.log('🎯 MEJOR ENDPOINT PARA SUCURSALES:');
      console.log(`   URL: ${bestForLocations.url}`);
      console.log(`   Items: ${bestForLocations.itemCount}`);
      console.log(`   Type: ${bestForLocations.dataType}`);
      
      console.log('\n🚀 SIGUIENTE PASO:');
      console.log(`   1. Usar endpoint: ${bestForLocations.url}`);
      console.log(`   2. Buscar nuevas sucursales en los ${bestForLocations.itemCount} items`);
      console.log(`   3. Comparar con las 82 sucursales actuales`);
    } else {
      console.log('⚠️ No se encontró endpoint específico para locations');
      console.log('📋 Revisar manualmente los endpoints exitosos');
    }
    
  } else {
    console.log('❌ NO SE ENCONTRARON ENDPOINTS EXITOSOS');
    console.log('\n🔧 Verificar:');
    console.log('   • API token en .env');
    console.log('   • Permisos del token');
    console.log('   • URLs base correctas');
  }
  
  process.exit(0);
}

main();