require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

/**
 * Script para configurar la base de datos inicial
 */
async function setupDatabase() {
  let client;
  
  try {
    console.log('🔧 Configurando base de datos Railway...');
    
    // Conectar a PostgreSQL
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL');
    
    // Leer schema SQL
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Ejecutando schema SQL...');
    
    // Ejecutar schema
    await client.query(schemaSql);
    
    console.log('✅ Schema ejecutado exitosamente');
    
    // Verificar tablas creadas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'tracking_%'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tablas creadas:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Verificar configuración inicial
    const configResult = await client.query(`
      SELECT key, value FROM tracking_config ORDER BY key
    `);
    
    console.log('\n⚙️ Configuración inicial:');
    configResult.rows.forEach(row => {
      console.log(`   ${row.key}: ${row.value}`);
    });
    
    // Verificar extensiones
    const extensionsResult = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'postgis'
    `);
    
    if (extensionsResult.rows.length > 0) {
      console.log('\n🗺️ PostGIS disponible para geolocalización');
    } else {
      console.log('\n⚠️ PostGIS no disponible - usando funciones de fallback');
    }
    
    console.log('\n✅ Base de datos configurada exitosamente');
    
  } catch (error) {
    console.error('❌ Error configurando base de datos:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('💡 INFO: Algunas tablas ya existían, continuando...');
    } else {
      throw error;
    }
    
  } finally {
    if (client) {
      await client.end();
      console.log('📋 Conexión cerrada');
    }
  }
}

/**
 * Verificar estado de la base de datos
 */
async function checkDatabaseStatus() {
  let client;
  
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    
    // Verificar tablas requeridas
    const requiredTables = [
      'tracking_users',
      'tracking_locations_cache',
      'tracking_locations',
      'tracking_visits',
      'tracking_config'
    ];
    
    const existingTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1)
    `, [requiredTables]);
    
    const existingTables = existingTablesResult.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    console.log('\n📊 Estado de la base de datos:');
    console.log(`✅ Tablas existentes: ${existingTables.length}/${requiredTables.length}`);
    
    if (missingTables.length > 0) {
      console.log(`❌ Tablas faltantes: ${missingTables.join(', ')}`);
      return false;
    }
    
    // Verificar datos básicos
    const stats = {};
    for (const table of existingTables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = parseInt(result.rows[0].count);
    }
    
    console.log('\n📈 Estadísticas:');
    Object.entries(stats).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} registros`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verificando base de datos:', error.message);
    return false;
    
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Ejecutar setup si se llama directamente
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      checkDatabaseStatus()
        .then(ok => process.exit(ok ? 0 : 1))
        .catch(error => {
          console.error(error.message);
          process.exit(1);
        });
      break;
      
    default:
      setupDatabase()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(error.message);
          process.exit(1);
        });
  }
}

module.exports = { setupDatabase, checkDatabaseStatus };