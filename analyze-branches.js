require('dotenv').config();
const db = require('./src/config/database');

async function analyzeCurrentBranches() {
  console.log('🔍 ANÁLISIS DETALLADO DE ESTRUCTURA ACTUAL...\n');
  
  try {
    // Obtener todas las sucursales con información detallada
    const result = await db.query(`
      SELECT 
        id, name, city, state, municipality,
        latitude, longitude, address,
        group_id, group_name, director_name,
        phone, email, zenput_id,
        created_at, updated_at,
        gps_validated, active
      FROM branches 
      ORDER BY id DESC
    `);
    
    console.log(`📊 Total sucursales en BD: ${result.rows.length}`);
    
    // Mostrar las últimas 10 sucursales (más recientes)
    console.log('\n🆕 ÚLTIMAS 10 SUCURSALES (más recientes por ID):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    result.rows.slice(0, 10).forEach((branch, index) => {
      console.log(`${branch.id}. ${branch.name}`);
      console.log(`   📍 ${branch.city || 'N/A'}, ${branch.state || 'N/A'}`);
      console.log(`   🌍 ${branch.latitude}, ${branch.longitude}`);
      console.log(`   🏢 Grupo: ${branch.group_name || 'N/A'} (ID: ${branch.group_id})`);
      console.log(`   📅 Creado: ${branch.created_at ? branch.created_at.toISOString().split('T')[0] : 'N/A'}`);
      console.log('');
    });
    
    // Análisis por estado para detectar expansiones
    console.log('\n📍 DISTRIBUCIÓN POR ESTADO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const byState = {};
    result.rows.forEach(branch => {
      const state = branch.state || 'Sin Estado';
      if (!byState[state]) byState[state] = [];
      byState[state].push(branch);
    });
    
    Object.keys(byState).sort().forEach(state => {
      const branches = byState[state];
      console.log(`  ${state}: ${branches.length} sucursales`);
      
      // Mostrar últimas 3 de cada estado (por ID)
      const latest = branches.sort((a, b) => b.id - a.id).slice(0, 3);
      latest.forEach(branch => {
        console.log(`    ${branch.id}. ${branch.name}`);
      });
      console.log('');
    });
    
    // Buscar posibles patrones de IDs consecutivos o gaps
    console.log('\n🔢 ANÁLISIS DE IDs (últimos 15):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const sortedByID = result.rows.sort((a, b) => b.id - a.id);
    const latestIDs = sortedByID.slice(0, 15);
    
    latestIDs.forEach(branch => {
      console.log(`ID ${branch.id}: ${branch.name} (${branch.city || 'N/A'})`);
    });
    
    // Detectar gaps en IDs
    const allIDs = result.rows.map(b => b.id).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < allIDs.length; i++) {
      if (allIDs[i] - allIDs[i-1] > 1) {
        for (let missingId = allIDs[i-1] + 1; missingId < allIDs[i]; missingId++) {
          gaps.push(missingId);
        }
      }
    }
    
    if (gaps.length > 0) {
      console.log(`\n⚠️ GAPS EN IDs DETECTADOS: ${gaps.join(', ')}`);
      console.log('   Posibles espacios para nuevas sucursales');
    } else {
      console.log('\n✅ IDs consecutivos, sin gaps detectados');
    }
    
    console.log(`\n📈 RANGO DE IDs: ${Math.min(...allIDs)} a ${Math.max(...allIDs)}`);
    console.log(`🔢 Próximo ID sugerido: ${Math.max(...allIDs) + 1}`);
    
    // Análisis específico de fechas de creación
    console.log('\n📅 ANÁLISIS DE FECHAS DE CREACIÓN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const withDates = result.rows.filter(b => b.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (withDates.length > 0) {
      console.log('📅 ÚLTIMAS SUCURSALES POR FECHA:');
      withDates.slice(0, 10).forEach(branch => {
        const date = new Date(branch.created_at);
        console.log(`  ${branch.id}. ${branch.name} - ${date.toLocaleDateString()}`);
      });
    } else {
      console.log('⚠️ No hay fechas de creación registradas');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeCurrentBranches();