require('dotenv').config();
const { Pool } = require('pg');

async function completeVerification() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICACIÓN COMPLETA DE INCONSISTENCIAS...\n');
    
    // 1. Obtener TODAS las sucursales ordenadas por número de sucursal (no por ID)
    console.log('📊 TODAS LAS SUCURSALES (ordenadas por número):');
    const allBranches = await pool.query(`
      SELECT 
        id, branch_number, name, city, state, municipality,
        group_id, group_name, region, zenput_id,
        latitude, longitude, active
      FROM branches 
      WHERE active = true 
      ORDER BY branch_number
    `);
    
    console.log('DB_ID | Num | Nombre | Ciudad | Grupo_ID | Grupo_Nombre | Región | Zenput_ID');
    console.log('------|-----|--------|--------|----------|-------------|--------|----------');
    
    let inconsistencies = [];
    let missingNumbers = [];
    let duplicateNumbers = [];
    
    // Verificar números consecutivos y duplicados
    const branchNumbers = new Map();
    
    allBranches.rows.forEach(branch => {
      const branchNum = branch.branch_number;
      
      if (branchNumbers.has(branchNum)) {
        duplicateNumbers.push(branchNum);
      } else {
        branchNumbers.set(branchNum, branch);
      }
      
      // Verificar si el ID DB coincide con el número de sucursal
      const idMismatch = branch.id !== branchNum;
      if (idMismatch) {
        inconsistencies.push({
          type: 'ID_MISMATCH',
          branch: branch.name,
          db_id: branch.id,
          branch_number: branchNum,
          issue: `DB ID (${branch.id}) ≠ Branch Number (${branchNum})`
        });
      }
      
      const statusIcon = idMismatch ? '❌' : '✅';
      console.log(`${statusIcon} ${branch.id.toString().padStart(4)} | ${branchNum.toString().padStart(3)} | ${branch.name.substring(0,12).padEnd(12)} | ${branch.city.substring(0,8).padEnd(8)} | ${(branch.group_id || 'NULL').toString().padStart(8)} | ${(branch.group_name || 'NULL').substring(0,11).padEnd(11)} | ${(branch.region || 'NULL').substring(0,6).padEnd(6)} | ${branch.zenput_id}`);
    });
    
    // Verificar números faltantes (1-85)
    for (let i = 1; i <= 85; i++) {
      if (!branchNumbers.has(i)) {
        missingNumbers.push(i);
      }
    }
    
    console.log('\n🚨 PROBLEMAS DETECTADOS:');
    console.log(`   • Inconsistencias ID vs Número: ${inconsistencies.length}`);
    console.log(`   • Números faltantes (1-85): ${missingNumbers.length > 0 ? missingNumbers.join(', ') : 'Ninguno'}`);
    console.log(`   • Números duplicados: ${duplicateNumbers.length > 0 ? duplicateNumbers.join(', ') : 'Ninguno'}`);
    
    // 2. Mostrar las inconsistencias detalladamente
    if (inconsistencies.length > 0) {
      console.log('\n📋 DETALLE DE INCONSISTENCIAS:');
      inconsistencies.forEach(issue => {
        console.log(`   ❌ ${issue.branch}: ${issue.issue}`);
      });
    }
    
    // 3. Verificar las 3 nuevas específicamente
    console.log('\n🆕 VERIFICANDO LAS 3 NUEVAS SUCURSALES:');
    const newBranches = await pool.query(`
      SELECT id, branch_number, name, city, state, zenput_id, group_id, group_name
      FROM branches 
      WHERE branch_number IN (83, 84, 85)
      ORDER BY branch_number
    `);
    
    newBranches.rows.forEach(branch => {
      const isCorrect = branch.id === branch.branch_number;
      const statusIcon = isCorrect ? '✅' : '❌';
      console.log(`   ${statusIcon} Sucursal #${branch.branch_number}: ${branch.name}`);
      console.log(`      DB ID: ${branch.id} | Zenput: ${branch.zenput_id}`);
      console.log(`      Ciudad: ${branch.city}, ${branch.state}`);
      console.log(`      Grupo ID: ${branch.group_id} | Grupo: ${branch.group_name || 'NULL'}`);
      console.log('');
    });
    
    // 4. Verificar grupos operativos actuales
    console.log('\n👥 GRUPOS OPERATIVOS ACTUALES:');
    const groups = await pool.query(`
      SELECT DISTINCT group_id, group_name, COUNT(*) as sucursales
      FROM branches 
      WHERE active = true 
      GROUP BY group_id, group_name
      ORDER BY group_id
    `);
    
    groups.rows.forEach(group => {
      console.log(`   Grupo ${group.group_id}: ${group.group_name || 'NULL'} (${group.sucursales} sucursales)`);
    });
    
    console.log('\n⚠️ RECOMENDACIÓN:');
    console.log('   Antes de hacer commit, necesitamos:');
    console.log('   1. Corregir los IDs para que coincidan con los números de sucursal');
    console.log('   2. Asignar correctamente los grupos operativos');
    console.log('   3. Verificar que las 85 sucursales estén correctas');
    
    return { 
      success: true, 
      inconsistencies: inconsistencies.length,
      missing: missingNumbers.length,
      duplicates: duplicateNumbers.length
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

completeVerification();