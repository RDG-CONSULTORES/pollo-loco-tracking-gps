require('dotenv').config();
const { Client } = require('pg');

/**
 * Migración específica para convertir schema español → inglés
 */
async function migrateToEnglish() {
  let client;
  
  try {
    console.log('🔄 Iniciando migración Spanish → English...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // Verificar si tracking_visits existe y qué columnas tiene
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_visits'
      ORDER BY ordinal_position
    `);
    
    const currentColumns = checkColumns.rows.map(row => row.column_name);
    console.log('📊 Columnas actuales en tracking_visits:', currentColumns);
    
    // Migración step by step
    const migrations = [
      {
        name: 'Renombrar entrada_at → entry_time',
        sql: 'ALTER TABLE tracking_visits RENAME COLUMN entrada_at TO entry_time',
        check: () => currentColumns.includes('entrada_at') && !currentColumns.includes('entry_time')
      },
      {
        name: 'Renombrar salida_at → exit_time',
        sql: 'ALTER TABLE tracking_visits RENAME COLUMN salida_at TO exit_time',
        check: () => currentColumns.includes('salida_at') && !currentColumns.includes('exit_time')
      },
      {
        name: 'Renombrar duracion_minutos → duration_minutes',
        sql: 'ALTER TABLE tracking_visits RENAME COLUMN duracion_minutos TO duration_minutes',
        check: () => currentColumns.includes('duracion_minutos') && !currentColumns.includes('duration_minutes')
      },
      {
        name: 'Agregar store_id si no existe',
        sql: 'ALTER TABLE tracking_visits ADD COLUMN IF NOT EXISTS store_id VARCHAR(50)',
        check: () => !currentColumns.includes('store_id')
      },
      {
        name: 'Agregar updated_by a tracking_config',
        sql: 'ALTER TABLE tracking_config ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)',
        check: () => true // Siempre intentar
      },
      {
        name: 'Crear tabla tracking_admin_log',
        sql: `CREATE TABLE IF NOT EXISTS tracking_admin_log (
          id SERIAL PRIMARY KEY,
          admin_user VARCHAR(100) NOT NULL,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50),
          entity_id VARCHAR(100),
          old_value TEXT,
          new_value TEXT,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        check: () => true // Siempre intentar
      }
    ];
    
    // Ejecutar migraciones
    for (const [index, migration] of migrations.entries()) {
      console.log(`\n${index + 1}️⃣ ${migration.name}...`);
      
      try {
        await client.query(migration.sql);
        console.log(`   ✅ Completado`);
      } catch (error) {
        if (error.message.includes('does not exist') || 
            error.message.includes('already exists')) {
          console.log(`   ⚠️  Ya procesado: ${error.message}`);
        } else {
          console.error(`   ❌ Error: ${error.message}`);
        }
      }
    }
    
    // Verificar resultado final
    console.log('\n📊 Verificando estructura final...');
    const finalColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_visits'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Columnas finales en tracking_visits:');
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });
    
    console.log('\n🎉 Migración completada exitosamente!');
    
  } catch (error) {
    console.error('💥 Error en migración:', error);
    throw error;
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateToEnglish()
    .then(() => {
      console.log('✅ Migración exitosa');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migración falló:', error);
      process.exit(1);
    });
}

module.exports = migrateToEnglish;