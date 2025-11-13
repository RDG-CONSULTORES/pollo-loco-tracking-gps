require('dotenv').config();
const { Client } = require('pg');

/**
 * Fix TODOS los problemas de schema de una vez
 */
async function fixAllSchemaIssues() {
  let client;
  
  try {
    console.log('🔧 Fix completo de TODOS los problemas de schema...');
    
    const databaseUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('❌ No DATABASE_URL found');
    }
    
    client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Conectado a Railway');
    
    // 1. Fix tracking_visits - Renombrar columnas español → inglés
    console.log('\n1️⃣ Fixing tracking_visits...');
    
    const fixes = [
      // Renombrar columnas de tracking_visits
      "ALTER TABLE tracking_visits RENAME COLUMN entrada_at TO entry_time",
      "ALTER TABLE tracking_visits RENAME COLUMN salida_at TO exit_time",
      "ALTER TABLE tracking_visits RENAME COLUMN duracion_minutos TO duration_minutes",
      "ALTER TABLE tracking_visits RENAME COLUMN entrada_lat TO entry_lat",
      "ALTER TABLE tracking_visits RENAME COLUMN entrada_lon TO entry_lon",
      "ALTER TABLE tracking_visits RENAME COLUMN salida_lat TO exit_lat",
      "ALTER TABLE tracking_visits RENAME COLUMN salida_lon TO exit_lon",
      "ALTER TABLE tracking_visits RENAME COLUMN tracker_id TO user_id",
      
      // Agregar columnas faltantes a tracking_visits
      "ALTER TABLE tracking_visits ADD COLUMN IF NOT EXISTS store_id VARCHAR(50)",
      "ALTER TABLE tracking_visits ADD COLUMN IF NOT EXISTS zenput_email VARCHAR(100)",
      
      // Agregar columna a tracking_config
      "ALTER TABLE tracking_config ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)",
      
      // Asegurar que geofence_radius existe en tracking_locations_cache
      "ALTER TABLE tracking_locations_cache ADD COLUMN IF NOT EXISTS geofence_radius INT DEFAULT 150"
    ];
    
    for (const fix of fixes) {
      try {
        await client.query(fix);
        console.log(`  ✅ ${fix.substring(0, 60)}...`);
      } catch (error) {
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          console.log(`  ⏭️  ${fix.substring(0, 60)}... (ya aplicado)`);
        } else {
          console.log(`  ❌ ${fix.substring(0, 60)}... Error: ${error.message}`);
        }
      }
    }
    
    // 2. Crear tablas faltantes
    console.log('\n2️⃣ Creando tablas faltantes...');
    
    try {
      await client.query(`
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
      `);
      console.log('  ✅ tracking_admin_log creada/verificada');
    } catch (error) {
      console.log(`  ❌ Error con tracking_admin_log: ${error.message}`);
    }
    
    // 3. Verificar estructura final
    console.log('\n3️⃣ Verificando estructura final...');
    
    const tables = ['tracking_visits', 'tracking_locations_cache', 'tracking_config', 'tracking_users'];
    
    for (const table of tables) {
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
        ORDER BY ordinal_position
      `);
      
      console.log(`\n📋 ${table}:`);
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
    
    // 4. Verificar que no queden columnas en español
    console.log('\n4️⃣ Verificando que no queden columnas en español...');
    
    const spanishColumns = ['entrada_at', 'salida_at', 'duracion_minutos', 'entrada_lat', 'entrada_lon', 'salida_lat', 'salida_lon'];
    const checkResult = await client.query(`
      SELECT column_name, table_name
      FROM information_schema.columns 
      WHERE column_name = ANY($1)
      AND table_schema = 'public'
    `, [spanishColumns]);
    
    if (checkResult.rows.length > 0) {
      console.log('  ⚠️  Aún quedan columnas en español:');
      checkResult.rows.forEach(col => {
        console.log(`    - ${col.table_name}.${col.column_name}`);
      });
    } else {
      console.log('  ✅ No quedan columnas en español');
    }
    
    console.log('\n✅ Fix completo ejecutado!');
    console.log('📌 Ahora puedes ejecutar: npm run import-dashboard-exact');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (client) await client.end();
  }
}

if (require.main === module) {
  fixAllSchemaIssues()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fixAllSchemaIssues;