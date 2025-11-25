require('dotenv').config();
const db = require('./src/config/database');

/**
 * RESUMEN FINAL COMPLETO - SISTEMA EPL CAS
 * Estado actual y plan para las 3 nuevas sucursales
 */

async function generateFinalSummary() {
  console.log('📊 RESUMEN FINAL COMPLETO - SISTEMA EPL CAS GPS TRACKING\n');
  
  try {
    // 1. Estadísticas actuales
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_branches,
        COUNT(DISTINCT state) as states_covered,
        COUNT(DISTINCT group_id) as groups_used,
        MIN(id) as min_id,
        MAX(id) as max_id
      FROM branches 
      WHERE active = true
    `);
    
    const stats = statsResult.rows[0];
    
    // 2. Distribución por estado (PostgreSQL compatible)
    const stateDistResult = await db.query(`
      SELECT 
        state,
        COUNT(*) as count,
        STRING_AGG(DISTINCT group_name, ', ') as grupos
      FROM branches 
      WHERE active = true 
      GROUP BY state 
      ORDER BY count DESC
    `);
    
    // 3. Grupos operativos
    const groupsResult = await db.query(`
      SELECT 
        og.id, 
        og.name, 
        og.description,
        COUNT(b.id) as branch_count
      FROM operational_groups og
      LEFT JOIN branches b ON b.group_id = og.id AND b.active = true
      GROUP BY og.id, og.name, og.description
      ORDER BY og.name
    `);
    
    // 4. Análisis de IDs y gaps
    const idsResult = await db.query('SELECT id FROM branches ORDER BY id');
    const existingIDs = idsResult.rows.map(row => row.id);
    const gaps = [];
    
    for (let i = 1; i <= stats.max_id; i++) {
      if (!existingIDs.includes(i)) {
        gaps.push(i);
      }
    }
    
    console.log('🎯 ESTADO ACTUAL CONFIRMADO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Total sucursales activas: ${stats.total_branches}`);
    console.log(`🗺️ Estados cubiertos: ${stats.states_covered}`);
    console.log(`🏢 Grupos operativos en uso: ${stats.groups_used}/20`);
    console.log(`🔢 Rango de IDs: ${stats.min_id} a ${stats.max_id}`);
    console.log(`⚠️ Gaps en IDs: ${gaps.length} espacios disponibles (${gaps.slice(0, 5).join(', ')}${gaps.length > 5 ? '...' : ''})`);
    
    console.log('\n🗺️ DISTRIBUCIÓN GEOGRÁFICA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Usar query alternativa para compatibilidad
    const stateListResult = await db.query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM branches 
      WHERE active = true 
      GROUP BY state 
      ORDER BY count DESC
    `);
    
    stateListResult.rows.forEach(state => {
      console.log(`📍 ${state.state}: ${state.count} sucursales`);
    });
    
    console.log('\n🏢 GRUPOS OPERATIVOS DISPONIBLES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    groupsResult.rows.forEach(group => {
      const usage = group.branch_count > 0 ? `(${group.branch_count} sucursales)` : '(disponible)';
      console.log(`${group.id.toString().padStart(2, ' ')}. ${group.name} ${usage}`);
    });
    
    console.log('\n🎯 PLAN PARA LAS 3 NUEVAS SUCURSALES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔢 IDs sugeridos: ${stats.max_id + 1}, ${stats.max_id + 2}, ${stats.max_id + 3}`);
    console.log(`🔄 IDs alternativos (gaps): ${gaps.slice(0, 3).join(', ')}`);
    console.log(`📋 Template preparado: add-new-branches.js`);
    console.log(`🗂️ Archivo ready para Roberto: ✅`);
    
    console.log('\n📋 CHECKLIST PARA ROBERTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('☐ 1. Editar archivo: add-new-branches.js');
    console.log('☐ 2. Reemplazar datos de ejemplo con información real');
    console.log('☐ 3. Obtener coordenadas exactas de Google Maps');
    console.log('☐ 4. Asignar grupo operativo correcto de la lista');
    console.log('☐ 5. Verificar direcciones completas');
    console.log('☐ 6. Ejecutar: node add-new-branches.js (preview)');
    console.log('☐ 7. Confirmar datos y ejecutar inserción final');
    
    console.log('\n🚀 COMANDOS PARA ROBERTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('# 1. Preview de las nuevas sucursales:');
    console.log('node add-new-branches.js');
    console.log('');
    console.log('# 2. Insertar en base de datos (después de confirmar):');
    console.log('# Descomentar línea al final del archivo y ejecutar');
    console.log('');
    console.log('# 3. Validar coordenadas después de insertar:');
    console.log('node validate-coordinates.js');
    
    console.log('\n✅ SISTEMA LISTO PARA EXPANSIÓN');
    console.log('📊 Total esperado después de expansión: 85 sucursales');
    console.log('🎯 Estado: Waiting for Roberto to provide branch details');
    
    return {
      current_total: parseInt(stats.total_branches),
      expected_total: parseInt(stats.total_branches) + 3,
      next_ids: [stats.max_id + 1, stats.max_id + 2, stats.max_id + 3],
      available_gaps: gaps.slice(0, 5),
      states_covered: parseInt(stats.states_covered),
      ready_for_expansion: true
    };
    
  } catch (error) {
    console.error('❌ Error generando resumen:', error.message);
    return { error: error.message };
  }
}

// Función para mostrar estructura de archivos
function showFileStructure() {
  console.log('\n📁 ESTRUCTURA DE ARCHIVOS PREPARADA:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 add-new-branches.js          - Template para Roberto (EDITAR)');
  console.log('📄 validate-coordinates.js      - Validación GPS coordinates');
  console.log('📄 fetch-zenput-branches.js     - Búsqueda automática Zenput API');
  console.log('📄 branch-reconciliation.js     - Análisis de discrepancias');
  console.log('📄 analyze-branches.js          - Análisis detallado estructura');
  console.log('📄 final-branch-summary.js      - Este archivo (resumen final)');
  console.log('');
  console.log('🎯 PRÓXIMO PASO: Roberto debe editar add-new-branches.js');
}

// Ejecución principal
async function main() {
  const summary = await generateFinalSummary();
  showFileStructure();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 ANÁLISIS COMPLETO - READY FOR ROBERTO INPUT 🎉');
  console.log('='.repeat(60));
  
  process.exit(0);
}

main();