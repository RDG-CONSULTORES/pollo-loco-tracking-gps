require('dotenv').config();
const { Client } = require('pg');

/**
 * Fix definitivo para schema - arregla TODOS los problemas
 */
async function fixSchemaFinal() {
  let client;
  
  try {
    console.log('🔧 Fix definitivo de schema...');
    
    // Try multiple DATABASE_URL formats
    const databaseUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('❌ No DATABASE_URL found. Set Railway DATABASE_URL environment variable.');
    }
    
    console.log('🔗 Connecting to:', databaseUrl.split('@')[1] || 'database');
    
    client = new Client({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    console.log('✅ Conectado a Railway');
    
    // Verificar estructura actual de tracking_visits
    const columnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_visits'
      ORDER BY ordinal_position
    `);
    
    const currentColumns = columnsResult.rows.map(r => r.column_name);
    console.log('📊 Columnas actuales en tracking_visits:', currentColumns);
    
    // 1. Si no existen las columnas en inglés, renombrar desde español
    const spanishToEnglish = [
      { spanish: 'entrada_at', english: 'entry_time' },
      { spanish: 'salida_at', english: 'exit_time' },
      { spanish: 'duracion_minutos', english: 'duration_minutes' },
      { spanish: 'entrada_lat', english: 'entry_lat' },
      { spanish: 'entrada_lon', english: 'entry_lon' },
      { spanish: 'salida_lat', english: 'exit_lat' },
      { spanish: 'salida_lon', english: 'exit_lon' }
    ];
    
    console.log('\n1️⃣ Renombrando columnas español → inglés...');
    for (const { spanish, english } of spanishToEnglish) {
      if (currentColumns.includes(spanish) && !currentColumns.includes(english)) {
        try {
          await client.query(`ALTER TABLE tracking_visits RENAME COLUMN ${spanish} TO ${english}`);
          console.log(`  ✅ ${spanish} → ${english}`);
        } catch (error) {
          console.log(`  ⚠️  Error renombrando ${spanish}: ${error.message}`);
        }
      } else if (currentColumns.includes(english)) {
        console.log(`  ✅ ${english} ya existe`);
      } else {
        console.log(`  ❌ Ni ${spanish} ni ${english} existen`);
      }
    }
    
    // 2. Agregar columnas faltantes a tracking_visits
    const missingColumns = [
      { name: 'store_id', type: 'VARCHAR(50)' },
      { name: 'zenput_email', type: 'VARCHAR(100)' }
    ];
    
    console.log('\n2️⃣ Agregando columnas faltantes a tracking_visits...');
    for (const { name, type } of missingColumns) {
      if (!currentColumns.includes(name)) {
        try {
          await client.query(`ALTER TABLE tracking_visits ADD COLUMN ${name} ${type}`);
          console.log(`  ✅ Agregada ${name} (${type})`);
        } catch (error) {
          console.log(`  ⚠️  Error agregando ${name}: ${error.message}`);
        }
      } else {
        console.log(`  ✅ ${name} ya existe`);
      }
    }
    
    // 3. Verificar y crear tabla tracking_admin_log
    console.log('\n3️⃣ Verificando tabla tracking_admin_log...');
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
      console.log('  ✅ Tabla tracking_admin_log OK');
    } catch (error) {
      console.log(`  ❌ Error con tracking_admin_log: ${error.message}`);
    }
    
    // 4. Crear tabla tracking_locations_cache si no existe
    console.log('\n4️⃣ Verificando tabla tracking_locations_cache...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tracking_locations_cache (
          location_code VARCHAR(20) PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          address TEXT,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          group_name VARCHAR(100),
          director_name VARCHAR(100),
          active BOOLEAN DEFAULT true,
          geofence_radius INT DEFAULT 150,
          synced_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Agregar geofence_radius si falta
      try {
        await client.query('ALTER TABLE tracking_locations_cache ADD COLUMN IF NOT EXISTS geofence_radius INT DEFAULT 150');
        console.log('  ✅ Columna geofence_radius verificada');
      } catch (error) {
        // Ignorar si ya existe
      }
      console.log('  ✅ Tabla tracking_locations_cache OK');
    } catch (error) {
      console.log(`  ❌ Error con tracking_locations_cache: ${error.message}`);
    }
    
    // 5. Agregar updated_by a tracking_config si falta
    console.log('\n5️⃣ Verificando tracking_config...');
    const configColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_config'
    `);
    
    const configColumnNames = configColumns.rows.map(r => r.column_name);
    if (!configColumnNames.includes('updated_by')) {
      try {
        await client.query('ALTER TABLE tracking_config ADD COLUMN updated_by VARCHAR(100)');
        console.log('  ✅ Agregada columna updated_by');
      } catch (error) {
        console.log(`  ⚠️  Error agregando updated_by: ${error.message}`);
      }
    } else {
      console.log('  ✅ updated_by ya existe');
    }
    
    // 6. Verificar estructura final
    console.log('\n6️⃣ Verificando estructura final...');
    const finalColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_visits'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estructura final de tracking_visits:');
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // 7. Verificar todas las tablas
    const allTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Todas las tablas:');
    allTables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    console.log('\n✅ Fix de schema completado!');
    
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
  fixSchemaFinal()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fixSchemaFinal;