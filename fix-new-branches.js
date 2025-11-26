require('dotenv').config();
const { Pool } = require('pg');

async function fixNewBranches() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔧 CORRIGIENDO LAS 3 NUEVAS SUCURSALES...\n');
    
    // 1. Mostrar estado actual antes de corregir
    console.log('📊 ESTADO ACTUAL (ANTES):');
    const currentState = await pool.query(`
      SELECT id, branch_number, name, city, group_id, group_name, zenput_id
      FROM branches 
      WHERE id IN (93, 94, 95)
      ORDER BY id
    `);
    
    currentState.rows.forEach(branch => {
      console.log(`   ID ${branch.id}: #${branch.branch_number} - ${branch.name}`);
      console.log(`      Grupo: ${branch.group_id} (${branch.group_name}) | Zenput: ${branch.zenput_id}`);
    });
    
    console.log('\n🔄 APLICANDO CORRECCIONES...');
    
    // 2. Corregir Sucursal 83 - Cerradas de Anahuac (OGAS)
    await pool.query(`
      UPDATE branches 
      SET 
        branch_number = 83,
        group_id = 4,
        group_name = 'OGAS',
        updated_at = NOW()
      WHERE id = 93
    `);
    console.log('   ✅ Sucursal 83 - Cerradas de Anahuac → Grupo OGAS');
    
    // 3. Corregir Sucursal 84 - Aeropuerto del Norte (EPL SO)  
    await pool.query(`
      UPDATE branches 
      SET 
        branch_number = 84,
        group_id = 20,
        group_name = 'EPL SO',
        updated_at = NOW()
      WHERE id = 94
    `);
    console.log('   ✅ Sucursal 84 - Aeropuerto del Norte → Grupo EPL SO');
    
    // 4. Corregir Sucursal 85 - Diego Diaz (OGAS)
    await pool.query(`
      UPDATE branches 
      SET 
        branch_number = 85,
        group_id = 4,
        group_name = 'OGAS',
        updated_at = NOW()
      WHERE id = 95
    `);
    console.log('   ✅ Sucursal 85 - Diego Diaz → Grupo OGAS');
    
    // 5. Verificar estado después de correcciones
    console.log('\n📊 ESTADO CORREGIDO (DESPUÉS):');
    const correctedState = await pool.query(`
      SELECT id, branch_number, name, city, group_id, group_name, zenput_id
      FROM branches 
      WHERE id IN (93, 94, 95)
      ORDER BY branch_number
    `);
    
    correctedState.rows.forEach(branch => {
      console.log(`   ID ${branch.id}: #${branch.branch_number} - ${branch.name}`);
      console.log(`      Grupo: ${branch.group_id} (${branch.group_name}) | Ciudad: ${branch.city}`);
      console.log(`      Zenput: ${branch.zenput_id}\n`);
    });
    
    // 6. Verificar que ahora tenemos las 85 sucursales correctas
    console.log('🔍 VERIFICANDO SECUENCIA FINAL:');
    const finalCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN branch_number BETWEEN 1 AND 85 THEN 1 END) as in_range,
        MIN(branch_number) as min_num,
        MAX(branch_number) as max_num
      FROM branches 
      WHERE active = true
    `);
    
    const stats = finalCheck.rows[0];
    console.log(`   Total sucursales: ${stats.total}`);
    console.log(`   En rango 1-85: ${stats.in_range}`);
    console.log(`   Número mínimo: ${stats.min_num}`);
    console.log(`   Número máximo: ${stats.max_num}`);
    
    // 7. Verificar grupos OGAS y EPL SO
    console.log('\n👥 VERIFICANDO GRUPOS OPERATIVOS:');
    const groupCheck = await pool.query(`
      SELECT group_id, group_name, COUNT(*) as sucursales
      FROM branches 
      WHERE active = true AND group_id IN (4, 20)
      GROUP BY group_id, group_name
      ORDER BY group_id
    `);
    
    groupCheck.rows.forEach(group => {
      console.log(`   Grupo ${group.group_id}: ${group.group_name} (${group.sucursales} sucursales)`);
    });
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETADA!');
    console.log('\n✅ RESULTADOS:');
    console.log('   • Sucursal 83 → Grupo OGAS (4)');
    console.log('   • Sucursal 84 → Grupo EPL SO (20)');  
    console.log('   • Sucursal 85 → Grupo OGAS (4)');
    console.log('   • Números de sucursal corregidos a 83, 84, 85');
    console.log('   • Grupos operativos asignados correctamente');
    
    return { success: true, corrected: 3 };
    
  } catch (error) {
    console.error('❌ Error en corrección:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  const result = await fixNewBranches();
  
  if (result.success) {
    console.log(`\n🚀 CORRECCIÓN EXITOSA - ${result.corrected} sucursales corregidas`);
    console.log('\n🌐 AHORA NECESITAMOS:');
    console.log('   1. Actualizar geofences con los grupos correctos');
    console.log('   2. Verificar que todo está correcto');
    console.log('   3. Hacer commit a Railway');
  } else {
    console.log('\n❌ Error en corrección:', result.error);
  }
  
  process.exit(0);
}

main();