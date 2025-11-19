require('dotenv').config();
const { Client } = require('pg');

/**
 * Crear tablas y vistas faltantes que el dashboard necesita
 */

async function createMissingObjects() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔧 Creando objetos de base de datos faltantes...');
    
    // 1. Crear vista geofences basada en tracking_locations_cache
    console.log('\n📍 Creando vista geofences...');
    await client.query(`
      DROP VIEW IF EXISTS geofences CASCADE;
      
      CREATE VIEW geofences AS
      SELECT 
        id,
        location_code,
        name as location_name,
        group_name as grupo,
        latitude::text,
        longitude::text,
        geofence_radius as radius_meters,
        active,
        synced_at as updated_at
      FROM tracking_locations_cache
      WHERE active = true;
    `);
    console.log('✅ Vista geofences creada');
    
    // 2. Crear vista v_tracking_current_locations
    console.log('\n📍 Creando vista v_tracking_current_locations...');
    await client.query(`
      DROP VIEW IF EXISTS v_tracking_current_locations CASCADE;
      
      CREATE VIEW v_tracking_current_locations AS
      SELECT 
        gl.id,
        gl.user_id,
        tu.display_name,
        tu.tracker_id,
        gl.latitude,
        gl.longitude,
        gl.accuracy,
        gl.battery,
        gl.received_at as timestamp,
        EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60 as minutes_ago,
        CASE 
          WHEN EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60 < 5 THEN 'online'
          WHEN EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60 < 30 THEN 'recent'
          WHEN EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60 < 120 THEN 'away'
          ELSE 'offline'
        END as status,
        CASE 
          WHEN EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60 < 1 THEN 'Ahora'
          WHEN EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60 < 60 THEN 
            ROUND(EXTRACT(EPOCH FROM (NOW() - gl.received_at))/60) || 'm'
          ELSE 
            ROUND(EXTRACT(EPOCH FROM (NOW() - gl.received_at))/3600, 1) || 'h'
        END as time_ago
      FROM (
        -- Obtener la ubicación más reciente por usuario
        SELECT DISTINCT ON (user_id) 
          id, user_id, latitude, longitude, accuracy, battery, received_at
        FROM gps_locations 
        WHERE received_at > NOW() - INTERVAL '24 hours'
        ORDER BY user_id, received_at DESC
      ) gl
      JOIN tracking_users tu ON gl.user_id = tu.id
      WHERE tu.active = true
      ORDER BY gl.received_at DESC;
    `);
    console.log('✅ Vista v_tracking_current_locations creada');
    
    // 3. Verificar que las vistas funcionan
    console.log('\n🧪 Verificando vistas creadas...');
    
    const geofencesCount = await client.query('SELECT COUNT(*) as total FROM geofences');
    console.log(`✅ geofences: ${geofencesCount.rows[0].total} registros`);
    
    const locationsCount = await client.query('SELECT COUNT(*) as total FROM v_tracking_current_locations');
    console.log(`✅ v_tracking_current_locations: ${locationsCount.rows[0].total} registros`);
    
    // 4. Mostrar muestra de datos
    console.log('\n📊 Muestra de geofences:');
    const sampleGeofences = await client.query('SELECT location_name, grupo, latitude, longitude FROM geofences LIMIT 5');
    sampleGeofences.rows.forEach(row => {
      console.log(`  - ${row.location_name} (${row.grupo}): ${row.latitude}, ${row.longitude}`);
    });
    
    console.log('\n🎉 Objetos de base de datos creados exitosamente');
    console.log('🔄 El dashboard ahora debería funcionar correctamente');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  createMissingObjects()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createMissingObjects;