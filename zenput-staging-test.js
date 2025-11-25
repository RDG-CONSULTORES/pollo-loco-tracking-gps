require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * ZENPUT API V3 STAGING - ENDPOINT OFICIAL DOCUMENTADO
 * URL correcta: https://staging.zenput.com/api/v3/locations
 * Documentación: https://developer.zenput.com/reference/get-locations-v3-ref
 */

class ZenputStagingAPI {
  constructor() {
    this.apiKey = process.env.ZENPUT_API_KEY;
    this.baseUrl = 'https://staging.zenput.com/api/v3';
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      
      console.log(`🌐 Conectando a Zenput Staging: ${url}`);
      console.log(`🔑 API Key: ${this.apiKey.substring(0, 8)}...`);
      
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
        console.log(`🔧 Headers:`, JSON.stringify(res.headers, null, 2));
        
        // Manejar redirecciones manualmente
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          console.log(`🔄 Redirección detectada a: ${res.headers.location}`);
          
          if (res.headers.location) {
            // Construir URL completa si es relativa
            let redirectUrl = res.headers.location;
            if (redirectUrl.startsWith('/')) {
              redirectUrl = `https://staging.zenput.com${redirectUrl}`;
            }
            
            console.log(`🔄 Siguiendo redirección a: ${redirectUrl}`);
            
            // Nueva petición a la URL redirigida
            const redirectReq = https.request(redirectUrl, options, (redirectRes) => {
              let redirectData = '';
              
              console.log(`📡 Redirect Status: ${redirectRes.statusCode}`);
              
              redirectRes.on('data', chunk => redirectData += chunk);
              
              redirectRes.on('end', () => {
                console.log(`📦 Redirect Response Length: ${redirectData.length} chars`);
                console.log(`📝 Redirect Preview:`, redirectData.substring(0, 300));
                
                if (redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
                  try {
                    const parsed = JSON.parse(redirectData);
                    console.log(`✅ Redirección exitosa - JSON válido`);
                    resolve(parsed);
                  } catch (error) {
                    console.log(`✅ Redirección exitosa - No JSON:`, redirectData.substring(0, 100));
                    resolve({ raw: redirectData });
                  }
                } else {
                  console.log(`❌ Error en redirección: ${redirectRes.statusCode}`);
                  reject(new Error(`Redirect HTTP ${redirectRes.statusCode}: ${redirectData}`));
                }
              });
            });
            
            redirectReq.on('error', reject);
            redirectReq.end();
            return;
          }
        }
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          console.log(`📦 Response Length: ${data.length} chars`);
          console.log(`📝 Response Preview:`, data.substring(0, 300));
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              console.log(`✅ Respuesta exitosa - JSON válido`);
              console.log(`📋 Estructura:`, Object.keys(parsed));
              resolve(parsed);
            } catch (error) {
              console.log(`✅ Respuesta exitosa - No JSON`);
              resolve({ raw: data });
            }
          } else {
            console.log(`❌ Error HTTP: ${res.statusCode}`);
            
            if (res.statusCode === 401) {
              console.log('🔑 Error 401: Token inválido o expirado');
            } else if (res.statusCode === 403) {
              console.log('🚫 Error 403: Sin permisos para locations');
              console.log('💡 Sugerencia: Verificar permisos del API key en Zenput dashboard');
            } else if (res.statusCode === 404) {
              console.log('🔍 Error 404: Endpoint no encontrado');
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

  async getLocations() {
    console.log('🔍 Obteniendo locations desde Zenput Staging API...');
    return await this.makeRequest('/locations');
  }
}

async function testZenputStaging() {
  console.log('🔍 TEST ZENPUT STAGING API - ENDPOINT OFICIAL\n');
  
  try {
    const zenput = new ZenputStagingAPI();

    // 1. Obtener sucursales actuales de BD para comparación
    const currentBranches = await db.query(`
      SELECT name, city, state 
      FROM branches 
      WHERE active = true
      ORDER BY name
    `);
    
    console.log(`📊 Sucursales actuales en BD: ${currentBranches.rows.length}\n`);

    // 2. Probar conexión a Zenput Staging
    const zenputData = await zenput.getLocations();
    
    console.log('\n🎯 RESPUESTA DE ZENPUT STAGING:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (zenputData.raw) {
      console.log('📄 Respuesta en texto plano (no JSON)');
      console.log('Content:', zenputData.raw.substring(0, 500));
      return { success: false, error: 'Non-JSON response' };
    }
    
    // Detectar estructura de datos
    let locations = [];
    if (Array.isArray(zenputData)) {
      locations = zenputData;
      console.log('📊 Array directo con locations');
    } else if (zenputData.data && Array.isArray(zenputData.data)) {
      locations = zenputData.data;
      console.log('📊 Objeto con propiedad data[]');
    } else if (zenputData.results && Array.isArray(zenputData.results)) {
      locations = zenputData.results;
      console.log('📊 Objeto con propiedad results[]');
    } else {
      console.log('📋 Estructura completa del objeto:');
      console.log(JSON.stringify(zenputData, null, 2).substring(0, 1000));
    }

    console.log(`🎯 Total locations encontradas: ${locations.length}`);

    if (locations.length > 0) {
      console.log('\n📋 MUESTRA DE LOCATIONS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      locations.slice(0, 10).forEach((loc, i) => {
        console.log(`${i + 1}. ${loc.name || loc.title || 'Sin nombre'}`);
        console.log(`   ID: ${loc.id || 'N/A'}`);
        console.log(`   Dirección: ${loc.address || 'N/A'}`);
        console.log(`   Ciudad: ${loc.city || 'N/A'}, ${loc.state || 'N/A'}`);
        console.log(`   Coords: ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
        console.log(`   Activo: ${loc.is_active !== false ? 'Sí' : 'No'}`);
        console.log('');
      });

      // 3. Buscar diferencias con BD
      const currentNames = new Set(
        currentBranches.rows.map(b => b.name.toLowerCase().trim())
      );

      const newLocations = locations.filter(zenputLoc => {
        const zenputName = (zenputLoc.name || zenputLoc.title || '').toLowerCase().trim();
        return zenputName && !currentNames.has(zenputName) && zenputLoc.is_active !== false;
      });

      console.log(`🆕 NUEVAS LOCATIONS (no en BD): ${newLocations.length}`);
      
      if (newLocations.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        newLocations.forEach((loc, i) => {
          console.log(`${i + 1}. ${loc.name || loc.title} (NUEVA)`);
          console.log(`   📍 ${loc.address || 'Sin dirección'}`);
          console.log(`   🌍 ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
          console.log(`   🆔 Zenput ID: ${loc.id}`);
          console.log('');
        });

        if (newLocations.length === 3) {
          console.log('🎯 ¡PERFECTO! Exactamente 3 nuevas sucursales encontradas');
          console.log('📋 Estas deben ser las que Roberto mencionó');
        }
      }

      return {
        success: true,
        total_zenput: locations.length,
        total_bd: currentBranches.rows.length,
        new_locations: newLocations,
        ready_for_integration: newLocations.length > 0
      };
    } else {
      console.log('⚠️ No se encontraron locations en la respuesta');
      return { success: true, total_zenput: 0 };
    }

  } catch (error) {
    console.error('❌ Error en test Zenput Staging:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar test
async function main() {
  const result = await testZenputStaging();
  
  if (result.success) {
    if (result.new_locations && result.new_locations.length > 0) {
      console.log('\n🎉 ÉXITO: Conexión a Zenput exitosa y nuevas sucursales encontradas');
      console.log(`📊 Nuevas sucursales: ${result.new_locations.length}`);
      console.log('📋 Listo para integración automática');
    } else if (result.total_zenput > 0) {
      console.log('\n✅ ÉXITO: Conexión a Zenput exitosa');
      console.log('📊 Sistema sincronizado - no hay sucursales nuevas');
    } else {
      console.log('\n✅ Conexión exitosa pero sin locations');
    }
  } else {
    console.log('\n❌ Error de conexión:', result.error);
  }
  
  process.exit(0);
}

main();