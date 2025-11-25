require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * ZENPUT API V3 LOCATIONS - DOCUMENTACIÓN OFICIAL
 * Usando endpoint oficial: https://www.zenput.com/api/v3/locations/
 * Documentación: https://developer.zenput.com/reference/get-locations-v3-ref
 */

class ZenputOfficialAPI {
  constructor() {
    this.apiKey = process.env.ZENPUT_API_KEY;
    this.baseUrl = 'https://www.zenput.com/api/v3';
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      
      console.log(`🌐 Conectando: ${url}`);
      console.log(`🔑 API Key: ${this.apiKey.substring(0, 8)}...`);
      
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'EPL-CAS-GPS-System/1.0'
        },
        timeout: 15000
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        console.log(`📡 Status: ${res.statusCode}`);
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          console.log(`📦 Response Length: ${data.length} chars`);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              console.log(`✅ Respuesta exitosa`);
              
              // Mostrar estructura de la respuesta
              console.log(`📋 Estructura:`, Object.keys(parsed));
              
              if (parsed.data && Array.isArray(parsed.data)) {
                console.log(`📊 Locations encontradas: ${parsed.data.length}`);
                if (parsed.data.length > 0) {
                  console.log(`🎯 Primer location:`, JSON.stringify(parsed.data[0], null, 2).substring(0, 300));
                }
              } else if (Array.isArray(parsed)) {
                console.log(`📊 Array directo con ${parsed.length} locations`);
                if (parsed.length > 0) {
                  console.log(`🎯 Primer location:`, JSON.stringify(parsed[0], null, 2).substring(0, 300));
                }
              }
              
              resolve(parsed);
            } catch (error) {
              console.error('❌ JSON Parse Error:', error.message);
              console.log('Raw response preview:', data.substring(0, 500));
              reject(error);
            }
          } else {
            console.log(`❌ Error HTTP: ${res.statusCode}`);
            console.log(`Response:`, data.substring(0, 500));
            
            if (res.statusCode === 401) {
              console.log('🔑 Error de autenticación - API key inválida o expirada');
            } else if (res.statusCode === 403) {
              console.log('🚫 Permisos insuficientes para acceder a locations');
            } else if (res.statusCode === 404) {
              console.log('🔍 Endpoint no encontrado - verificar URL');
            }
            
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

  async getLocations() {
    console.log('🔍 Obteniendo locations desde Zenput API v3 (oficial)...');
    return await this.makeRequest('/locations/');
  }

  async getOrganization() {
    console.log('🏢 Obteniendo información de organización...');
    try {
      return await this.makeRequest('/organization/');
    } catch (error) {
      console.log('⚠️ No se pudo obtener info de organización:', error.message);
      return null;
    }
  }
}

async function findNewBranchesOfficial() {
  console.log('🔍 BÚSQUEDA OFICIAL ZENPUT API V3 - EPL CAS\n');
  
  try {
    const zenput = new ZenputOfficialAPI();
    
    // 1. Test de conexión y obtener organización
    const orgInfo = await zenput.getOrganization();
    if (orgInfo) {
      console.log('🏢 Organización conectada exitosamente');
    }

    // 2. Obtener sucursales actuales de BD
    const currentBranches = await db.query(`
      SELECT 
        id, name, city, state, latitude, longitude, 
        group_name, address, phone, email
      FROM branches 
      WHERE active = true
      ORDER BY name
    `);
    
    console.log(`📊 Sucursales actuales en BD: ${currentBranches.rows.length}`);
    
    // Crear set de nombres normalizados para comparación
    const currentNames = new Set(
      currentBranches.rows.map(b => b.name.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
    );

    // 3. Obtener locations desde Zenput API
    const zenputData = await zenput.getLocations();
    
    if (!zenputData) {
      throw new Error('No se pudieron obtener locations de Zenput API');
    }

    // Detectar estructura de datos
    let locations = [];
    if (zenputData.data && Array.isArray(zenputData.data)) {
      locations = zenputData.data;
    } else if (Array.isArray(zenputData)) {
      locations = zenputData;
    } else if (zenputData.results && Array.isArray(zenputData.results)) {
      locations = zenputData.results;
    }

    console.log(`🎯 Locations obtenidas de Zenput: ${locations.length}`);

    if (locations.length === 0) {
      console.log('⚠️ No se encontraron locations en Zenput API');
      console.log('📋 Estructura de respuesta:', JSON.stringify(zenputData, null, 2).substring(0, 500));
      return { success: false, error: 'No locations found' };
    }

    // 4. Mostrar muestra de locations
    console.log('\n📋 MUESTRA DE LOCATIONS DE ZENPUT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    locations.slice(0, 5).forEach((loc, i) => {
      console.log(`${i + 1}. ${loc.name || loc.title || 'Sin nombre'}`);
      console.log(`   ID: ${loc.id || 'N/A'}`);
      console.log(`   Dirección: ${loc.address || 'N/A'}`);
      console.log(`   Ciudad: ${loc.city || 'N/A'}, ${loc.state || 'N/A'}`);
      console.log(`   Coords: ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
      console.log(`   Activo: ${loc.is_active !== false ? 'Sí' : 'No'}`);
      console.log('');
    });

    // 5. Buscar locations nuevas
    const newLocations = locations.filter(zenputLoc => {
      const zenputName = (zenputLoc.name || zenputLoc.title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      return zenputName && !currentNames.has(zenputName) && zenputLoc.is_active !== false;
    });

    console.log(`🆕 NUEVAS LOCATIONS ENCONTRADAS: ${newLocations.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (newLocations.length > 0) {
      newLocations.forEach((loc, i) => {
        console.log(`${i + 1}. ${loc.name || loc.title}`);
        console.log(`   📍 ${loc.address || 'Sin dirección'}`);
        console.log(`   🌍 ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
        console.log(`   🏢 Teams: ${(loc.teams || []).length}`);
        console.log(`   👥 Owners: ${(loc.owners || []).length}`);
        console.log(`   🆔 Zenput ID: ${loc.id}`);
        console.log('');
      });

      if (newLocations.length === 3) {
        console.log('🎯 ¡PERFECTO! Exactamente 3 nuevas sucursales encontradas');
        console.log('📋 Estas son las sucursales que Roberto mencionó');
      } else {
        console.log(`⚠️ Se esperaban 3 sucursales, encontradas: ${newLocations.length}`);
      }

      return {
        success: true,
        new_locations: newLocations,
        total_zenput: locations.length,
        total_current: currentBranches.rows.length,
        ready_for_integration: newLocations.length > 0
      };
    } else {
      console.log('✅ No se encontraron locations nuevas');
      console.log('   Todas las locations de Zenput ya están en el sistema');
      
      return {
        success: true,
        new_locations: [],
        total_zenput: locations.length,
        total_current: currentBranches.rows.length,
        all_synced: true
      };
    }

  } catch (error) {
    console.error('❌ Error en búsqueda Zenput oficial:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar búsqueda
async function main() {
  const result = await findNewBranchesOfficial();
  
  if (result.success) {
    if (result.new_locations && result.new_locations.length > 0) {
      console.log('\n🚀 RESULTADO: Nuevas sucursales encontradas');
      console.log(`📊 Para integrar: ${result.new_locations.length} sucursales`);
      console.log('📋 Próximo paso: Integración automática');
    } else {
      console.log('\n✅ RESULTADO: Sistema sincronizado');
      console.log('📊 No hay sucursales nuevas por integrar');
    }
  } else {
    console.log('\n❌ RESULTADO: Error en conexión');
    console.log(`📋 Error: ${result.error}`);
  }
  
  process.exit(0);
}

main();