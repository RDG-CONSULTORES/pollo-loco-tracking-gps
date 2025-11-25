require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * BÚSQUEDA FINAL DE NUEVAS SUCURSALES - ZENPUT API V3
 * Endpoint confirmado: https://www.zenput.com/api/v3/locations/
 * Autenticación: X-API-TOKEN
 * Objetivo: Encontrar las 3 nuevas sucursales que Roberto mencionó
 */

class ZenputLocationsFinder {
  constructor() {
    this.apiToken = process.env.ZENPUT_API_KEY;
    this.endpoint = 'https://www.zenput.com/api/v3/locations/';
  }

  async getAllLocations() {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Conectando a: ${this.endpoint}`);
      console.log(`🔑 X-API-TOKEN: ${this.apiToken.substring(0, 8)}...`);
      
      const options = {
        method: 'GET',
        headers: {
          'X-API-TOKEN': this.apiToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = https.request(this.endpoint, options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          console.log(`📡 Status: ${res.statusCode}`);
          console.log(`📦 Response: ${data.length} chars`);
          
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              console.log(`✅ JSON válido - estructura: ${Object.keys(parsed).join(', ')}`);
              
              if (parsed.data && Array.isArray(parsed.data)) {
                console.log(`📊 Locations encontradas: ${parsed.data.length}`);
                resolve(parsed.data);
              } else {
                console.log('⚠️ Estructura inesperada:', parsed);
                resolve([]);
              }
            } catch (error) {
              console.error('❌ JSON Parse Error:', error.message);
              reject(error);
            }
          } else {
            console.error(`❌ HTTP ${res.statusCode}: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async fetchAllPaginatedLocations() {
    // El endpoint puede tener paginación, obtener todas las páginas
    let allLocations = [];
    let currentPage = 1;
    let hasNextPage = true;
    
    while (hasNextPage) {
      try {
        console.log(`\n📄 Obteniendo página ${currentPage}...`);
        
        const pageEndpoint = `${this.endpoint}?page=${currentPage}`;
        const pageData = await this.getPage(pageEndpoint);
        
        if (pageData.data && pageData.data.length > 0) {
          allLocations.push(...pageData.data);
          console.log(`✅ Página ${currentPage}: ${pageData.data.length} locations`);
          
          // Verificar si hay más páginas
          if (pageData.meta && pageData.meta.page < pageData.meta.total_pages) {
            currentPage++;
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
        
        // Evitar demasiadas peticiones
        if (currentPage > 10) {
          console.log('⚠️ Límite de páginas alcanzado (10), continuando...');
          break;
        }
        
      } catch (error) {
        console.log(`❌ Error en página ${currentPage}:`, error.message);
        hasNextPage = false;
      }
    }
    
    // Si la paginación falla, usar endpoint simple
    if (allLocations.length === 0) {
      console.log('\n🔄 Paginación falló, usando endpoint simple...');
      allLocations = await this.getAllLocations();
    }
    
    return allLocations;
  }

  async getPage(url) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: {
          'X-API-TOKEN': this.apiToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

async function findNewBranchesFromZenput() {
  console.log('🔍 BÚSQUEDA FINAL DE NUEVAS SUCURSALES - ZENPUT API V3\n');
  
  try {
    const zenput = new ZenputLocationsFinder();

    // 1. Obtener sucursales actuales de BD
    console.log('📊 Obteniendo sucursales actuales de BD...');
    const currentBranches = await db.query(`
      SELECT id, name, city, state, latitude, longitude, address, group_name
      FROM branches 
      WHERE active = true
      ORDER BY name
    `);
    
    console.log(`📋 Total sucursales en BD: ${currentBranches.rows.length}`);
    
    // Crear set normalizado para comparación
    const currentNames = new Set(
      currentBranches.rows.map(b => b.name.toLowerCase().trim())
    );
    
    console.log('\n🌐 Conectando a Zenput API...');

    // 2. Obtener TODAS las locations de Zenput (con paginación)
    const zenputLocations = await zenput.fetchAllPaginatedLocations();
    
    console.log(`\n📊 Total locations Zenput: ${zenputLocations.length}`);

    if (zenputLocations.length === 0) {
      console.log('❌ No se obtuvieron locations de Zenput');
      return { success: false, error: 'No locations from Zenput' };
    }

    // 3. Mostrar muestra de locations de Zenput
    console.log('\n📋 MUESTRA DE LOCATIONS ZENPUT:');
    console.log('━'.repeat(60));
    
    zenputLocations.slice(0, 5).forEach((loc, i) => {
      console.log(`${i + 1}. ${loc.name}`);
      console.log(`   ID: ${loc.id}`);
      console.log(`   Ciudad: ${loc.city || 'N/A'}`);
      console.log(`   Dirección: ${loc.address || 'N/A'}`);
      console.log(`   Coords: ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
      console.log('');
    });

    // 4. Buscar locations que NO están en BD
    const newLocations = zenputLocations.filter(zenputLoc => {
      const zenputName = zenputLoc.name.toLowerCase().trim();
      return zenputName && !currentNames.has(zenputName);
    });

    console.log(`\n🆕 NUEVAS LOCATIONS ENCONTRADAS: ${newLocations.length}`);
    console.log('━'.repeat(60));

    if (newLocations.length > 0) {
      newLocations.forEach((loc, i) => {
        console.log(`${i + 1}. ⭐ ${loc.name} (NUEVA)`);
        console.log(`   🆔 Zenput ID: ${loc.id}`);
        console.log(`   📍 ${loc.address || 'Sin dirección'}`);
        console.log(`   🏙️ ${loc.city || 'N/A'}, ${loc.state || 'N/A'}`);
        console.log(`   🌍 ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`);
        
        // Validar coordenadas México
        const lat = parseFloat(loc.latitude);
        const lng = parseFloat(loc.longitude);
        if (lat && lng && lat >= 14.5 && lat <= 32.7 && lng >= -118.5 && lng <= -86.7) {
          console.log(`   ✅ Coordenadas válidas (México)`);
          console.log(`   🗺️ Google Maps: https://maps.google.com/?q=${lat},${lng}`);
        } else {
          console.log(`   ⚠️ Coordenadas inválidas o faltantes`);
        }
        console.log('');
      });

      // 5. Análisis del resultado
      console.log('\n📊 ANÁLISIS DEL RESULTADO:');
      console.log('━'.repeat(60));
      
      if (newLocations.length === 3) {
        console.log('🎯 ¡PERFECTO! Exactamente 3 nuevas sucursales encontradas');
        console.log('📋 Estas son las 3 sucursales que Roberto mencionó');
      } else if (newLocations.length < 3) {
        console.log(`⚠️ Solo ${newLocations.length} nuevas (esperábamos 3)`);
        console.log('   Posibles razones:');
        console.log('   • Algunas ya están en BD con nombres diferentes');
        console.log('   • No todas están en Zenput aún');
      } else {
        console.log(`📈 ${newLocations.length} nuevas encontradas (más de las 3 esperadas)`);
        console.log('   Las primeras 3 son probablemente las más recientes');
      }

      return {
        success: true,
        total_zenput: zenputLocations.length,
        total_bd: currentBranches.rows.length,
        new_locations: newLocations,
        ready_for_integration: newLocations.length > 0
      };

    } else {
      console.log('✅ No se encontraron locations nuevas');
      console.log('   Todas las locations de Zenput ya están en BD');
      
      // Análisis de nombres similares
      console.log('\n🔍 ANÁLISIS DE NOMBRES SIMILARES:');
      console.log('━'.repeat(60));
      
      const similarNames = [];
      zenputLocations.forEach(zenputLoc => {
        const zenputName = zenputLoc.name.toLowerCase().trim();
        
        currentBranches.rows.forEach(dbBranch => {
          const dbName = dbBranch.name.toLowerCase().trim();
          
          // Verificar similitud (parcial)
          if (zenputName.includes(dbName.substring(0, 10)) || dbName.includes(zenputName.substring(0, 10))) {
            similarNames.push({
              zenput: zenputLoc.name,
              bd: dbBranch.name,
              similarity: 'partial_match'
            });
          }
        });
      });

      if (similarNames.length > 0) {
        console.log('📋 Nombres similares encontrados (posibles duplicados):');
        similarNames.slice(0, 10).forEach(match => {
          console.log(`   Zenput: "${match.zenput}"`);
          console.log(`   BD:     "${match.bd}"`);
          console.log('');
        });
      }

      return {
        success: true,
        total_zenput: zenputLocations.length,
        total_bd: currentBranches.rows.length,
        new_locations: [],
        all_synced: true,
        similar_names: similarNames
      };
    }

  } catch (error) {
    console.error('❌ Error en búsqueda final:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar búsqueda final
async function main() {
  const result = await findNewBranchesFromZenput();
  
  console.log('\n🎯 RESULTADO FINAL:');
  console.log('━'.repeat(60));
  
  if (result.success) {
    if (result.ready_for_integration) {
      console.log(`✅ ÉXITO: ${result.new_locations.length} nuevas sucursales encontradas`);
      console.log(`📊 Total Zenput: ${result.total_zenput}`);
      console.log(`📊 Total BD: ${result.total_bd}`);
      console.log('\n🚀 SIGUIENTE PASO: Integrar automáticamente las nuevas sucursales');
      
    } else if (result.all_synced) {
      console.log('✅ SISTEMA SINCRONIZADO: No hay sucursales nuevas');
      console.log(`📊 Total Zenput: ${result.total_zenput}`);
      console.log(`📊 Total BD: ${result.total_bd}`);
      
      if (result.similar_names && result.similar_names.length > 0) {
        console.log(`⚠️ ${result.similar_names.length} nombres similares detectados`);
        console.log('   Revisar posibles duplicados');
      }
    }
  } else {
    console.log(`❌ ERROR: ${result.error}`);
  }
  
  process.exit(0);
}

main();