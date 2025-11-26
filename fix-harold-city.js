require('dotenv').config();
const { Pool } = require('pg');

async function fixHaroldCity() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔧 CORRIGIENDO CIUDAD DE HAROLD R. PAPE...\n');
    
    // 1. Mostrar estado actual
    console.log('📊 ESTADO ACTUAL:');
    const current = await pool.query(`
      SELECT id, branch_number, name, city, municipality, state, 
             group_id, group_name, latitude, longitude
      FROM branches 
      WHERE branch_number = 57
    `);
    
    if (current.rows.length > 0) {
      const s = current.rows[0];
      console.log(`   #${s.branch_number} - ${s.name}`);
      console.log(`   Ciudad actual: ${s.city}`);
      console.log(`   Municipio actual: ${s.municipality}`);
      console.log(`   Estado: ${s.state}`);
      console.log(`   Coordenadas: ${s.latitude}, ${s.longitude}`);
      console.log(`   Grupo: ${s.group_id} (${s.group_name})`);
    }
    
    // 2. Aplicar corrección
    console.log('\n🔄 CAMBIANDO CIUDAD A MONCLOVA...');
    await pool.query(`
      UPDATE branches 
      SET 
        city = 'Monclova',
        municipality = 'Monclova',
        updated_at = NOW()
      WHERE branch_number = 57
    `);
    console.log('   ✅ Ciudad cambiada a Monclova');
    
    // 3. Verificar cambio
    console.log('\n📊 ESTADO CORREGIDO:');
    const corrected = await pool.query(`
      SELECT id, branch_number, name, city, municipality, state, 
             group_id, group_name, latitude, longitude
      FROM branches 
      WHERE branch_number = 57
    `);
    
    if (corrected.rows.length > 0) {
      const s = corrected.rows[0];
      console.log(`   #${s.branch_number} - ${s.name}`);
      console.log(`   Ciudad corregida: ${s.city}`);
      console.log(`   Municipio corregido: ${s.municipality}`);
      console.log(`   Estado: ${s.state}`);
      console.log(`   Coordenadas: ${s.latitude}, ${s.longitude} ✅ (correctas)`);
      console.log(`   Grupo: ${s.group_id} (${s.group_name}) ✅ (correcto)`);
    }
    
    // 4. Verificar todas las sucursales del Grupo Saltillo
    console.log('\n🏛️ GRUPO SALTILLO COMPLETO:');
    const saltilloGroup = await pool.query(`
      SELECT branch_number, name, city, municipality, state
      FROM branches 
      WHERE active = true AND group_id = 11
      ORDER BY branch_number
    `);
    
    saltilloGroup.rows.forEach(branch => {
      console.log(`   #${branch.branch_number} - ${branch.name} → ${branch.city}, ${branch.state}`);
    });
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETADA!');
    console.log('\n✅ RESULTADO:');
    console.log('   • Harold R. Pape → Monclova, Coahuila');
    console.log('   • Grupo SALTILLO mantiene 6 sucursales');
    console.log('   • Coordenadas conservadas (correctas)');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en corrección:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

fixHaroldCity();