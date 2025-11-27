require('dotenv').config();
const { Pool } = require('pg');

async function debugTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO ESTRUCTURA DE TABLA gps_locations\n');
    
    // Verificar si la tabla existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gps_locations'
      );
    `);
    
    console.log(`📊 ¿Tabla gps_locations existe? ${tableExists.rows[0].exists}`);
    
    if (tableExists.rows[0].exists) {
      // Obtener estructura de la tabla
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'gps_locations'
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📋 COLUMNAS DE gps_locations:');
      columns.rows.forEach((col, i) => {
        console.log(`   ${i+1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      // Verificar datos existentes
      const count = await pool.query('SELECT COUNT(*) FROM gps_locations');
      console.log(`\n📈 Registros en gps_locations: ${count.rows[0].count}`);
      
    } else {
      console.log('\n❌ TABLA gps_locations NO EXISTE');
      
      // Buscar tablas similares
      const similarTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%location%' OR table_name LIKE '%gps%' OR table_name LIKE '%tracking%'
        ORDER BY table_name;
      `);
      
      console.log('\n🔍 TABLAS SIMILARES ENCONTRADAS:');
      similarTables.rows.forEach((table, i) => {
        console.log(`   ${i+1}. ${table.table_name}`);
      });
    }
    
    // Verificar tabla tracking_users
    console.log('\n📊 VERIFICANDO tracking_users:');
    const userExists = await pool.query(`
      SELECT tracker_id, display_name, active 
      FROM tracking_users 
      WHERE tracker_id = 'RD01'
    `);
    
    if (userExists.rows.length > 0) {
      const user = userExists.rows[0];
      console.log(`   ✅ Usuario RD01 encontrado: ${user.display_name} (activo: ${user.active})`);
    } else {
      console.log(`   ❌ Usuario RD01 NO encontrado`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugTables();