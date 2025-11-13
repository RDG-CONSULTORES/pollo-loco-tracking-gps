require('dotenv').config();
const db = require('../src/config/database');

/**
 * Script para arreglar el schema de la base de datos
 */
async function fixDatabaseSchema() {
  try {
    console.log('🔧 Arreglando schema de base de datos...');
    
    // 1. Renombrar columnas de español a inglés en tracking_visits
    console.log('\n1️⃣ Renombrando columnas de tracking_visits...');
    
    const renameColumns = [
      'ALTER TABLE tracking_visits RENAME COLUMN entrada_at TO entry_time',
      'ALTER TABLE tracking_visits RENAME COLUMN salida_at TO exit_time',
      'ALTER TABLE tracking_visits RENAME COLUMN duracion_minutos TO duration_minutes',
      'ALTER TABLE tracking_visits RENAME COLUMN entrada_lat TO entry_lat',
      'ALTER TABLE tracking_visits RENAME COLUMN entrada_lon TO entry_lon', 
      'ALTER TABLE tracking_visits RENAME COLUMN salida_lat TO exit_lat',
      'ALTER TABLE tracking_visits RENAME COLUMN salida_lon TO exit_lon'
    ];
    
    for (const query of renameColumns) {
      try {
        await db.query(query);
        console.log(`✅ ${query}`);
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log(`⚠️  Ya renombrada: ${query.split(' ')[5]}`);
        } else {
          console.error(`❌ Error: ${error.message}`);
        }
      }
    }
    
    // 2. Agregar columna store_id si no existe
    console.log('\n2️⃣ Agregando columna store_id...');
    try {
      await db.query('ALTER TABLE tracking_visits ADD COLUMN store_id VARCHAR(50)');
      console.log('✅ Columna store_id agregada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Columna store_id ya existe');
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    }
    
    // 3. Agregar columna updated_by a tracking_config si no existe
    console.log('\n3️⃣ Agregando columna updated_by a tracking_config...');
    try {
      await db.query('ALTER TABLE tracking_config ADD COLUMN updated_by VARCHAR(100)');
      console.log('✅ Columna updated_by agregada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Columna updated_by ya existe');
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    }
    
    // 4. Crear tabla tracking_admin_log si no existe
    console.log('\n4️⃣ Creando tabla tracking_admin_log...');
    try {
      await db.query(`
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
      console.log('✅ Tabla tracking_admin_log creada');
    } catch (error) {
      console.error(`❌ Error creando tabla: ${error.message}`);
    }
    
    // 5. Actualizar índices
    console.log('\n5️⃣ Actualizando índices...');
    try {
      // Eliminar índices antiguos
      await db.query('DROP INDEX IF EXISTS idx_visits_open');
      await db.query('DROP INDEX IF EXISTS idx_visits_tracker_date');
      await db.query('DROP INDEX IF EXISTS idx_visits_location_date');
      await db.query('DROP INDEX IF EXISTS idx_visits_date');
      
      // Crear nuevos índices con nombres en inglés
      await db.query('CREATE INDEX idx_visits_open ON tracking_visits(tracker_id) WHERE exit_time IS NULL');
      await db.query('CREATE INDEX idx_visits_tracker_date ON tracking_visits(tracker_id, DATE(entry_time) DESC)');
      await db.query('CREATE INDEX idx_visits_location_date ON tracking_visits(location_code, DATE(entry_time) DESC)');
      await db.query('CREATE INDEX idx_visits_date ON tracking_visits(DATE(entry_time) DESC)');
      
      console.log('✅ Índices actualizados');
    } catch (error) {
      console.error(`❌ Error actualizando índices: ${error.message}`);
    }
    
    // 6. Insertar configuraciones por defecto
    console.log('\n6️⃣ Insertando configuraciones por defecto...');
    const configs = [
      { key: 'system_active', value: 'true', description: 'Estado del sistema' },
      { key: 'work_hours_start', value: '07:00', description: 'Hora de inicio' },
      { key: 'work_hours_end', value: '21:00', description: 'Hora de fin' },
      { key: 'geofence_radius_meters', value: '100', description: 'Radio geofence' },
      { key: 'min_visit_duration_minutes', value: '5', description: 'Duración mínima' }
    ];
    
    for (const config of configs) {
      try {
        await db.query(
          `INSERT INTO tracking_config (key, value, description, updated_by)
           VALUES ($1, $2, $3, 'system')
           ON CONFLICT (key) DO NOTHING`,
          [config.key, config.value, config.description]
        );
        console.log(`✅ Config: ${config.key}`);
      } catch (error) {
        console.error(`❌ Error insertando config: ${error.message}`);
      }
    }
    
    // 7. Verificar estructura final
    console.log('\n7️⃣ Verificando estructura final...');
    
    const tables = ['tracking_users', 'tracking_locations_cache', 'tracking_locations', 
                   'tracking_visits', 'tracking_config', 'tracking_admin_log'];
    
    for (const table of tables) {
      const result = await db.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1 
         ORDER BY ordinal_position`,
        [table]
      );
      console.log(`\n📊 Tabla ${table}:`);
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
    
    console.log('\n✅ Schema arreglado exitosamente!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

// Ejecutar
fixDatabaseSchema();