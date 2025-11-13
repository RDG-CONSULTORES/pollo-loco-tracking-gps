require('dotenv').config();
const { Client } = require('pg');

/**
 * Verificar estructura de base de datos
 */
async function verifyDatabase() {
  let client;
  
  try {
    console.log('🔍 Verificando base de datos...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // Verificar todas las tablas
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tablas existentes:');
    for (const table of tables.rows) {
      console.log(`  - ${table.table_name}`);
      
      // Contar registros
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`    → ${count.rows[0].count} registros`);
      } catch (error) {
        console.log(`    → Error: ${error.message}`);
      }
    }
    
    // Verificar específicamente las tablas requeridas
    const requiredTables = [
      'tracking_users',
      'tracking_locations_cache', 
      'tracking_visits',
      'tracking_config',
      'tracking_admin_log'
    ];
    
    console.log('\n🔧 Verificando tablas requeridas:');
    for (const tableName of requiredTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tableName]);
      
      if (exists.rows[0].exists) {
        console.log(`  ✅ ${tableName} - existe`);
      } else {
        console.log(`  ❌ ${tableName} - NO existe`);
      }
    }
    
    console.log('\n🎉 Verificación completada!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Ejecutar
if (require.main === module) {
  verifyDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = verifyDatabase;