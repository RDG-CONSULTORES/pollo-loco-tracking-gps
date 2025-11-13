require('dotenv').config();
const { Client } = require('pg');

/**
 * Script mejorado para setup de base de datos
 * Ejecuta comandos de manera individual y maneja errores
 */
async function setupDatabase() {
  let client;
  
  try {
    console.log('🔧 Configurando base de datos Railway...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL');
    
    // Comandos SQL básicos primero
    const basicCommands = [
      // Extensions
      'CREATE EXTENSION IF NOT EXISTS postgis',
      
      // Verificar y crear tabla tracking_users si no existe
      `CREATE TABLE IF NOT EXISTS tracking_users (
        id SERIAL PRIMARY KEY,
        tracker_id VARCHAR(10) UNIQUE NOT NULL,
        zenput_email VARCHAR(100) NOT NULL,
        zenput_user_id VARCHAR(50),
        display_name VARCHAR(100),
        phone VARCHAR(20),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      // Índices básicos
      'CREATE INDEX IF NOT EXISTS idx_tracking_users_tid ON tracking_users(tracker_id)',
      'CREATE INDEX IF NOT EXISTS idx_tracking_users_email ON tracking_users(zenput_email)',
      
      // Tabla tracking_config con columnas correctas
      `CREATE TABLE IF NOT EXISTS tracking_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        data_type VARCHAR(20),
        description TEXT,
        updated_by VARCHAR(100),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      // Tabla tracking_admin_log
      `CREATE TABLE IF NOT EXISTS tracking_admin_log (
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
      )`
    ];
    
    console.log('📄 Ejecutando comandos básicos...');
    
    for (const [index, command] of basicCommands.entries()) {
      try {
        await client.query(command);
        console.log(`✅ Comando ${index + 1}/${basicCommands.length} ejecutado`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Comando ${index + 1} ya existía`);
        } else {
          console.error(`❌ Error comando ${index + 1}:`, error.message);
        }
      }
    }
    
    // Verificar estructura
    console.log('\n📊 Verificando estructura...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas encontradas:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Insertar configuraciones básicas
    const configs = [
      { key: 'system_active', value: 'true', description: 'Estado del sistema' },
      { key: 'work_hours_start', value: '07:00', description: 'Hora de inicio' },
      { key: 'work_hours_end', value: '21:00', description: 'Hora de fin' }
    ];
    
    console.log('\n🔧 Insertando configuraciones básicas...');
    for (const config of configs) {
      try {
        await client.query(
          `INSERT INTO tracking_config (key, value, description, updated_by) 
           VALUES ($1, $2, $3, 'setup') 
           ON CONFLICT (key) DO NOTHING`,
          [config.key, config.value, config.description]
        );
      } catch (error) {
        console.error(`❌ Error insertando ${config.key}:`, error.message);
      }
    }
    
    console.log('\n✅ Setup básico completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en setup:', error);
    throw error;
  } finally {
    if (client) {
      await client.end();
      console.log('📋 Conexión cerrada');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('🎉 Setup completado!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Setup falló:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;