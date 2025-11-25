require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * ZENPUT API - ESTRUCTURA CORRECTA DE AUTENTICACIÓN
 * Roberto proporciona estructura: X-API-TOKEN header
 * URL base: https://www.zenput.com/api/v1/forms
 * Probando v1 y v3 con autenticación correcta
 */

class ZenputCorrectAPI {
  constructor() {
    this.apiToken = process.env.ZENPUT_API_KEY;
    this.baseUrlV1 = 'https://www.zenput.com/api/v1';
    this.baseUrlV3 = 'https://www.zenput.com/api/v3';
  }

  async makeRequest(endpoint, version = 'v1') {
    return new Promise((resolve, reject) => {
      const baseUrl = version === 'v1' ? this.baseUrlV1 : this.baseUrlV3;
      const url = `${baseUrl}${endpoint}`;
      
      console.log(`🌐 Conectando: ${url}`);
      console.log(`🔑 X-API-TOKEN: ${this.apiToken.substring(0, 8)}...`);
      
      const options = {
        method: 'GET',
        headers: {
          'X-API-TOKEN': this.apiToken,  // ✅ ESTRUCTURA CORRECTA
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'EPL-CAS-GPS-System/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        console.log(`📡 Status: ${res.statusCode}`);
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          console.log(`📦 Response: ${data.length} chars`);
          console.log(`📝 Preview: ${data.substring(0, 300)}`);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              console.log(`✅ JSON válido`);
              console.log(`📋 Structure keys: ${Object.keys(parsed).join(', ')}`);
              
              // Log detalles de la estructura
              if (Array.isArray(parsed)) {
                console.log(`📊 Direct array: ${parsed.length} items`);
              }
              if (parsed.data && Array.isArray(parsed.data)) {
                console.log(`📊 parsed.data[]: ${parsed.data.length} items`);
              }
              if (parsed.results && Array.isArray(parsed.results)) {
                console.log(`📊 parsed.results[]: ${parsed.results.length} items`);
              }
              if (parsed.forms && Array.isArray(parsed.forms)) {
                console.log(`📊 parsed.forms[]: ${parsed.forms.length} items`);
              }
              if (parsed.locations && Array.isArray(parsed.locations)) {
                console.log(`📊 parsed.locations[]: ${parsed.locations.length} items`);
              }
              
              resolve(parsed);
            } catch (error) {
              console.log(`❌ JSON Parse Error: ${error.message}`);
              console.log(`Raw response: ${data.substring(0, 500)}`);
              resolve({ raw: data });
            }
          } else {
            console.log(`❌ HTTP ${res.statusCode}`);
            
            if (res.statusCode === 401) {
              console.log('🔑 401: Token inválido o mal formado');
            } else if (res.statusCode === 403) {
              console.log('🚫 403: Sin permisos para este endpoint');
            } else if (res.statusCode === 404) {
              console.log('🔍 404: Endpoint no encontrado');
            } else if (res.statusCode === 405) {
              console.log('🔧 405: Método no permitido');
            }
            
            // Pero también incluir la respuesta para análisis
            try {
              const errorData = JSON.parse(data);
              console.log(`📋 Error data:`, errorData);
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(errorData)}`));
            } catch (e) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request Error:', error.message);
        reject(error);
      });

      req.end();
    });
  }

  // Probar endpoints conocidos
  async testForms(version = 'v1') {
    console.log(`🔍 Testing /forms en ${version}...`);
    return await this.makeRequest('/forms', version);
  }

  async testFormsListTemplates(version = 'v1') {
    console.log(`🔍 Testing /forms/list_templates en ${version}...`);
    return await this.makeRequest('/forms/list_templates', version);
  }

  async testLocations(version = 'v3') {
    console.log(`🔍 Testing /locations en ${version}...`);
    return await this.makeRequest('/locations', version);
  }

  async testStores(version = 'v1') {
    console.log(`🔍 Testing /stores en ${version}...`);
    return await this.makeRequest('/stores', version);
  }

  async testSites(version = 'v1') {
    console.log(`🔍 Testing /sites en ${version}...`);
    return await this.makeRequest('/sites', version);
  }

  async testUsers(version = 'v3') {
    console.log(`🔍 Testing /users en ${version}...`);
    return await this.makeRequest('/users', version);
  }

  async testTasks(version = 'v1') {
    console.log(`🔍 Testing /tasks en ${version}...`);
    return await this.makeRequest('/tasks', version);
  }
}

async function testZenputCorrectAuth() {
  console.log('🔍 TEST ZENPUT - AUTENTICACIÓN CORRECTA (X-API-TOKEN)\n');
  console.log('📋 Estructura según Roberto: https://www.zenput.com/api/v1/forms');
  console.log('🔑 Header: X-API-TOKEN\n');
  
  try {
    const zenput = new ZenputCorrectAPI();

    // Array de endpoints para probar
    const tests = [
      // V1 endpoints
      { method: 'testForms', version: 'v1', description: '/api/v1/forms' },
      { method: 'testFormsListTemplates', version: 'v1', description: '/api/v1/forms/list_templates' },
      { method: 'testStores', version: 'v1', description: '/api/v1/stores' },
      { method: 'testSites', version: 'v1', description: '/api/v1/sites' },
      { method: 'testTasks', version: 'v1', description: '/api/v1/tasks' },
      
      // V3 endpoints  
      { method: 'testLocations', version: 'v3', description: '/api/v3/locations' },
      { method: 'testUsers', version: 'v3', description: '/api/v3/users' }
    ];

    let successfulEndpoints = [];

    for (const test of tests) {
      console.log(`\n🎯 PROBANDO: ${test.description}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const result = await zenput[test.method](test.version);
        
        if (result && !result.raw) {
          console.log(`✅ ÉXITO en ${test.description}!`);
          
          // Analizar contenido
          let itemCount = 0;
          let dataType = 'unknown';
          
          if (Array.isArray(result)) {
            itemCount = result.length;
            dataType = 'direct_array';
          } else if (result.data && Array.isArray(result.data)) {
            itemCount = result.data.length;
            dataType = 'data_array';
          } else if (result.results && Array.isArray(result.results)) {
            itemCount = result.results.length;
            dataType = 'results_array';
          } else {
            dataType = 'object';
          }
          
          successfulEndpoints.push({
            endpoint: test.description,
            version: test.version,
            itemCount,
            dataType,
            data: result
          });
          
          console.log(`📊 Items encontrados: ${itemCount} (${dataType})`);
          
          // Si encontramos datos que podrían ser locations/stores
          if (itemCount > 0) {
            const items = Array.isArray(result) ? result : result.data || result.results || [];
            if (items.length > 0) {
              console.log(`🎯 Primer item preview:`, JSON.stringify(items[0], null, 2).substring(0, 200));
            }
          }
        } else if (result && result.raw) {
          console.log(`⚠️ Respuesta no-JSON en ${test.description}`);
        }
        
      } catch (error) {
        // Error ya logueado, continuar con siguiente endpoint
        console.log(`❌ Falló: ${error.message.substring(0, 100)}`);
      }
      
      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Analizar resultados exitosos
    console.log('\n🎉 RESUMEN DE ENDPOINTS EXITOSOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (successfulEndpoints.length > 0) {
      successfulEndpoints.forEach(endpoint => {
        console.log(`✅ ${endpoint.endpoint} (${endpoint.version})`);
        console.log(`   📊 ${endpoint.itemCount} items - ${endpoint.dataType}`);
      });

      // Buscar el mejor endpoint para locations/stores
      const bestForLocations = successfulEndpoints.find(ep => 
        ep.endpoint.includes('locations') || 
        ep.endpoint.includes('stores') || 
        ep.endpoint.includes('sites') ||
        ep.itemCount > 50 // Probablemente locations si hay muchos items
      );

      if (bestForLocations) {
        console.log(`\n🎯 MEJOR ENDPOINT PARA SUCURSALES: ${bestForLocations.endpoint}`);
        console.log(`📊 ${bestForLocations.itemCount} items encontrados`);
        
        return {
          success: true,
          bestEndpoint: bestForLocations,
          allSuccessful: successfulEndpoints,
          ready_for_location_search: true
        };
      } else {
        console.log('\n⚠️ Endpoints exitosos pero ninguno parece contener locations/stores');
        return {
          success: true,
          allSuccessful: successfulEndpoints,
          need_manual_analysis: true
        };
      }
    } else {
      console.log('❌ Ningún endpoint respondió exitosamente');
      console.log('\n🔧 Verificar:');
      console.log('   • API token correcto en .env');
      console.log('   • Permisos del token en Zenput dashboard');
      console.log('   • Estructura de endpoints');
      
      return { success: false, error: 'No successful endpoints' };
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar test
async function main() {
  const result = await testZenputCorrectAuth();
  
  if (result.success) {
    if (result.ready_for_location_search) {
      console.log('\n🚀 SIGUIENTE PASO: Buscar sucursales nuevas en el endpoint exitoso');
    } else if (result.need_manual_analysis) {
      console.log('\n🔍 SIGUIENTE PASO: Analizar manualmente los endpoints exitosos');
    } else {
      console.log('\n✅ Conexión exitosa establecida');
    }
  } else {
    console.log('\n❌ No se pudo conectar al API Zenput');
  }
  
  process.exit(0);
}

main();