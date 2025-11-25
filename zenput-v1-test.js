require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * ZENPUT API V1 LOCATIONS - ENDPOINT CON PERMISOS COMPLETOS
 * Roberto confirma: API token sin restricciones
 * Probando: https://staging.zenput.com/api/v1/locations
 */

class ZenputV1API {
  constructor() {
    this.apiKey = process.env.ZENPUT_API_KEY;
    this.stagingUrl = 'https://staging.zenput.com/api/v1';
    this.prodUrl = 'https://www.zenput.com/api/v1';
  }

  async makeRequest(endpoint, baseUrl = this.stagingUrl) {
    return new Promise((resolve, reject) => {
      const url = `${baseUrl}${endpoint}`;
      
      console.log(`🌐 Conectando: ${url}`);
      console.log(`🔑 Token: ${this.apiKey.substring(0, 8)}... (sin restricciones)`);
      
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
          console.log(`📝 Preview: ${data.substring(0, 200)}`);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              console.log(`✅ JSON válido - keys: ${Object.keys(parsed).join(', ')}`);
              
              // Detectar array de locations
              if (Array.isArray(parsed)) {
                console.log(`📊 Array directo: ${parsed.length} items`);
              } else if (parsed.data && Array.isArray(parsed.data)) {
                console.log(`📊 parsed.data[]: ${parsed.data.length} items`);
              } else if (parsed.results && Array.isArray(parsed.results)) {
                console.log(`📊 parsed.results[]: ${parsed.results.length} items`);
              } else if (parsed.locations && Array.isArray(parsed.locations)) {
                console.log(`📊 parsed.locations[]: ${parsed.locations.length} items`);
              }
              
              resolve(parsed);
            } catch (error) {
              console.log(`❌ JSON Parse Error: ${error.message}`);
              console.log(`Raw data: ${data}`);
              resolve({ raw: data });
            }
          } else {
            console.log(`❌ HTTP ${res.statusCode}: ${data}`);
            
            if (res.statusCode === 401) {
              console.log('🔑 Token inválido o expirado');
            } else if (res.statusCode === 403) {
              console.log('🚫 Sin permisos (pero Roberto dice que no hay restricciones...)');
            } else if (res.statusCode === 404) {
              console.log('🔍 Endpoint no existe en v1');
            }
            
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

  async getLocationsV1() {
    console.log('🔍 Probando /locations en v1...');
    try {
      return await this.makeRequest('/locations');
    } catch (error) {
      console.log(`❌ v1/locations falló: ${error.message}`);
      return null;
    }
  }

  async getStoresV1() {
    console.log('🔍 Probando /stores en v1...');
    try {
      return await this.makeRequest('/stores');
    } catch (error) {
      console.log(`❌ v1/stores falló: ${error.message}`);
      return null;
    }
  }

  async getSitesV1() {
    console.log('🔍 Probando /sites en v1...');
    try {
      return await this.makeRequest('/sites');
    } catch (error) {
      console.log(`❌ v1/sites falló: ${error.message}`);
      return null;
    }
  }

  async getOrganizationV1() {
    console.log('🔍 Probando /organization en v1...');
    try {
      return await this.makeRequest('/organization');
    } catch (error) {
      console.log(`❌ v1/organization falló: ${error.message}`);
      return null;
    }
  }

  // También probar con prod URL si staging falla
  async tryProduction() {
    console.log('\n🔄 Intentando con URL de producción...');
    return await this.makeRequest('/locations', this.prodUrl);
  }
}

async function testZenputV1Complete() {
  console.log('🔍 TEST COMPLETO ZENPUT API V1 - SIN RESTRICCIONES\n');
  
  try {
    const zenput = new ZenputV1API();

    // 1. Obtener sucursales actuales para comparación
    const currentBranches = await db.query(`
      SELECT name, city, state, latitude, longitude
      FROM branches 
      WHERE active = true
      ORDER BY name
    `);
    
    console.log(`📊 Sucursales actuales en BD: ${currentBranches.rows.length}\n`);

    // 2. Probar múltiples endpoints v1
    const endpoints = [
      { name: 'locations', method: 'getLocationsV1' },
      { name: 'stores', method: 'getStoresV1' },
      { name: 'sites', method: 'getSitesV1' },
      { name: 'organization', method: 'getOrganizationV1' }
    ];

    let successfulData = null;
    let successfulEndpoint = null;

    for (const endpoint of endpoints) {
      console.log(`\n🎯 PROBANDO: /api/v1/${endpoint.name}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const data = await zenput[endpoint.method]();
        
        if (data && !data.raw) {
          console.log(`✅ ÉXITO en /api/v1/${endpoint.name}!`);
          
          // Buscar array de locations/stores/sites
          let items = [];
          if (Array.isArray(data)) {
            items = data;
          } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
          } else if (data.results && Array.isArray(data.results)) {
            items = data.results;
          } else if (data[endpoint.name] && Array.isArray(data[endpoint.name])) {
            items = data[endpoint.name];
          }
          
          if (items.length > 0) {
            console.log(`📊 Encontrados ${items.length} items`);
            console.log(`🎯 Primer item:`, JSON.stringify(items[0], null, 2).substring(0, 300));
            
            successfulData = { items, endpoint: endpoint.name, fullData: data };
            successfulEndpoint = endpoint.name;
            break; // Usar el primer endpoint exitoso
          }
        }
      } catch (error) {
        // Error ya logueado en makeRequest
      }
    }

    // 3. Si staging falló, probar producción
    if (!successfulData) {
      console.log('\n🔄 Staging falló, probando producción...');
      try {
        const prodData = await zenput.tryProduction();
        if (prodData && !prodData.raw) {
          successfulData = { items: prodData, endpoint: 'locations (prod)', fullData: prodData };
          successfulEndpoint = 'locations-prod';
        }
      } catch (error) {
        console.log(`❌ Producción también falló: ${error.message}`);
      }
    }

    // 4. Procesar datos exitosos
    if (successfulData) {
      console.log(`\n🎉 DATOS OBTENIDOS EXITOSAMENTE DE: ${successfulData.endpoint}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const { items } = successfulData;
      
      // Mostrar muestra de items
      console.log('\n📋 MUESTRA DE ITEMS ZENPUT:');
      items.slice(0, 5).forEach((item, i) => {
        console.log(`${i + 1}. ${item.name || item.title || 'Sin nombre'}`);
        console.log(`   ID: ${item.id || 'N/A'}`);
        console.log(`   Dirección: ${item.address || 'N/A'}`);
        console.log(`   Ciudad: ${item.city || 'N/A'}, ${item.state || 'N/A'}`);
        console.log(`   Coords: ${item.latitude || 'N/A'}, ${item.longitude || 'N/A'}`);
        console.log(`   Activo: ${item.is_active !== false ? 'Sí' : 'No'}`);
        console.log('');
      });

      // 5. Buscar nuevas sucursales
      const currentNames = new Set(
        currentBranches.rows.map(b => b.name.toLowerCase().trim())
      );

      const newItems = items.filter(zenputItem => {
        const zenputName = (zenputItem.name || zenputItem.title || '').toLowerCase().trim();
        return zenputName && !currentNames.has(zenputName) && zenputItem.is_active !== false;
      });

      console.log(`\n🆕 NUEVAS SUCURSALES ENCONTRADAS: ${newItems.length}`);
      
      if (newItems.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        newItems.forEach((item, i) => {
          console.log(`${i + 1}. ${item.name || item.title} ⭐ NUEVA`);
          console.log(`   📍 ${item.address || 'Sin dirección'}`);
          console.log(`   🌍 ${item.latitude || 'N/A'}, ${item.longitude || 'N/A'}`);
          console.log(`   🆔 Zenput ID: ${item.id}`);
          
          // Validar coordenadas
          const lat = parseFloat(item.latitude);
          const lng = parseFloat(item.longitude);
          if (lat && lng && lat >= 14.5 && lat <= 32.7 && lng >= -118.5 && lng <= -86.7) {
            console.log(`   ✅ Coordenadas válidas (México)`);
          } else {
            console.log(`   ⚠️ Coordenadas inválidas o faltantes`);
          }
          console.log('');
        });

        if (newItems.length === 3) {
          console.log('🎯 ¡PERFECTO! Exactamente 3 nuevas sucursales');
          console.log('📋 Coincide con lo que Roberto mencionó');
        } else {
          console.log(`📊 Encontradas ${newItems.length} (esperábamos 3)`);
        }

        return {
          success: true,
          endpoint: successfulEndpoint,
          total_zenput: items.length,
          total_bd: currentBranches.rows.length,
          new_branches: newItems,
          ready_for_integration: true
        };
      } else {
        console.log('✅ No hay sucursales nuevas - sistema sincronizado');
        return {
          success: true,
          endpoint: successfulEndpoint,
          total_zenput: items.length,
          total_bd: currentBranches.rows.length,
          new_branches: [],
          all_synced: true
        };
      }
    } else {
      console.log('\n❌ NO SE PUDO CONECTAR A NINGÚN ENDPOINT');
      console.log('🔧 Posibles causas:');
      console.log('   • API key incorrecto');
      console.log('   • Endpoints diferentes en v1');
      console.log('   • Problema de conectividad');
      
      return { success: false, error: 'No successful endpoints' };
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar test completo
async function main() {
  const result = await testZenputV1Complete();
  
  if (result.success) {
    console.log('\n🎉 RESULTADO FINAL: CONEXIÓN EXITOSA');
    console.log(`📡 Endpoint usado: ${result.endpoint}`);
    console.log(`📊 Total Zenput: ${result.total_zenput}`);
    console.log(`📊 Total BD: ${result.total_bd}`);
    
    if (result.ready_for_integration) {
      console.log(`🆕 Nuevas sucursales: ${result.new_branches.length}`);
      console.log('🚀 Listo para integración automática');
    } else {
      console.log('✅ Sistema sincronizado');
    }
  } else {
    console.log('\n❌ ERROR: No se pudo conectar al API');
    console.log(`Details: ${result.error}`);
  }
  
  process.exit(0);
}

main();