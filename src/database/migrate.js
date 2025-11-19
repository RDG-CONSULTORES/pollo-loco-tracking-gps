const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Cargar variables de entorno
require('dotenv').config();

/**
 * Database Migration Runner
 * Ejecuta migraciones SQL en orden
 */

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Ejecutar migración específica
 */
async function runMigration(migrationFile) {
  const migrationPath = path.join(__dirname, 'migrations', migrationFile);
  
  try {
    console.log(`📄 Ejecutando migración: ${migrationFile}`);
    
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    // Ejecutar SQL
    await pool.query(sql);
    
    console.log(`✅ Migración completada: ${migrationFile}`);
    
  } catch (error) {
    console.error(`❌ Error en migración ${migrationFile}:`, error.message);
    throw error;
  }
}

/**
 * Ejecutar todas las migraciones
 */
async function runAllMigrations() {
  try {
    console.log('🚀 Iniciando migraciones de base de datos...');
    
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    
    // Filtrar solo archivos SQL y ordenar
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📋 Migraciones encontradas: ${migrationFiles.length}`);
    
    for (const file of migrationFiles) {
      await runMigration(file);
    }
    
    console.log('🎉 Todas las migraciones completadas exitosamente');
    
  } catch (error) {
    console.error('💥 Error ejecutando migraciones:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Ejecutar migración específica del sistema de permisos
 */
async function runPermissionSystemMigration() {
  try {
    console.log('🏛️ Ejecutando migración del sistema de permisos...');
    
    await runMigration('003_create_permission_system.sql');
    
    console.log('✅ Sistema de permisos instalado correctamente');
    
    // Verificar que las tablas fueron creadas
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('directors', 'operational_groups', 'permissions', 'roles', 'role_permissions')
      ORDER BY table_name
    `);
    
    console.log('📊 Tablas creadas:', result.rows.map(row => row.table_name));
    
    // Mostrar estadísticas iniciales
    const statsQueries = [
      { name: 'Roles', query: 'SELECT COUNT(*) as count FROM roles' },
      { name: 'Permisos', query: 'SELECT COUNT(*) as count FROM permissions' },
      { name: 'Grupos Operativos', query: 'SELECT COUNT(*) as count FROM operational_groups' }
    ];
    
    for (const { name, query } of statsQueries) {
      const result = await pool.query(query);
      console.log(`📈 ${name}: ${result.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Error en migración de permisos:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Verificar estructura de base de datos
 */
async function verifyDatabase() {
  try {
    console.log('🔍 Verificando estructura de base de datos...');
    
    const requiredTables = [
      'tracking_users',
      'tracking_locations_cache', 
      'gps_locations',
      'geofence_events',
      'directors',
      'operational_groups',
      'permissions',
      'roles',
      'role_permissions'
    ];
    
    for (const table of requiredTables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`📋 ${table}: ${exists ? '✅' : '❌'}`);
      
      if (!exists) {
        throw new Error(`Tabla requerida '${table}' no existe`);
      }
    }
    
    console.log('✅ Estructura de base de datos verificada');
    
  } catch (error) {
    console.error('❌ Error verificando base de datos:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'permissions':
      runPermissionSystemMigration();
      break;
    case 'all':
      runAllMigrations();
      break;
    case 'verify':
      verifyDatabase();
      break;
    default:
      console.log(`
🗃️ Database Migration Tool

Uso:
  node migrate.js permissions  - Ejecutar migración del sistema de permisos
  node migrate.js all         - Ejecutar todas las migraciones
  node migrate.js verify      - Verificar estructura de BD

Ejemplos:
  npm run db:migrate:permissions
  npm run db:migrate:all
  npm run db:verify
      `);
  }
}

module.exports = {
  runMigration,
  runAllMigrations,
  runPermissionSystemMigration,
  verifyDatabase
};