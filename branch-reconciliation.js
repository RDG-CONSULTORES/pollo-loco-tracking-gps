require('dotenv').config();
const db = require('./src/config/database');

async function reconcileBranchCount() {
  console.log('🔍 RECONCILIACIÓN DE SUCURSALES EPL CAS...\n');
  
  try {
    // Contar sucursales actuales
    const countResult = await db.query('SELECT COUNT(*) as total FROM branches WHERE active = true');
    const totalBranches = parseInt(countResult.rows[0].total);
    
    // Obtener rango de IDs
    const rangeResult = await db.query('SELECT MIN(id) as min_id, MAX(id) as max_id FROM branches');
    const minId = rangeResult.rows[0].min_id;
    const maxId = rangeResult.rows[0].max_id;
    
    // Detectar gaps en IDs
    const allIDsResult = await db.query('SELECT id FROM branches ORDER BY id');
    const existingIDs = allIDsResult.rows.map(row => row.id);
    
    const gaps = [];
    for (let expectedId = minId; expectedId <= maxId; expectedId++) {
      if (!existingIDs.includes(expectedId)) {
        gaps.push(expectedId);
      }
    }
    
    console.log('📊 RESUMEN ACTUAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Total sucursales activas: ${totalBranches}`);
    console.log(`🔢 Rango de IDs: ${minId} a ${maxId}`);
    console.log(`📈 Diferencia ID max vs count: ${maxId - totalBranches} (por gaps)`);
    console.log(`⚠️ Gaps detectados: ${gaps.length} (IDs: ${gaps.join(', ')})`);
    
    // Análisis de la discrepancia 82 vs actual count
    console.log('\n🎯 ANÁLISIS DE DISCREPANCIA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (totalBranches === 82) {
      console.log('✅ Conteo coincide con expectativa original (82)');
      console.log('   Las "3 nuevas sucursales" aún no han sido añadidas');
    } else if (totalBranches > 82) {
      const difference = totalBranches - 82;
      console.log(`🎯 ENCONTRADAS ${difference} SUCURSALES ADICIONALES!`);
      console.log(`   Estas son posiblemente las nuevas sucursales que Roberto mencionó`);
      
      // Identificar las últimas sucursales añadidas
      const latestResult = await db.query(`
        SELECT id, name, city, state, group_name, created_at
        FROM branches 
        ORDER BY id DESC 
        LIMIT ${difference + 5}
      `);
      
      console.log(`\n📋 ÚLTIMAS ${difference + 5} SUCURSALES (por ID):`);
      latestResult.rows.forEach((branch, index) => {
        const marker = index < difference ? '🆕' : '📍';
        console.log(`${marker} ${branch.id}. ${branch.name}`);
        console.log(`     📍 ${branch.city}, ${branch.state}`);
        console.log(`     🏢 ${branch.group_name}`);
        console.log('');
      });
      
    } else {
      console.log(`⚠️ Conteo menor al esperado: ${totalBranches} < 82`);
      console.log('   Posible problema en la carga de datos');
    }
    
    // Análisis por estado para detectar expansiones recientes
    console.log('\n🗺️ ANÁLISIS GEOGRÁFICO DETALLADO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const byStateResult = await db.query(`
      SELECT 
        state,
        COUNT(*) as count,
        MAX(id) as latest_id,
        MAX(name) as latest_name
      FROM branches 
      WHERE active = true
      GROUP BY state 
      ORDER BY count DESC
    `);
    
    byStateResult.rows.forEach(state => {
      console.log(`📍 ${state.state}: ${state.count} sucursales`);
      console.log(`   🆕 Más reciente: ID ${state.latest_id} - ${state.latest_name}`);
    });
    
    // Recomendaciones finales
    console.log('\n💡 RECOMENDACIONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (totalBranches === 82) {
      console.log('🎯 ACCIÓN REQUERIDA: Buscar e integrar las 3 nuevas sucursales');
      console.log('   • Verificar si están en Zenput API');
      console.log('   • Solicitar detalles a Roberto');
      console.log('   • Usar IDs disponibles en gaps o continuar desde 93');
    } else if (totalBranches > 82) {
      console.log('✅ ESTADO ACTUAL CORRECTO');
      console.log(`   • Sistema tiene ${totalBranches} sucursales (incluyendo las nuevas)`);
      console.log('   • No se requiere acción adicional');
      console.log('   • Confirmar con Roberto que la cuenta es correcta');
    }
    
    console.log(`\n📊 ESTADÍSTICAS FINALES:`);
    console.log(`   • Sucursales totales: ${totalBranches}`);
    console.log(`   • Estados cubiertos: ${byStateResult.rows.length}`);
    console.log(`   • Próximo ID sugerido: ${maxId + 1}`);
    console.log(`   • Gaps disponibles: ${gaps.length} espacios`);
    
    return {
      total_branches: totalBranches,
      max_id: maxId,
      gaps: gaps,
      difference_from_82: totalBranches - 82,
      states_covered: byStateResult.rows.length
    };
    
  } catch (error) {
    console.error('❌ Error en reconciliación:', error.message);
    throw error;
  }
}

// Función para sugerir próximos pasos
async function suggestNextSteps() {
  console.log('\n🚀 PLAN DE ACCIÓN SUGERIDO:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const stats = await reconcileBranchCount();
  
  if (stats.difference_from_82 === 0) {
    console.log('1️⃣ PREPARAR TEMPLATES para 3 nuevas sucursales');
    console.log('2️⃣ SOLICITAR INFORMACIÓN a Roberto sobre las nuevas sucursales');
    console.log('3️⃣ VALIDAR COORDENADAS con Google Maps');
    console.log('4️⃣ INTEGRAR en sistema usando próximos IDs disponibles');
  } else if (stats.difference_from_82 > 0) {
    console.log('1️⃣ CONFIRMAR CON ROBERTO que la cuenta actual es correcta');
    console.log('2️⃣ VALIDAR que las sucursales adicionales son las "3 nuevas"');
    console.log('3️⃣ ACTUALIZAR DOCUMENTACIÓN con el nuevo total');
    console.log('4️⃣ EJECUTAR VALIDACIÓN final de coordenadas');
  }
  
  console.log('\n🎯 READY FOR ROBERTO CONFIRMATION');
  
  process.exit(0);
}

// Ejecutar análisis
suggestNextSteps();