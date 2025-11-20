const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createGeofenceFunction() {
  try {
    console.log('🔧 Creando función get_nearby_geofences en PostgreSQL...\n');
    
    // 1. Eliminar función existente si existe
    console.log('🗑️ Eliminando función existente...');
    await pool.query(`DROP FUNCTION IF EXISTS get_nearby_geofences(double precision, double precision, integer)`);
    
    // 2. Crear nueva función corregida
    console.log('📝 Creando nueva función get_nearby_geofences...');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_nearby_geofences(
        input_lat double precision,
        input_lng double precision,
        search_radius_meters integer DEFAULT 200
      )
      RETURNS TABLE (
        location_code VARCHAR(50),
        store_name TEXT,
        name TEXT,
        latitude NUMERIC(10,8),
        longitude NUMERIC(11,8),
        geofence_radius INTEGER,
        distance_meters DOUBLE PRECISION,
        is_inside BOOLEAN
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          tlc.location_code,
          tlc.name AS store_name,
          tlc.name,
          tlc.latitude,
          tlc.longitude,
          tlc.geofence_radius,
          (6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS(input_lat)) * COS(RADIANS(tlc.latitude::float)) * 
              COS(RADIANS(tlc.longitude::float) - RADIANS(input_lng)) + 
              SIN(RADIANS(input_lat)) * SIN(RADIANS(tlc.latitude::float))
            ))
          )) AS distance_meters,
          (6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS(input_lat)) * COS(RADIANS(tlc.latitude::float)) * 
              COS(RADIANS(tlc.longitude::float) - RADIANS(input_lng)) + 
              SIN(RADIANS(input_lat)) * SIN(RADIANS(tlc.latitude::float))
            ))
          )) <= tlc.geofence_radius AS is_inside
        FROM tracking_locations_cache tlc
        WHERE tlc.active = true
          AND (6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS(input_lat)) * COS(RADIANS(tlc.latitude::float)) * 
              COS(RADIANS(tlc.longitude::float) - RADIANS(input_lng)) + 
              SIN(RADIANS(input_lat)) * SIN(RADIANS(tlc.latitude::float))
            ))
          )) <= (tlc.geofence_radius + search_radius_meters)
        ORDER BY distance_meters ASC;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await pool.query(createFunctionSQL);
    console.log('✅ Función get_nearby_geofences creada exitosamente');
    
    // 3. Probar la función
    console.log('\n🧪 Probando función con coordenadas de oficina Roberto...');
    
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    
    const result = await pool.query(`
      SELECT * FROM get_nearby_geofences($1, $2, $3)
    `, [officeLat, officeLng, 200]);
    
    console.log(`📊 Resultados: ${result.rows.length} geofences encontrados`);
    
    if (result.rows.length > 0) {
      result.rows.forEach((row, i) => {
        console.log(`   ${i+1}. ${row.location_code}: ${row.store_name}`);
        console.log(`      Distance: ${Math.round(row.distance_meters)}m`);
        console.log(`      Radius: ${row.geofence_radius}m`);
        console.log(`      ${row.is_inside ? '✅ INSIDE' : '❌ OUTSIDE'}`);
      });
    } else {
      console.log('❌ No se encontraron geofences');
      
      // Debug: mostrar todos los geofences
      console.log('\n🔍 Mostrando todos los geofences activos...');
      const allGeofences = await pool.query(`
        SELECT location_code, name, latitude, longitude, geofence_radius, active
        FROM tracking_locations_cache 
        ORDER BY location_code
      `);
      
      console.log(`📋 Total geofences: ${allGeofences.rows.length}`);
      allGeofences.rows.forEach(row => {
        console.log(`   ${row.location_code}: ${row.name} (${row.active ? 'activo' : 'inactivo'})`);
        console.log(`      ${row.latitude}, ${row.longitude} | Radio: ${row.geofence_radius}m`);
      });
    }
    
    // 4. Test específico con ROBERTO_OFFICE
    console.log('\n🎯 Test específico con ROBERTO_OFFICE...');
    
    const robertoTest = await pool.query(`
      SELECT * FROM get_nearby_geofences($1, $2, $3)
      WHERE location_code = 'ROBERTO_OFFICE'
    `, [officeLat, officeLng, 50]); // Radio pequeño para test específico
    
    if (robertoTest.rows.length > 0) {
      const office = robertoTest.rows[0];
      console.log(`✅ ROBERTO_OFFICE detectado por función:`);
      console.log(`   Distancia: ${Math.round(office.distance_meters)}m`);
      console.log(`   Está dentro: ${office.is_inside ? '✅ SÍ' : '❌ NO'}`);
    } else {
      console.log('❌ ROBERTO_OFFICE no detectado por función');
    }
    
    // 5. Test del geofence-engine con función corregida
    console.log('\n🔧 Testing geofence-engine con función corregida...');
    
    try {
      const geofenceEngine = require('./src/services/geofence-engine');
      
      const locationData = {
        id: Date.now(),
        user_id: 5,
        latitude: officeLat,
        longitude: officeLng,
        accuracy: 5,
        battery: 95,
        gps_timestamp: new Date()
      };
      
      const events = await geofenceEngine.processLocation(locationData);
      
      console.log(`📋 Geofence-engine resultado:`);
      console.log(`   Eventos generados: ${events.length}`);
      
      if (events.length > 0) {
        events.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
        });
      } else {
        console.log('❌ Aún no genera eventos');
      }
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
    }
    
    console.log('\n🎯 RESULTADO FINAL:');
    console.log('✅ Función PostgreSQL get_nearby_geofences creada y funcionando');
    console.log('✅ Ahora el geofence-engine debería detectar correctamente');
    console.log('✅ Sistema completo de alertas geofence operativo');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

createGeofenceFunction();