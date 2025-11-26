require('dotenv').config();
const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO SCHEMA DE LA BASE DE DATOS...\n');
    
    // 1. Verificar columnas de la tabla branches
    console.log('📊 COLUMNAS EN TABLA BRANCHES:');
    const branchColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'branches' 
      ORDER BY ordinal_position
    `);
    
    branchColumns.rows.forEach(col => {
      console.log(`   ${col.column_name} | ${col.data_type} | ${col.is_nullable}`);
    });
    
    // 2. Verificar una muestra de datos reales
    console.log('\n📋 MUESTRA DE DATOS REALES (primeras 10):');
    const sample = await pool.query(`
      SELECT id, name, city, state, latitude, longitude, zenput_id, created_at
      FROM branches 
      WHERE active = true 
      ORDER BY id
      LIMIT 10
    `);
    
    console.log('ID | Nombre | Ciudad | Estado | Coordenadas | Zenput_ID');
    console.log('---|--------|--------|--------|-------------|----------');
    
    sample.rows.forEach(branch => {
      const lat = branch.latitude ? parseFloat(branch.latitude).toFixed(4) : 'N/A';
      const lng = branch.longitude ? parseFloat(branch.longitude).toFixed(4) : 'N/A';
      console.log(`${branch.id} | ${branch.name.substring(0,12).padEnd(12)} | ${branch.city.substring(0,8).padEnd(8)} | ${branch.state.substring(0,8).padEnd(8)} | ${lat}, ${lng} | ${branch.zenput_id || 'N/A'}`);
    });
    
    // 3. Contar total y verificar IDs
    console.log('\n📊 RESUMEN ACTUAL:');
    const counts = await pool.query(`
      SELECT 
        COUNT(*) as total,
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords
      FROM branches 
      WHERE active = true
    `);
    
    const stats = counts.rows[0];
    console.log(`   Total sucursales activas: ${stats.total}`);
    console.log(`   ID mínimo: ${stats.min_id}`);
    console.log(`   ID máximo: ${stats.max_id}`);
    console.log(`   Con coordenadas: ${stats.with_coords}`);
    
    // 4. Verificar las últimas 3 (las nuevas)
    console.log('\n🆕 ÚLTIMAS 3 SUCURSALES (deberían ser las nuevas):');
    const lastThree = await pool.query(`
      SELECT id, name, city, state, zenput_id, latitude, longitude
      FROM branches 
      WHERE active = true 
      ORDER BY id DESC
      LIMIT 3
    `);
    
    lastThree.rows.reverse().forEach(branch => {
      console.log(`   ID ${branch.id}: ${branch.name} - ${branch.city}, ${branch.state}`);
      console.log(`      Zenput: ${branch.zenput_id} | Coords: ${branch.latitude}, ${branch.longitude}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();