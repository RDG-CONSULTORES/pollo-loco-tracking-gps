require('dotenv').config();
const { Pool } = require('pg');

async function verifyCitiesAndGroups() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO CIUDADES Y GRUPOS INCORRECTOS...\n');
    
    // 1. Verificar específicamente las sucursales mencionadas
    console.log('🚨 VERIFICANDO SUCURSALES CON PROBLEMAS:');
    
    // Sucursal #82 - Aeropuerto Nuevo Laredo
    const sucursal82 = await pool.query(`
      SELECT id, branch_number, name, city, state, municipality, 
             group_id, group_name, director_name, latitude, longitude
      FROM branches 
      WHERE branch_number = 82
    `);
    
    console.log('\n📍 SUCURSAL #82:');
    if (sucursal82.rows.length > 0) {
      const s = sucursal82.rows[0];
      console.log(`   Nombre: ${s.name}`);
      console.log(`   Ciudad actual: ${s.city}`);
      console.log(`   Municipio: ${s.municipality}`);
      console.log(`   Estado: ${s.state}`);
      console.log(`   Grupo actual: ${s.group_id} (${s.group_name})`);
      console.log(`   Director: ${s.director_name}`);
      console.log(`   ❌ Roberto dice: Debería ser Grupo EXPO`);
    }
    
    // Sucursal #57 - Harold R. Pape
    const sucursal57 = await pool.query(`
      SELECT id, branch_number, name, city, state, municipality, 
             group_id, group_name, director_name, latitude, longitude
      FROM branches 
      WHERE branch_number = 57
    `);
    
    console.log('\n📍 SUCURSAL #57:');
    if (sucursal57.rows.length > 0) {
      const s = sucursal57.rows[0];
      console.log(`   Nombre: ${s.name}`);
      console.log(`   Ciudad actual: ${s.city}`);
      console.log(`   Municipio: ${s.municipality}`);
      console.log(`   Estado: ${s.state}`);
      console.log(`   Coordenadas: ${s.latitude}, ${s.longitude}`);
      console.log(`   ❌ Roberto dice: Ciudad incorrecta, debería estar en Saltillo`);
    }
    
    // 2. Revisar todas las ciudades que parezcan incorrectas
    console.log('\n🏙️ VERIFICANDO TODAS LAS CIUDADES:');
    const allCities = await pool.query(`
      SELECT 
        branch_number, name, city, municipality, state,
        group_id, group_name, latitude, longitude
      FROM branches 
      WHERE active = true 
      ORDER BY branch_number
    `);
    
    console.log('\n📋 TODAS LAS CIUDADES Y MUNICIPIOS:');
    console.log('Num | Sucursal | Ciudad | Municipio | Estado | Grupo | Coords');
    console.log('----|----------|--------|-----------|--------|-------|-------');
    
    allCities.rows.forEach(branch => {
      const coords = `${parseFloat(branch.latitude).toFixed(2)}, ${parseFloat(branch.longitude).toFixed(2)}`;
      console.log(`${branch.branch_number.toString().padStart(3)} | ${branch.name.substring(0,15).padEnd(15)} | ${branch.city.substring(0,12).padEnd(12)} | ${(branch.municipality || 'NULL').substring(0,12).padEnd(12)} | ${branch.state.substring(0,10).padEnd(10)} | ${branch.group_name.substring(0,8).padEnd(8)} | ${coords}`);
    });
    
    // 3. Verificar grupos que podrían estar mal
    console.log('\n👥 TODOS LOS GRUPOS ACTUALES:');
    const allGroups = await pool.query(`
      SELECT 
        group_id, group_name, 
        COUNT(*) as sucursales,
        STRING_AGG(CAST(branch_number AS text), ', ' ORDER BY branch_number) as numeros
      FROM branches 
      WHERE active = true 
      GROUP BY group_id, group_name
      ORDER BY group_id
    `);
    
    allGroups.rows.forEach(group => {
      console.log(`\n🏛️ GRUPO ${group.group_id}: ${group.group_name} (${group.sucursales} sucursales)`);
      console.log(`   Números: ${group.numeros}`);
    });
    
    console.log('\n⚠️ CORRECCIONES NECESARIAS SEGÚN ROBERTO:');
    console.log('   1. Sucursal #82 → Cambiar a Grupo EXPO');
    console.log('   2. Sucursal #57 → Corregir ciudad a Saltillo');
    console.log('   3. Revisar todas las ciudades con coordenadas');
    console.log('   4. Eliminar la columna región (no es útil)');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

verifyCitiesAndGroups();