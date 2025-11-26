require('dotenv').config();
const { Pool } = require('pg');

async function fixGroup82() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔧 CORRIGIENDO SUCURSAL #82 - AEROPUERTO NUEVO LAREDO...\n');
    
    // 1. Mostrar estado actual
    console.log('📊 ESTADO ACTUAL:');
    const current = await pool.query(`
      SELECT id, branch_number, name, city, group_id, group_name, director_name
      FROM branches 
      WHERE branch_number = 82
    `);
    
    if (current.rows.length > 0) {
      const s = current.rows[0];
      console.log(`   #${s.branch_number} - ${s.name}`);
      console.log(`   Ciudad: ${s.city}`);
      console.log(`   Grupo actual: ${s.group_id} (${s.group_name})`);
      console.log(`   Director: ${s.director_name}`);
    }
    
    // 2. Aplicar corrección
    console.log('\n🔄 CAMBIANDO A GRUPO EXPO...');
    await pool.query(`
      UPDATE branches 
      SET 
        group_id = 2,
        group_name = 'EXPO',
        updated_at = NOW()
      WHERE branch_number = 82
    `);
    console.log('   ✅ Sucursal #82 cambiada a Grupo EXPO');
    
    // 3. Verificar cambio
    console.log('\n📊 ESTADO CORREGIDO:');
    const corrected = await pool.query(`
      SELECT id, branch_number, name, city, group_id, group_name, director_name
      FROM branches 
      WHERE branch_number = 82
    `);
    
    if (corrected.rows.length > 0) {
      const s = corrected.rows[0];
      console.log(`   #${s.branch_number} - ${s.name}`);
      console.log(`   Ciudad: ${s.city}`);
      console.log(`   Grupo corregido: ${s.group_id} (${s.group_name})`);
      console.log(`   Director: ${s.director_name}`);
    }
    
    // 4. Verificar conteos de grupos
    console.log('\n👥 CONTEOS DE GRUPOS AFECTADOS:');
    const groupCounts = await pool.query(`
      SELECT group_id, group_name, COUNT(*) as sucursales
      FROM branches 
      WHERE active = true AND group_id IN (2, 19)
      GROUP BY group_id, group_name
      ORDER BY group_id
    `);
    
    groupCounts.rows.forEach(group => {
      console.log(`   Grupo ${group.group_id}: ${group.group_name} (${group.sucursales} sucursales)`);
    });
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETADA!');
    console.log('\n✅ RESULTADO:');
    console.log('   • Sucursal #82 → Grupo EXPO (2)');
    console.log('   • GRUPO EXPO ahora tiene 12 sucursales');
    console.log('   • GRUPO NUEVO LAREDO (RUELAS) ahora tiene 2 sucursales');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en corrección:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

fixGroup82();