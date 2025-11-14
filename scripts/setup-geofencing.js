const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupGeofencing() {
  console.log('🔧 Configurando sistema de geofencing...');
  
  try {
    // Usar URL de Railway desde variables de entorno
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // Leer y ejecutar el script SQL
    const sqlPath = path.join(__dirname, 'create-geofencing-tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📊 Ejecutando creación de tablas...');
    const result = await client.query(sqlContent);
    
    console.log('✅ Tablas de geofencing creadas exitosamente');
    
    // Verificar que las tablas existan
    const verifyResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('sucursal_geofences', 'geofence_events', 'user_sucursal_state')
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas verificadas:');
    verifyResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Verificar funciones
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('calculate_distance_meters', 'get_nearby_geofences')
      ORDER BY routine_name
    `);
    
    console.log('⚡ Funciones creadas:');
    functionsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.routine_name}`);
    });
    
    // Verificar configuración
    const configResult = await client.query(`
      SELECT key, value, description 
      FROM tracking_config 
      WHERE key LIKE 'geofenc%'
      ORDER BY key
    `);
    
    console.log('⚙️ Configuración agregada:');
    configResult.rows.forEach(row => {
      console.log(`  ✓ ${row.key}: ${row.value}`);
    });
    
    await client.end();
    console.log('🎉 Setup de geofencing completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error configurando geofencing:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  // Cargar variables de entorno
  require('dotenv').config();
  setupGeofencing();
}

module.exports = setupGeofencing;