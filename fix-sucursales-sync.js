const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function syncSucursales() {
  try {
    console.log('🔄 Sincronizando datos de sucursales...\n');
    
    await pool.query('BEGIN');
    
    // 1. Sincronizar tracking_locations_cache -> tracking_locations
    console.log('📍 Sincronizando tracking_locations...');
    
    await pool.query(`
      INSERT INTO tracking_locations (
        location_code, name, address, latitude, longitude, geofence_radius, is_active, created_at, updated_at
      )
      SELECT DISTINCT
        location_code, 
        name, 
        COALESCE(address, name) as address,
        latitude, 
        longitude, 
        COALESCE(geofence_radius, 100) as geofence_radius,
        active as is_active,
        COALESCE(synced_at, NOW()) as created_at,
        NOW() as updated_at
      FROM tracking_locations_cache 
      WHERE active = true
      ON CONFLICT (location_code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `);
    
    const locationsResult = await pool.query('SELECT COUNT(*) as count FROM tracking_locations WHERE is_active = true');
    console.log(`✅ Tracking locations sincronizadas: ${locationsResult.rows[0].count}`);
    
    // 2. Sincronizar geofences -> sucursal_geofences
    console.log('\n🔵 Sincronizando sucursal_geofences...');
    
    await pool.query(`
      INSERT INTO sucursal_geofences (
        location_code, store_name, group_name, latitude, longitude, radius_meters, active, created_at, updated_at
      )
      SELECT DISTINCT
        location_code,
        location_name as store_name,
        COALESCE(grupo, 'General') as group_name,
        CAST(latitude AS NUMERIC) as latitude,
        CAST(longitude AS NUMERIC) as longitude,
        radius_meters,
        active,
        NOW() as created_at,
        NOW() as updated_at
      FROM geofences 
      WHERE active = true
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude != '' 
        AND longitude != ''
      ON CONFLICT (location_code) DO UPDATE SET
        store_name = EXCLUDED.store_name,
        group_name = EXCLUDED.group_name,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        radius_meters = EXCLUDED.radius_meters,
        active = EXCLUDED.active,
        updated_at = NOW()
    `);
    
    const sucursalGeoResult = await pool.query('SELECT COUNT(*) as count FROM sucursal_geofences WHERE active = true');
    console.log(`✅ Sucursal geofences sincronizadas: ${sucursalGeoResult.rows[0].count}`);
    
    // 3. Verificar integridad de coordenadas
    console.log('\n🔍 Verificando integridad de coordenadas...');
    
    const coordCheckResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE latitude BETWEEN 25.5 AND 26.0 AND longitude BETWEEN -100.5 AND -100.0) as monterrey_area,
        COUNT(*) FILTER (WHERE latitude = 0 OR longitude = 0) as zero_coords,
        COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) as null_coords
      FROM tracking_locations_cache 
      WHERE active = true
    `);
    
    const coords = coordCheckResult.rows[0];
    console.log(`📊 Total sucursales: ${coords.total}`);
    console.log(`📍 En área Monterrey: ${coords.monterrey_area}`);
    console.log(`❌ Coordenadas cero: ${coords.zero_coords}`);
    console.log(`❌ Coordenadas nulas: ${coords.null_coords}`);
    
    await pool.query('COMMIT');
    
    console.log('\n🎉 Sincronización completada exitosamente!');
    
    // 4. Muestra final
    const finalSample = await pool.query(`
      SELECT tl.location_code, tl.name, tl.latitude, tl.longitude, sg.radius_meters
      FROM tracking_locations tl
      LEFT JOIN sucursal_geofences sg ON tl.location_code = sg.location_code
      WHERE tl.is_active = true
      ORDER BY tl.name
      LIMIT 5
    `);
    
    console.log('\n📍 Muestra de datos sincronizados:');
    finalSample.rows.forEach(row => {
      console.log(`   ${row.location_code}: ${row.name}`);
      console.log(`      Coords: (${row.latitude}, ${row.longitude})`);
      console.log(`      Radio: ${row.radius_meters || 100}m`);
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error sincronizando:', error.message);
  } finally {
    await pool.end();
  }
}

syncSucursales();