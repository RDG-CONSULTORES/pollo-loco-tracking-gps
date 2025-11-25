require('dotenv').config();
const db = require('./src/config/database');
const ZenputAPIClient = require('./src/integrations/zenput-api-client');

/**
 * BÚSQUEDA AUTOMÁTICA DE LAS 3 NUEVAS SUCURSALES
 * Usando Zenput API para encontrar sucursales no registradas
 */

async function fetchAndCompareZenputBranches() {
  console.log('🔍 BUSCANDO NUEVAS SUCURSALES VIA ZENPUT API...\n');
  
  try {
    // 1. Test conexión Zenput
    const isConnected = await ZenputAPIClient.testConnection();
    if (!isConnected) {
      console.log('❌ No se pudo conectar a Zenput API');
      console.log('💡 Verifica variables de entorno: ZENPUT_API_KEY, ZENPUT_ORG_ID');
      return { success: false, error: 'API_CONNECTION_FAILED' };
    }

    // 2. Obtener sucursales actuales en BD
    const currentBranchesResult = await db.query(`
      SELECT 
        id, name, city, state, 
        latitude, longitude,
        address, phone, email,
        group_name,
        zenput_id
      FROM branches 
      ORDER BY name
    `);
    
    console.log(`📊 Sucursales actuales en BD: ${currentBranchesResult.rows.length}\n`);
    
    // 3. Obtener sucursales desde Zenput API
    const zenputLocations = await ZenputAPIClient.getLocations();
    console.log(`📍 Sucursales obtenidas desde Zenput API: ${zenputLocations.length}\n`);
    
    if (zenputLocations.length === 0) {
      console.log('⚠️ No se encontraron sucursales en Zenput API');
      return { success: false, error: 'NO_ZENPUT_LOCATIONS' };
    }

    // 4. Comparar y encontrar diferencias
    const currentBranchNames = new Set(
      currentBranchesResult.rows.map(b => b.name.toLowerCase().trim())
    );
    
    const newBranches = zenputLocations.filter(zenputBranch => {
      const zenputName = zenputBranch.name.toLowerCase().trim();
      return !currentBranchNames.has(zenputName);
    });

    console.log('🆕 ANÁLISIS DE DIFERENCIAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (newBranches.length === 0) {
      console.log('✅ No se encontraron sucursales nuevas en Zenput API');
      console.log('   Todas las sucursales de Zenput ya están registradas');
    } else {
      console.log(`🎯 ENCONTRADAS ${newBranches.length} SUCURSALES NUEVAS:\n`);
      
      newBranches.forEach((branch, index) => {
        console.log(`${index + 1}. ${branch.name}`);
        console.log(`   📍 Dirección: ${branch.address || 'No especificada'}`);
        console.log(`   🌍 Coordenadas: ${branch.latitude}, ${branch.longitude}`);
        console.log(`   🏢 Grupo: ${branch.group_name || 'No especificado'}`);
        console.log(`   📧 Manager: ${branch.director_name || 'No especificado'}`);
        console.log(`   📱 Código: ${branch.location_code || 'No especificado'}`);
        
        // Validar coordenadas
        const lat = parseFloat(branch.latitude);
        const lng = parseFloat(branch.longitude);
        
        if (lat && lng && lat >= 14.5 && lat <= 32.7 && lng >= -118.5 && lng <= -86.7) {
          console.log(`   ✅ Coordenadas válidas (México)`);
          console.log(`   🗺️ Google Maps: https://maps.google.com/?q=${lat},${lng}`);
        } else {
          console.log(`   ⚠️ Coordenadas inválidas o faltantes`);
        }
        console.log('');
      });
    }

    // 5. Análisis de grupos operativos
    if (newBranches.length > 0) {
      console.log('🏢 ANÁLISIS DE GRUPOS OPERATIVOS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const groupsResult = await db.query('SELECT id, name FROM operational_groups ORDER BY name');
      const availableGroups = groupsResult.rows;
      
      console.log('\n📋 GRUPOS DISPONIBLES EN BD:');
      availableGroups.forEach(group => {
        console.log(`  ID ${group.id}: ${group.name}`);
      });
      
      console.log('\n🎯 ASIGNACIÓN DE GRUPOS SUGERIDA:');
      newBranches.forEach(branch => {
        // Intentar match por nombre de grupo/región
        const suggestedGroup = availableGroups.find(g => 
          g.name.toLowerCase().includes(branch.group_name?.toLowerCase() || '') ||
          (branch.group_name || '').toLowerCase().includes(g.name.toLowerCase())
        );
        
        if (suggestedGroup) {
          console.log(`  ${branch.name} → ${suggestedGroup.name} (ID: ${suggestedGroup.id})`);
        } else {
          console.log(`  ${branch.name} → ⚠️ Grupo no encontrado: "${branch.group_name}"`);
          console.log(`    Sugerencia: Usar grupo por defecto o crear nuevo grupo`);
        }
      });
    }

    // 6. Preparar respuesta estructurada
    const response = {
      success: true,
      zenput_api_status: 'connected',
      current_branches_count: currentBranchesResult.rows.length,
      zenput_locations_count: zenputLocations.length,
      new_branches_found: newBranches.length,
      new_branches: newBranches.map(branch => ({
        name: branch.name,
        address: branch.address,
        latitude: branch.latitude,
        longitude: branch.longitude,
        group_name: branch.group_name,
        director_name: branch.director_name,
        location_code: branch.location_code,
        coordinates_valid: branch.latitude && branch.longitude && 
          parseFloat(branch.latitude) >= 14.5 && parseFloat(branch.latitude) <= 32.7 &&
          parseFloat(branch.longitude) >= -118.5 && parseFloat(branch.longitude) <= -86.7
      }))
    };

    // 7. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (newBranches.length === 0) {
      console.log('✅ Sistema sincronizado con Zenput API');
      console.log('   No se requieren acciones adicionales');
    } else if (newBranches.length === 3) {
      console.log('🎯 PERFECTO: Encontradas exactamente 3 sucursales nuevas');
      console.log('   Estas son las 3 sucursales que Roberto mencionó');
      console.log('   Siguiente paso: Ejecutar integración automática');
    } else if (newBranches.length > 3) {
      console.log(`⚠️ Encontradas ${newBranches.length} sucursales (más de las 3 esperadas)`);
      console.log('   Revisar cuáles son las 3 más recientes');
    } else {
      console.log(`⚠️ Solo encontradas ${newBranches.length} sucursales nuevas (menos de 3)`);
      console.log('   Posible que algunas no estén en Zenput API aún');
    }

    return response;
    
  } catch (error) {
    console.error('❌ Error en búsqueda Zenput:', error.message);
    return { success: false, error: error.message };
  }
}

// Función para integrar automáticamente las nuevas sucursales
async function integrateNewBranches(newBranchesData) {
  console.log('\n🔄 INICIANDO INTEGRACIÓN AUTOMÁTICA...');
  
  try {
    // Obtener siguiente ID disponible
    const maxIdResult = await db.query('SELECT MAX(id) as max_id FROM branches');
    let nextId = (maxIdResult.rows[0].max_id || 82) + 1;

    // Obtener grupos operativos para asignación
    const groupsResult = await db.query('SELECT id, name FROM operational_groups ORDER BY name');
    const availableGroups = groupsResult.rows;

    console.log(`🔢 Próximo ID disponible: ${nextId}`);
    console.log(`📝 Integrando ${newBranchesData.length} sucursales...\n`);

    for (const [index, branchData] of newBranchesData.entries()) {
      const branchId = nextId + index;
      
      // Buscar grupo operativo apropiado
      let groupId = 1; // Default
      const matchedGroup = availableGroups.find(g => 
        g.name.toLowerCase().includes(branchData.group_name?.toLowerCase() || '') ||
        (branchData.group_name || '').toLowerCase().includes(g.name.toLowerCase())
      );
      
      if (matchedGroup) {
        groupId = matchedGroup.id;
      }

      // Insertar sucursal
      await db.query(`
        INSERT INTO branches (
          id, name, address,
          latitude, longitude,
          group_id, group_name,
          phone, email,
          city, state, municipality,
          country, active, gps_validated,
          zenput_id, director_name,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
        )
      `, [
        branchId,
        branchData.name,
        branchData.address || 'Dirección por actualizar',
        branchData.latitude,
        branchData.longitude,
        groupId,
        branchData.group_name || 'Por asignar',
        branchData.phone || 'Por actualizar',
        branchData.email || `sucursal${branchId}@eplcas.com`,
        branchData.city || 'Por actualizar',
        branchData.state || 'Por actualizar', 
        branchData.municipality || 'Por actualizar',
        'México',
        true, // active
        branchData.coordinates_valid, // gps_validated
        branchData.location_code || null, // zenput_id
        branchData.director_name || 'Por asignar'
      ]);

      console.log(`✅ ${branchId}. ${branchData.name}`);
      console.log(`   📍 ${branchData.latitude}, ${branchData.longitude}`);
      console.log(`   🏢 Grupo: ${branchData.group_name} (ID: ${groupId})`);
      console.log('');
    }

    // Verificar total final
    const totalResult = await db.query('SELECT COUNT(*) as total FROM branches');
    const newTotal = parseInt(totalResult.rows[0].total);
    
    console.log(`🎉 INTEGRACIÓN COMPLETADA`);
    console.log(`📊 Total sucursales ahora: ${newTotal} (desde 82)`);
    console.log(`🆕 Sucursales añadidas: ${newBranchesData.length}`);
    
    return { success: true, added_count: newBranchesData.length, new_total: newTotal };
    
  } catch (error) {
    console.error('❌ Error en integración:', error.message);
    throw error;
  }
}

// Ejecución principal
async function main() {
  const searchResult = await fetchAndCompareZenputBranches();
  
  if (searchResult.success && searchResult.new_branches_found > 0) {
    console.log('\n❓ ¿PROCEDER CON INTEGRACIÓN AUTOMÁTICA?');
    console.log('   Para integrar automáticamente, ejecuta:');
    console.log('   node fetch-zenput-branches.js --integrate');
    
    // Si se pasa flag --integrate, proceder automáticamente
    if (process.argv.includes('--integrate')) {
      console.log('\n🚀 PROCEDIENDO CON INTEGRACIÓN...');
      await integrateNewBranches(searchResult.new_branches);
    }
  }
  
  process.exit(0);
}

main();