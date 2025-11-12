require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para explorar la estructura de la base de datos
 */
async function exploreDatabase() {
  console.log('🔍 Explorando base de datos Railway...\n');
  
  // Usar la URL pública para conexión remota
  const databaseUrl = process.env.DATABASE_URL || 
    'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@yamabiko.proxy.rlwy.net:42861/railway';
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // 1. Verificar extensiones
    console.log('📦 EXTENSIONES INSTALADAS:');
    const extensions = await client.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname NOT IN ('plpgsql')
      ORDER BY extname
    `);
    
    if (extensions.rows.length === 0) {
      console.log('   No hay extensiones adicionales instaladas');
    } else {
      extensions.rows.forEach(ext => {
        console.log(`   - ${ext.extname} v${ext.extversion}`);
      });
    }
    
    // 2. Listar todas las tablas
    console.log('\n📋 TABLAS EXISTENTES:');
    const tables = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `);
    
    if (tables.rows.length === 0) {
      console.log('   ❌ No hay tablas creadas aún');
    } else {
      tables.rows.forEach(table => {
        console.log(`   - ${table.schemaname}.${table.tablename} (${table.size})`);
      });
    }
    
    // 3. Para cada tabla, mostrar columnas
    for (const table of tables.rows) {
      console.log(`\n   📊 Estructura de ${table.tablename}:`);
      
      const columns = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = $1 
          AND table_name = $2
        ORDER BY ordinal_position
      `, [table.schemaname, table.tablename]);
      
      columns.rows.forEach(col => {
        let type = col.data_type;
        if (col.character_maximum_length) {
          type += `(${col.character_maximum_length})`;
        }
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        
        console.log(`      - ${col.column_name}: ${type} ${nullable}${defaultVal}`);
      });
    }
    
    // 4. Verificar si PostGIS está disponible
    console.log('\n🗺️ VERIFICANDO PostGIS:');
    try {
      const postgisCheck = await client.query(`
        SELECT PostGIS_version()
      `);
      console.log(`   ✅ PostGIS instalado: ${postgisCheck.rows[0].postgis_version}`);
    } catch (error) {
      console.log('   ❌ PostGIS NO está instalado');
      console.log('   💡 Intentaremos crear la extensión...');
      
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
        console.log('   ✅ PostGIS instalado exitosamente!');
      } catch (createError) {
        console.log('   ❌ No se pudo instalar PostGIS:', createError.message);
      }
    }
    
    // 5. Información de la base de datos
    console.log('\n💾 INFORMACIÓN DE LA BASE DE DATOS:');
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database,
        pg_database_size(current_database()) as size,
        version() as version
    `);
    
    const info = dbInfo.rows[0];
    console.log(`   Database: ${info.database}`);
    console.log(`   Tamaño: ${(info.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Versión: ${info.version.split(',')[0]}`);
    
    // 6. Verificar permisos
    console.log('\n🔐 PERMISOS DEL USUARIO:');
    const permissions = await client.query(`
      SELECT has_database_privilege(current_user, current_database(), 'CREATE') as can_create
    `);
    
    console.log(`   ¿Puede crear tablas?: ${permissions.rows[0].can_create ? '✅ SÍ' : '❌ NO'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Exploración completada');
  }
}

// Ejecutar
if (require.main === module) {
  exploreDatabase();
}

module.exports = { exploreDatabase };