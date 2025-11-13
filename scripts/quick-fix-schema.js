require('dotenv').config();
const { Client } = require('pg');

/**
 * Script rápido para arreglar el schema directamente en Railway
 * Este script es más simple y directo
 */
async function quickFix() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado exitosamente');
    
    // 1. Renombrar columnas en tracking_visits
    console.log('\n1️⃣ Renombrando columnas...');
    
    const renameQueries = [
      "ALTER TABLE tracking_visits RENAME COLUMN entrada_at TO entry_time",
      "ALTER TABLE tracking_visits RENAME COLUMN salida_at TO exit_time", 
      "ALTER TABLE tracking_visits RENAME COLUMN duracion_minutos TO duration_minutes",
      "ALTER TABLE tracking_visits RENAME COLUMN entrada_lat TO entry_lat",
      "ALTER TABLE tracking_visits RENAME COLUMN entrada_lon TO entry_lon",
      "ALTER TABLE tracking_visits RENAME COLUMN salida_lat TO exit_lat",
      "ALTER TABLE tracking_visits RENAME COLUMN salida_lon TO exit_lon"
    ];

    for (const query of renameQueries) {
      try {
        await client.query(query);
        console.log(`✅ Ejecutado: ${query}`);
      } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          console.log(`⚠️  Ya procesado: ${query.split(' ')[5]}`);
        } else {
          console.error(`❌ Error: ${error.message}`);
        }
      }
    }

    // 2. Agregar columna store_id
    console.log('\n2️⃣ Agregando columnas faltantes...');
    
    try {
      await client.query("ALTER TABLE tracking_visits ADD COLUMN IF NOT EXISTS store_id VARCHAR(50)");
      console.log('✅ Columna store_id agregada/verificada');
    } catch (error) {
      console.error(`❌ Error con store_id: ${error.message}`);
    }

    // 3. Agregar columna updated_by
    try {
      await client.query("ALTER TABLE tracking_config ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)");
      console.log('✅ Columna updated_by agregada/verificada');
    } catch (error) {
      console.error(`❌ Error con updated_by: ${error.message}`);
    }

    // 4. Crear tabla tracking_admin_log
    console.log('\n3️⃣ Creando tabla tracking_admin_log...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tracking_admin_log (
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
      )
    `;
    
    try {
      await client.query(createTableQuery);
      console.log('✅ Tabla tracking_admin_log creada/verificada');
    } catch (error) {
      console.error(`❌ Error creando tabla: ${error.message}`);
    }

    // 5. Recrear índices con nombres correctos
    console.log('\n4️⃣ Actualizando índices...');
    
    const indexQueries = [
      "DROP INDEX IF EXISTS idx_visits_open",
      "DROP INDEX IF EXISTS idx_visits_tracker_date", 
      "DROP INDEX IF EXISTS idx_visits_location_date",
      "DROP INDEX IF EXISTS idx_visits_date",
      "CREATE INDEX IF NOT EXISTS idx_visits_open ON tracking_visits(tracker_id) WHERE exit_time IS NULL",
      "CREATE INDEX IF NOT EXISTS idx_visits_tracker_date ON tracking_visits(tracker_id, DATE(entry_time) DESC)",
      "CREATE INDEX IF NOT EXISTS idx_visits_location_date ON tracking_visits(location_code, DATE(entry_time) DESC)",
      "CREATE INDEX IF NOT EXISTS idx_visits_date ON tracking_visits(DATE(entry_time) DESC)"
    ];

    for (const query of indexQueries) {
      try {
        await client.query(query);
        console.log(`✅ ${query.includes('DROP') ? 'Eliminado' : 'Creado'} índice`);
      } catch (error) {
        console.error(`❌ Error con índice: ${error.message}`);
      }
    }

    // 6. Verificar estructura
    console.log('\n5️⃣ Verificando estructura final de tracking_visits...');
    
    const result = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'tracking_visits' 
       ORDER BY ordinal_position`
    );
    
    console.log('\n📊 Columnas de tracking_visits:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ Schema arreglado exitosamente!');
    console.log('🎯 Ahora puedes probar el panel web nuevamente');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await client.end();
    console.log('\n👋 Desconectado de la base de datos');
    process.exit(0);
  }
}

// Ejecutar
quickFix();