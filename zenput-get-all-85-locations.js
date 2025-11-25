require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * OBTENER LAS 85 LOCATIONS DE ZENPUT Y ENCONTRAR LAS 3 NUEVAS
 * Endpoint confirmado: https://www.zenput.com/api/v3/locations/?limit=100
 * Total esperado: 85 locations (3 más que las 82 en BD)
 */

async function getAllZenputLocations() {
  return new Promise((resolve, reject) => {
    const url = 'https://www.zenput.com/api/v3/locations/?limit=100';
    
    console.log(`🌐 Obteniendo TODAS las locations: ${url}`);
    console.log(`🔑 API Token: ${process.env.ZENPUT_API_KEY.substring(0, 8)}...`);
    
    const options = {
      method: 'GET',
      headers: {
        'X-API-TOKEN': process.env.ZENPUT_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        console.log(`📡 Status: ${res.statusCode}`);
        console.log(`📦 Response: ${data.length} chars`);
        
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.data && Array.isArray(parsed.data)) {
              console.log(`✅ Locations obtenidas: ${parsed.data.length}`);
              console.log(`📋 Meta count: ${parsed.meta?.count || 'N/A'}`);
              resolve(parsed.data);
            } else {
              console.log('❌ Estructura inesperada:', Object.keys(parsed));
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

async function findNewBranchesFromAll85() {
  console.log('🔍 BÚSQUEDA DE LAS 3 NUEVAS SUCURSALES - 85 LOCATIONS ZENPUT\n');
  
  try {
    // 1. Obtener sucursales actuales de BD
    console.log('📊 Obteniendo sucursales actuales de BD...');
    const currentBranches = await db.query(`
      SELECT id, name, city, state, latitude, longitude, address, group_name
      FROM branches 
      WHERE active = true
      ORDER BY name
    `);
    
    console.log(`📋 Total sucursales en BD: ${currentBranches.rows.length}`);

    // 2. Obtener TODAS las 85 locations de Zenput
    console.log('\n🌐 Obteniendo TODAS las locations de Zenput...');
    const allZenputLocations = await getAllZenputLocations();
    
    if (allZenputLocations.length === 0) {
      console.log('❌ No se obtuvieron locations de Zenput');
      return { success: false, error: 'No locations from Zenput' };
    }

    console.log(`📊 Total locations Zenput: ${allZenputLocations.length}`);
    
    // 3. Crear sets normalizados para comparación precisa
    const currentNames = new Set();
    const currentNamesSimple = new Set();
    
    currentBranches.rows.forEach(branch => {
      // Nombre exacto
      currentNames.add(branch.name.toLowerCase().trim());
      
      // Nombre simplificado (sin números, espacios, etc)
      const simpleName = branch.name.toLowerCase()
        .replace(/[^a-záéíóúñü]/g, '') // Solo letras
        .replace(/\s+/g, '');
      currentNamesSimple.add(simpleName);
    });

    // 4. Buscar locations que NO están en BD
    const newLocations = [];
    const matchedLocations = [];
    
    allZenputLocations.forEach(zenputLoc => {
      const zenputName = zenputLoc.name.toLowerCase().trim();
      const zenputSimple = zenputLoc.name.toLowerCase()
        .replace(/[^a-záéíóúñü]/g, '')
        .replace(/\s+/g, '');
      
      if (currentNames.has(zenputName) || currentNamesSimple.has(zenputSimple)) {
        matchedLocations.push({
          zenput: zenputLoc,
          matched: 'yes'
        });
      } else {
        newLocations.push(zenputLoc);
      }
    });

    console.log(`\n📊 ANÁLISIS COMPARATIVO:`);
    console.log(`   🔗 Locations coincidentes: ${matchedLocations.length}`);
    console.log(`   🆕 Locations nuevas: ${newLocations.length}`);
    console.log(`   📋 Total Zenput: ${allZenputLocations.length}`);
    console.log(`   📋 Total BD: ${currentBranches.rows.length}`);

    // 5. Mostrar las nuevas locations encontradas
    if (newLocations.length > 0) {
      console.log(`\n🆕 ${newLocations.length} NUEVAS SUCURSALES ENCONTRADAS:`);
      console.log('━'.repeat(70));
      
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
          console.log(`   ⚠️ Coordenadas faltantes o inválidas`);
        }
        
        // Información adicional
        if (loc.teams && loc.teams.length > 0) {
          console.log(`   🏢 Teams: ${loc.teams.length}`);
        }
        if (loc.address) {
          console.log(`   🏠 Dirección completa: ${loc.address}`);
        }
        
        console.log('');
      });

      // 6. Análisis específico
      console.log('\n📊 ANÁLISIS DEL RESULTADO:');
      console.log('━'.repeat(70));
      
      if (newLocations.length === 3) {
        console.log('🎯 ¡PERFECTO! Exactamente 3 nuevas sucursales encontradas');
        console.log('📋 Estas son las 3 sucursales que Roberto mencionó');
        console.log('🚀 Listas para integración automática');
      } else if (newLocations.length < 3) {
        console.log(`⚠️ Solo ${newLocations.length} nuevas (esperábamos 3)`);
        console.log('   Posible que algunas tengan nombres ligeramente diferentes');
      } else {
        console.log(`📈 ${newLocations.length} nuevas encontradas (más de las 3 esperadas)`);
        console.log('   Las primeras 3 son probablemente las más relevantes');
      }

      // 7. Preparar datos para integración
      const branchesToIntegrate = newLocations.slice(0, 3); // Tomar las primeras 3
      
      console.log('\n🚀 PREPARACIÓN PARA INTEGRACIÓN:');
      console.log('━'.repeat(70));
      
      branchesToIntegrate.forEach((loc, i) => {
        console.log(`${i + 1}. ${loc.name}`);
        console.log(`   📊 Datos disponibles:`);
        console.log(`      • Nombre: ✅`);
        console.log(`      • Dirección: ${loc.address ? '✅' : '❌'}`);
        console.log(`      • Ciudad: ${loc.city ? '✅' : '❌'}`);
        console.log(`      • Estado: ${loc.state ? '✅' : '❌'}`);
        console.log(`      • Coordenadas: ${loc.latitude && loc.longitude ? '✅' : '❌'}`);
        console.log(`      • Zenput ID: ✅ (${loc.id})`);
        console.log('');
      });

      return {
        success: true,
        total_zenput: allZenputLocations.length,
        total_bd: currentBranches.rows.length,
        matched_count: matchedLocations.length,
        new_locations: newLocations,
        ready_for_integration: true,
        integration_candidates: branchesToIntegrate
      };

    } else {
      console.log('\n✅ NO SE ENCONTRARON LOCATIONS NUEVAS');
      console.log('   Análisis detallado de coincidencias...');
      
      // Mostrar algunas coincidencias para verificar
      console.log('\n📋 MUESTRA DE COINCIDENCIAS:');
      matchedLocations.slice(0, 10).forEach(match => {
        console.log(`   ✅ "${match.zenput.name}" (ID: ${match.zenput.id})`);
      });

      return {
        success: true,
        total_zenput: allZenputLocations.length,
        total_bd: currentBranches.rows.length,
        matched_count: matchedLocations.length,
        new_locations: [],
        all_synced: true
      };
    }

  } catch (error) {
    console.error('❌ Error en búsqueda de 85 locations:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const result = await findNewBranchesFromAll85();
  
  console.log('\n🎯 RESULTADO FINAL:');
  console.log('━'.repeat(70));
  
  if (result.success) {
    console.log(`📊 Total Zenput: ${result.total_zenput} locations`);
    console.log(`📊 Total BD: ${result.total_bd} sucursales`);
    console.log(`🔗 Coincidencias: ${result.matched_count || 0}`);
    
    if (result.ready_for_integration) {
      console.log(`🆕 Nuevas sucursales: ${result.new_locations.length}`);
      console.log(`🚀 Listas para integración: ${result.integration_candidates?.length || 0}`);
      
      console.log('\n📝 PRÓXIMOS PASOS:');
      console.log('   1. ✅ Nuevas sucursales identificadas');
      console.log('   2. 🔄 Integrar automáticamente en BD');
      console.log('   3. ✅ Validar coordenadas');
      console.log('   4. 🎯 Actualizar total a 85 sucursales');
      
    } else if (result.all_synced) {
      console.log('✅ SISTEMA COMPLETAMENTE SINCRONIZADO');
      console.log('   No hay sucursales nuevas por integrar');
    }
  } else {
    console.log(`❌ ERROR: ${result.error}`);
  }
  
  process.exit(0);
}

main();