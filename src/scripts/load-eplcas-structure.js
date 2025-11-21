/**
 * Load EPL CAS Structure - Real Data from CSV
 * Script para cargar la estructura real de EPL CAS con 82 sucursales y 20 grupos operativos
 */

const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const db = require('../config/database');

/**
 * Main function to load EPL CAS structure
 */
async function loadEPLCASStructure() {
  try {
    console.log('🏢 Iniciando carga de estructura EPL CAS real...');
    console.log('📊 Fuente: pollo_loco_estructura_completa_GPS_20251120_232013.csv');
    
    // Read and parse CSV data
    const csvData = await readCSVData();
    console.log(`📋 CSV procesado: ${csvData.length} registros`);
    
    // Process and organize data
    const { groups, branches, directors } = organizeData(csvData);
    console.log(`👥 ${Object.keys(groups).length} grupos operativos identificados`);
    console.log(`🏪 ${branches.length} sucursales procesadas`);
    console.log(`👨‍💼 ${Object.keys(directors).length} directores identificados`);
    
    // Clear existing placeholder data
    await clearPlaceholderData();
    
    // Load operational groups
    await loadOperationalGroups(groups);
    
    // Load branches with coordinates
    await loadBranches(branches);
    
    // Update existing unified user management to use real groups
    await updateUnifiedUserManagement();
    
    // Generate validation report
    const report = await generateValidationReport();
    
    console.log('✅ Estructura EPL CAS cargada exitosamente');
    console.log('\n📊 REPORTE DE CARGA:');
    console.log(report);
    
    return {
      success: true,
      groups: Object.keys(groups).length,
      branches: branches.length,
      directors: Object.keys(directors).length,
      report
    };
    
  } catch (error) {
    console.error('❌ Error cargando estructura EPL CAS:', error.message);
    throw error;
  }
}

/**
 * Read and parse CSV data
 */
async function readCSVData() {
  return new Promise((resolve, reject) => {
    const csvFilePath = '/Users/robertodavila/pollo_loco_estructura_completa_GPS_20251120_232013.csv';
    const results = [];
    
    if (!fs.existsSync(csvFilePath)) {
      reject(new Error(`Archivo CSV no encontrado: ${csvFilePath}`));
      return;
    }
    
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`✅ CSV leído: ${results.length} filas`);
        resolve(results);
      })
      .on('error', reject);
  });
}

/**
 * Organize CSV data into groups, branches, and directors
 */
function organizeData(csvData) {
  const groups = {};
  const branches = [];
  const directors = {};
  
  csvData.forEach(row => {
    // Skip invalid rows
    if (!row.grupo_id || !row.sucursal_id) {
      console.warn('⚠️ Fila inválida omitida:', row.sucursal_nombre);
      return;
    }
    
    // Process operational group
    const groupId = parseInt(row.grupo_id);
    if (!groups[groupId]) {
      groups[groupId] = {
        id: groupId,
        name: row.grupo_nombre?.trim() || 'Sin Nombre',
        code: generateGroupCode(row.grupo_nombre),
        description: `Grupo Operativo ${row.grupo_nombre} - Región ${row.region}`,
        region: row.region?.trim() || 'Sin Región',
        branch_count: 0
      };
    }
    groups[groupId].branch_count++;
    
    // Process director
    const directorId = parseInt(row.director_id);
    if (!directors[directorId]) {
      directors[directorId] = {
        id: directorId,
        name: row.director_nombre?.trim() || 'Sin Nombre',
        total_branches: parseInt(row.total_sucursales_director) || 0,
        groups: new Set()
      };
    }
    directors[directorId].groups.add(groupId);
    
    // Process branch
    const branch = {
      sucursal_id: parseInt(row.sucursal_id),
      numero: parseInt(row.sucursal_numero) || 0,
      name: row.sucursal_nombre?.trim() || 'Sin Nombre',
      description: row.sucursal_descripcion?.trim() || '',
      active: row.sucursal_activa?.toLowerCase() === 'sí',
      latitude: parseFloat(row.latitud) || null,
      longitude: parseFloat(row.longitud) || null,
      city: row.ciudad?.trim() || 'Sin Ciudad',
      state: row.estado?.trim() || 'Sin Estado',
      municipality: row.municipio?.trim() || 'Sin Municipio',
      country: row.pais?.trim() || 'México',
      region: row.region?.trim() || 'Sin Región',
      zona_metropolitana: row.zona_metropolitana?.trim() || 'Sin Zona',
      operational_group_id: groupId,
      director_id: directorId,
      director_name: row.director_nombre?.trim() || 'Sin Director',
      validated_gps: row.validado_gps?.toLowerCase() === 'sí',
      geofence_radius: 50 // Default 50m radius
    };
    
    // Validate coordinates
    if (branch.latitude && branch.longitude && 
        Math.abs(branch.latitude) <= 90 && Math.abs(branch.longitude) <= 180) {
      branch.coordinates_valid = true;
    } else {
      branch.coordinates_valid = false;
      console.warn(`⚠️ Coordenadas inválidas para sucursal: ${branch.name}`);
    }
    
    branches.push(branch);
  });
  
  // Convert directors Set to Array for easier processing
  Object.values(directors).forEach(director => {
    director.groups = Array.from(director.groups);
  });
  
  return { groups, branches, directors };
}

/**
 * Generate group code from name
 */
function generateGroupCode(groupName) {
  if (!groupName) return 'UNKNOWN';
  
  // Handle special cases
  const specialCodes = {
    'TEPEYAC': 'TEP',
    'EXPO': 'EXP', 
    'PLOG Nuevo Leon': 'PNL',
    'OGAS': 'OGA',
    'EFM': 'EFM',
    'RAP': 'RAP',
    'CRR': 'CRR',
    'TEC': 'TEC',
    'EPL SO': 'SO',
    'PLOG Laguna': 'LAG',
    'PLOG Queretaro': 'QRO',
    'GRUPO SALTILLO': 'SAL',
    'OCHTER Tampico': 'TAM',
    'GRUPO CANTERA ROSA (MORELIA)': 'MOR',
    'GRUPO MATAMOROS': 'MAT',
    'GRUPO PIEDRAS NEGRAS': 'PNG',
    'GRUPO CENTRITO': 'CTR',
    'GRUPO SABINAS HIDALGO': 'SAB',
    'GRUPO RIO BRAVO': 'RBR',
    'GRUPO NUEVO LAREDO (RUELAS)': 'NLR'
  };
  
  if (specialCodes[groupName]) {
    return specialCodes[groupName];
  }
  
  // Generate code from name
  return groupName
    .replace(/[^a-zA-Z\s]/g, '')
    .split(' ')
    .map(word => word.substring(0, 3).toUpperCase())
    .join('')
    .substring(0, 10);
}

/**
 * Clear existing placeholder data
 */
async function clearPlaceholderData() {
  try {
    console.log('🗑️ Limpiando datos placeholder...');
    
    // Clear user group permissions
    await db.query('DELETE FROM user_group_permissions');
    
    // Clear branches
    await db.query('DELETE FROM branches');
    
    // Clear operational groups
    await db.query('DELETE FROM operational_groups');
    
    console.log('✅ Datos placeholder eliminados');
  } catch (error) {
    console.error('❌ Error limpiando placeholder data:', error.message);
    throw error;
  }
}

/**
 * Load operational groups
 */
async function loadOperationalGroups(groups) {
  try {
    console.log('👥 Cargando grupos operativos...');
    
    for (const group of Object.values(groups)) {
      await db.query(`
        INSERT INTO operational_groups (id, name, code, description, active, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          description = EXCLUDED.description,
          updated_at = NOW()
      `, [
        group.id,
        group.name,
        group.code,
        group.description
      ]);
      
      console.log(`  ✅ ${group.code}: ${group.name} (${group.branch_count} sucursales)`);
    }
    
    console.log(`✅ ${Object.keys(groups).length} grupos operativos cargados`);
  } catch (error) {
    console.error('❌ Error cargando grupos operativos:', error.message);
    throw error;
  }
}

/**
 * Load branches with coordinates
 */
async function loadBranches(branches) {
  try {
    console.log('🏪 Cargando sucursales con coordenadas...');
    
    let loadedCount = 0;
    let invalidCoordinates = 0;
    
    for (const branch of branches) {
      try {
        await db.query(`
          INSERT INTO branches (
            id, operational_group_id, name, description, 
            latitude, longitude, city, state, municipality, country,
            geofence_radius, active, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (id) DO UPDATE SET
            operational_group_id = EXCLUDED.operational_group_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            municipality = EXCLUDED.municipality,
            geofence_radius = EXCLUDED.geofence_radius,
            updated_at = NOW()
        `, [
          branch.sucursal_id,
          branch.operational_group_id,
          branch.name,
          branch.description || branch.name,
          branch.coordinates_valid ? branch.latitude : null,
          branch.coordinates_valid ? branch.longitude : null,
          branch.city,
          branch.state,
          branch.municipality,
          branch.country,
          branch.geofence_radius,
          branch.active
        ]);
        
        loadedCount++;
        
        if (!branch.coordinates_valid) {
          invalidCoordinates++;
        }
        
      } catch (branchError) {
        console.warn(`⚠️ Error cargando sucursal ${branch.name}:`, branchError.message);
      }
    }
    
    console.log(`✅ ${loadedCount} sucursales cargadas`);
    if (invalidCoordinates > 0) {
      console.warn(`⚠️ ${invalidCoordinates} sucursales con coordenadas inválidas`);
    }
    
  } catch (error) {
    console.error('❌ Error cargando sucursales:', error.message);
    throw error;
  }
}

/**
 * Update unified user management routes to use real groups
 */
async function updateUnifiedUserManagement() {
  try {
    console.log('🔄 Actualizando gestión unificada de usuarios...');
    
    // Create new route file with real groups
    const routePath = path.join(__dirname, '../api/routes/unified-user-management.routes.js');
    const routeContent = fs.readFileSync(routePath, 'utf8');
    
    // Replace placeholder groups with real data fetch
    const updatedContent = routeContent.replace(
      /const placeholderGroups = \[[\s\S]*?\];/,
      `// Get real operational groups from database
    const groupsResult = await db.query(\`
      SELECT 
        id, name, code, description,
        (SELECT COUNT(*) FROM branches WHERE operational_group_id = operational_groups.id) as branches_count
      FROM operational_groups 
      WHERE active = true
      ORDER BY name
    \`);
    
    const realGroups = groupsResult.rows;`
    );
    
    const finalContent = updatedContent.replace(
      'operational_groups: placeholderGroups,',
      'operational_groups: realGroups,'
    ).replace(
      'note: \'Grupos placeholder - implementar estructura EPL CAS en Fase 2\'',
      'note: \'Estructura EPL CAS real cargada - 20 grupos operativos y 82 sucursales\''
    );
    
    fs.writeFileSync(routePath, finalContent);
    console.log('✅ Rutas actualizadas para usar grupos reales');
    
  } catch (error) {
    console.error('❌ Error actualizando gestión de usuarios:', error.message);
    // No throw - this is not critical
  }
}

/**
 * Generate validation report
 */
async function generateValidationReport() {
  try {
    // Count groups
    const groupsResult = await db.query('SELECT COUNT(*) as total FROM operational_groups');
    const totalGroups = parseInt(groupsResult.rows[0].total);
    
    // Count branches
    const branchesResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as with_coordinates,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM branches
    `);
    const branchStats = branchesResult.rows[0];
    
    // Get groups with branch counts
    const groupStatsResult = await db.query(`
      SELECT 
        og.name,
        og.code,
        COUNT(b.id) as branches_count
      FROM operational_groups og
      LEFT JOIN branches b ON b.operational_group_id = og.id
      GROUP BY og.id, og.name, og.code
      ORDER BY branches_count DESC, og.name
    `);
    
    // States coverage
    const statesResult = await db.query(`
      SELECT DISTINCT state, COUNT(*) as branches_count
      FROM branches
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY branches_count DESC
    `);
    
    const report = {
      timestamp: new Date().toISOString(),
      groups: {
        total: totalGroups,
        details: groupStatsResult.rows
      },
      branches: {
        total: parseInt(branchStats.total),
        with_coordinates: parseInt(branchStats.with_coordinates),
        active: parseInt(branchStats.active),
        coordinate_coverage: Math.round((branchStats.with_coordinates / branchStats.total) * 100)
      },
      states: {
        total: statesResult.rows.length,
        coverage: statesResult.rows
      }
    };
    
    return report;
    
  } catch (error) {
    console.error('❌ Error generando reporte:', error.message);
    return { error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  loadEPLCASStructure()
    .then((result) => {
      console.log('\n🎉 CARGA EPL CAS COMPLETADA EXITOSAMENTE');
      console.log('📊 Resultado:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ FALLO EN CARGA EPL CAS:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

module.exports = { loadEPLCASStructure };