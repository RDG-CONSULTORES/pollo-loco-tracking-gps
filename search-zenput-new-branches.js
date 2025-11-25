require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * BÚSQUEDA AUTOMÁTICA DE NUEVAS SUCURSALES VIA ZENPUT API
 * Conectando al sistema real de Zenput con credenciales proporcionadas
 */

class ZenputConnector {
  constructor() {
    this.apiKey = process.env.ZENPUT_API_KEY;
    this.baseUrl = 'https://app.zenput.com/api';
  }

  async makeRequest(endpoint, version = 'v3') {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/${version}${endpoint}`;
      
      console.log(`🌐 Conectando: ${url}`);
      
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'EPL-CAS-GPS-System/1.0'
        },
        timeout: 10000
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        // Manejar redirecciones
        if (res.statusCode === 301 || res.statusCode === 302) {
          console.log(`🔄 Redirección a: ${res.headers.location}`);
          if (res.headers.location) {
            // Hacer nueva petición a la URL redirigida
            const redirectReq = https.request(res.headers.location, options, (redirectRes) => {
              let redirectData = '';
              redirectRes.on('data', chunk => redirectData += chunk);
              redirectRes.on('end', () => {
                try {
                  console.log(`📡 Redirect Status: ${redirectRes.statusCode}`);
                  if (redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
                    const parsed = JSON.parse(redirectData);
                    console.log(`✅ API Response successful after redirect`);
                    resolve(parsed);
                  } else {
                    console.log(`Response: ${redirectData.substring(0, 500)}`);
                    reject(new Error(`HTTP ${redirectRes.statusCode}: ${redirectData}`));
                  }
                } catch (error) {
                  console.error('❌ JSON Parse Error:', error.message);
                  console.log('Raw response:', redirectData.substring(0, 200));
                  reject(error);
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
          try {
            console.log(`📡 Response Status: ${res.statusCode}`);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              console.log(`✅ API Response successful`);
              resolve(parsed);
            } else {
              console.log(`❌ API Error: ${res.statusCode}`);
              console.log(`Response: ${data.substring(0, 500)}`);
              
              // Si es error de autenticación, mostrar más detalles
              if (res.statusCode === 401) {
                console.log('🔑 Error de autenticación - verificar API key');
              } else if (res.statusCode === 404) {
                console.log('🔍 Endpoint no encontrado - verificar URL');
              }
              
              reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            }
          } catch (error) {
            console.error('❌ JSON Parse Error:', error.message);
            console.log('Raw response:', data.substring(0, 200));
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request Error:', error.message);
        reject(error);
      });

      req.on('timeout', () => {
        console.error('❌ Request Timeout');
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async getLocations(version = 'v3') {
    try {
      console.log(`🔍 Obteniendo locations desde Zenput API ${version}...`);
      
      // Primero probamos v3
      let response = await this.makeRequest('/locations', version);
      
      // Si v3 no funciona, probamos v1
      if (!response && version === 'v3') {
        console.log('⚠️ v3 falló, probando v1...');
        response = await this.makeRequest('/locations', 'v1');
      }
      
      return response;
    } catch (error) {
      console.error(`❌ Error con ${version}:`, error.message);
      
      if (version === 'v3') {
        console.log('🔄 Intentando con v1...');
        return await this.getLocations('v1');
      }
      
      throw error;
    }
  }

  async getOrganizations() {
    try {
      console.log('🏢 Obteniendo organizaciones...');
      return await this.makeRequest('/organizations', 'v3');
    } catch (error) {
      console.error('❌ Error obteniendo organizaciones:', error.message);
      return null;
    }
  }
}

async function searchNewBranches() {
  console.log('🔍 BÚSQUEDA AUTOMÁTICA ZENPUT API - EPL CAS\n');
  
  try {
    const zenput = new ZenputConnector();
    
    // 1. Test de conexión básica
    console.log('🔐 Verificando credenciales...');
    console.log(`API Key: ${process.env.ZENPUT_API_KEY?.substring(0, 8)}...`);
    
    // 2. Intentar obtener organizaciones primero
    const orgs = await zenput.getOrganizations();
    if (orgs) {
      console.log('🏢 Organizaciones disponibles:');
      if (orgs.data) {
        orgs.data.forEach(org => {
          console.log(`  ID: ${org.id} - ${org.name}`);
        });
      }
      console.log('');
    }

    // 3. Obtener ubicaciones actuales de BD
    const currentBranches = await db.query(`
      SELECT name, city, state, latitude, longitude 
      FROM branches 
      WHERE active = true
      ORDER BY name
    `);
    
    console.log(`📊 Sucursales actuales en BD: ${currentBranches.rows.length}`);
    const currentNames = new Set(
      currentBranches.rows.map(b => b.name.toLowerCase().trim())
    );

    // 4. Obtener locations desde Zenput API
    const zenputData = await zenput.getLocations();
    
    if (!zenputData) {
      throw new Error('No se pudieron obtener locations de Zenput API');
    }

    console.log('📍 RESPUESTA ZENPUT API:');
    console.log('Estructura:', Object.keys(zenputData));
    
    // Detectar estructura de datos
    let locations = [];
    if (zenputData.data) {
      locations = zenputData.data;
    } else if (zenputData.locations) {
      locations = zenputData.locations;
    } else if (Array.isArray(zenputData)) {
      locations = zenputData;
    } else {
      console.log('📋 Estructura completa:');
      console.log(JSON.stringify(zenputData, null, 2).substring(0, 1000));
    }

    console.log(`🎯 Locations encontradas en Zenput: ${locations.length}`);

    if (locations.length > 0) {
      console.log('\n📋 PRIMERAS 5 LOCATIONS DE ZENPUT:');
      locations.slice(0, 5).forEach((loc, i) => {
        console.log(`${i + 1}. ${loc.name || 'Sin nombre'}`);
        console.log(`   ID: ${loc.id || 'N/A'}`);
        console.log(`   Dirección: ${loc.address || 'N/A'}`);
        console.log(`   Coords: ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
        console.log('');
      });

      // 5. Buscar diferencias
      const newLocations = locations.filter(zenputLoc => {
        const zenputName = (zenputLoc.name || '').toLowerCase().trim();
        return zenputName && !currentNames.has(zenputName);
      });

      if (newLocations.length > 0) {
        console.log(`🆕 ENCONTRADAS ${newLocations.length} NUEVAS LOCATIONS:`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        newLocations.forEach((loc, i) => {
          console.log(`${i + 1}. ${loc.name}`);
          console.log(`   📍 ${loc.address || 'Sin dirección'}`);
          console.log(`   🌍 ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
          console.log(`   🏢 Region: ${loc.region || loc.group || 'N/A'}`);
          console.log(`   🆔 ID: ${loc.id}`);
          console.log('');
        });

        // ¿Son exactamente 3?
        if (newLocations.length === 3) {
          console.log('🎯 PERFECTO: Exactamente 3 nuevas sucursales encontradas!');
          console.log('📋 Estas son las sucursales que Roberto mencionó');
          
          return {
            success: true,
            new_branches_count: newLocations.length,
            new_branches: newLocations
          };
        } else {
          console.log(`⚠️ Se esperaban 3 sucursales, encontradas: ${newLocations.length}`);
        }
      } else {
        console.log('✅ No se encontraron locations nuevas en Zenput');
        console.log('   Todas las locations ya están en el sistema');
      }
    }

    return {
      success: true,
      zenput_locations: locations.length,
      current_branches: currentBranches.rows.length,
      api_connected: true
    };

  } catch (error) {
    console.error('❌ Error en búsqueda Zenput:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar búsqueda
async function main() {
  const result = await searchNewBranches();
  
  if (result.success && result.new_branches) {
    console.log('\n🚀 PRÓXIMO PASO: Integración automática disponible');
    console.log('   Ejecuta: node search-zenput-new-branches.js --integrate');
  } else if (result.api_connected) {
    console.log('\n✅ Conexión exitosa al API Zenput');
    console.log('   Se necesita análisis manual o las sucursales ya están integradas');
  }
  
  process.exit(0);
}

main();