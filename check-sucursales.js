const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkSucursales() {
  try {
    console.log('🔍 Verificando datos de sucursales...\n');
    
    // Verificar tracking_locations_cache
    const cacheResult = await pool.query('SELECT COUNT(*) as count FROM tracking_locations_cache WHERE active = true');
    console.log(`📊 Sucursales activas en cache: ${cacheResult.rows[0].count}`);
    
    // Verificar tracking_locations
    const locationsResult = await pool.query('SELECT COUNT(*) as count FROM tracking_locations WHERE is_active = true');
    console.log(`📊 Sucursales activas en locations: ${locationsResult.rows[0].count}`);
    
    // Sample de datos
    const sampleResult = await pool.query(`
      SELECT location_code, name, latitude, longitude, active 
      FROM tracking_locations_cache 
      WHERE active = true 
      ORDER BY name 
      LIMIT 5
    `);
    
    console.log('\n📍 Muestra de sucursales:');
    sampleResult.rows.forEach(row => {
      console.log(`   ${row.location_code}: ${row.name} (${row.latitude}, ${row.longitude})`);
    });
    
    // Verificar geofences
    const geofencesResult = await pool.query('SELECT COUNT(*) as count FROM geofences WHERE active = true');
    console.log(`\n🔵 Geofences activos: ${geofencesResult.rows[0].count}`);
    
    // Verificar sucursal_geofences
    const sucursalGeoResult = await pool.query('SELECT COUNT(*) as count FROM sucursal_geofences WHERE active = true');
    console.log(`🔵 Sucursal geofences activos: ${sucursalGeoResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSucursales();