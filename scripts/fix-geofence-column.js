require('dotenv').config();
const { Client } = require('pg');

/**
 * Agregar columna geofence_radius faltante
 */
async function fixGeofenceColumn() {
  let client;
  
  try {
    console.log('🔧 Agregando columna geofence_radius...');
    
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
    
    // Verificar si la columna existe
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_locations_cache' 
      AND column_name = 'geofence_radius'
    `);
    
    if (checkColumn.rows.length === 0) {
      // Agregar la columna
      await client.query(`
        ALTER TABLE tracking_locations_cache 
        ADD COLUMN geofence_radius INT DEFAULT 150
      `);
      console.log('✅ Columna geofence_radius agregada exitosamente');
    } else {
      console.log('✅ Columna geofence_radius ya existe');
    }
    
    // Verificar estructura final
    const columns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tracking_locations_cache'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estructura actual de tracking_locations_cache:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.column_default ? ' (default: ' + col.column_default + ')' : ''}`);
    });
    
    console.log('\n✅ Fix completado!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (client) await client.end();
  }
}

if (require.main === module) {
  fixGeofenceColumn()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fixGeofenceColumn;