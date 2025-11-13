require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para arreglar tabla tracking_users
 */
async function fixUsersTable() {
  let client;
  
  try {
    console.log('🔧 Arreglando tabla tracking_users...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // Verificar estructura actual
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_users'
      ORDER BY ordinal_position
    `);
    
    const currentColumns = columns.rows.map(r => r.column_name);
    console.log('📊 Columnas actuales:', currentColumns);
    
    // Columnas que deberían existir
    const requiredColumns = [
      { name: 'zenput_user_id', type: 'VARCHAR(50)' },
      { name: 'phone', type: 'VARCHAR(20)' }
    ];
    
    // Agregar columnas faltantes
    for (const column of requiredColumns) {
      if (!currentColumns.includes(column.name)) {
        console.log(`➕ Agregando columna ${column.name}...`);
        try {
          await client.query(`ALTER TABLE tracking_users ADD COLUMN ${column.name} ${column.type}`);
          console.log(`   ✅ Columna ${column.name} agregada`);
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  Columna ${column.name} ya existe`);
      }
    }
    
    // Verificar estructura final
    const finalColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_users'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estructura final de tracking_users:');
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ Tabla tracking_users arreglada!');
    
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
  fixUsersTable()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fixUsersTable;