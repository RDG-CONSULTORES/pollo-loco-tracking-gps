const { Pool } = require('pg');

// PostgreSQL Railway - Nueva DB para datos de tracking
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connected to Railway PostgreSQL (Tracking Database)');
});

pool.on('error', (err) => {
  console.error('❌ Railway PostgreSQL error:', err);
  process.exit(-1);
});

/**
 * Ejecutar query con monitoreo de performance
 */
async function query(text, params) {
  const start = Date.now();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Warning para queries lentas
    if (duration > 1000) {
      console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Query failed (${duration}ms): ${text.substring(0, 100)}`);
    console.error('Error:', error.message);
    throw error;
  }
}

/**
 * Obtener configuración del sistema
 */
async function getConfig(key, defaultValue = null) {
  try {
    const result = await query(
      'SELECT value FROM tracking_config WHERE key = $1',
      [key]
    );
    return result.rows[0]?.value || defaultValue;
  } catch (error) {
    console.error(`❌ Error obteniendo config ${key}:`, error.message);
    return defaultValue;
  }
}

/**
 * Actualizar configuración del sistema
 */
async function setConfig(key, value, updatedBy = 'system') {
  try {
    await query(
      `INSERT INTO tracking_config (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
      [key, value, updatedBy]
    );
    console.log(`✅ Config updated: ${key} = ${value}`);
    return true;
  } catch (error) {
    console.error(`❌ Error actualizando config ${key}:`, error.message);
    return false;
  }
}

/**
 * Test de conexión
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log(`✅ Railway DB connection OK. Time: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('❌ Railway DB connection failed:', error.message);
    return false;
  }
}

module.exports = { 
  pool, 
  query, 
  getConfig, 
  setConfig, 
  testConnection 
};