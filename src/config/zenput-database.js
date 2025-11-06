const { Pool } = require('pg');

// PostgreSQL Neon - Base de datos Zenput existente (SOLO LECTURA)
const zenputPool = new Pool({
  connectionString: process.env.ZENPUT_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5, // Menos conexiones (solo lectura)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

zenputPool.on('connect', () => {
  console.log('✅ Connected to Zenput Database (READ ONLY)');
});

zenputPool.on('error', (err) => {
  console.error('❌ Zenput Database error:', err);
});

/**
 * Query para Zenput DB - SOLO SELECT permitido
 */
async function query(text, params = []) {
  const normalizedQuery = text.trim().toUpperCase();
  
  // Validación de seguridad: SOLO SELECT
  if (!normalizedQuery.startsWith('SELECT')) {
    throw new Error('❌ ZENPUT DB: Solo se permiten consultas SELECT (READ ONLY)');
  }
  
  const start = Date.now();
  
  try {
    const res = await zenputPool.query(text, params);
    const duration = Date.now() - start;
    
    console.log(`📊 Zenput query (${duration}ms): ${res.rows.length} rows`);
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Zenput query failed (${duration}ms): ${text.substring(0, 100)}`);
    console.error('Error:', error.message);
    throw error;
  }
}

/**
 * Test de conexión a Zenput
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`✅ Zenput DB connection OK. Time: ${result.rows[0].current_time}`);
    console.log(`📊 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    return true;
  } catch (error) {
    console.error('❌ Zenput DB connection failed:', error.message);
    return false;
  }
}

/**
 * Ver todas las tablas disponibles
 */
async function listTables() {
  try {
    const result = await query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas disponibles en Zenput:');
    result.rows.forEach(table => {
      console.log(`   - ${table.table_name} (${table.table_type})`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error listando tablas:', error.message);
    return [];
  }
}

/**
 * Ver columnas de una tabla específica
 */
async function describeTable(tableName) {
  try {
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    console.log(`📋 Columnas de tabla '${tableName}':`);
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error(`❌ Error describiendo tabla ${tableName}:`, error.message);
    return [];
  }
}

module.exports = { 
  pool: zenputPool, 
  query, 
  testConnection,
  listTables,
  describeTable
};