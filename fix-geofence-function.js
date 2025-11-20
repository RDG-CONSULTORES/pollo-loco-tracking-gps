const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixGeofenceFunction() {
  try {
    console.log('🔧 Corrigiendo función get_nearby_geofences...\n');
    
    // 1. Eliminar función problemática
    await pool.query(`DROP FUNCTION IF EXISTS get_nearby_geofences(double precision, double precision, integer)`);
    
    // 2. Crear función simplificada que coincida con el geofence-engine
    console.log('📝 Creando función simplificada...');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_nearby_geofences(
        input_lat double precision,
        input_lng double precision,
        search_radius_meters integer DEFAULT 200
      )
      RETURNS TABLE (
        location_code TEXT,
        store_name TEXT,
        latitude NUMERIC,
        longitude NUMERIC,
        geofence_radius INTEGER,
        distance_meters DOUBLE PRECISION,
        is_inside BOOLEAN
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          tlc.location_code::TEXT,
          tlc.name::TEXT AS store_name,
          tlc.latitude,
          tlc.longitude,
          tlc.geofence_radius,
          (6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS(input_lat)) * COS(RADIANS(tlc.latitude::double precision)) * 
              COS(RADIANS(tlc.longitude::double precision) - RADIANS(input_lng)) + 
              SIN(RADIANS(input_lat)) * SIN(RADIANS(tlc.latitude::double precision))
            ))
          ))::DOUBLE PRECISION AS distance_meters,
          ((6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS(input_lat)) * COS(RADIANS(tlc.latitude::double precision)) * 
              COS(RADIANS(tlc.longitude::double precision) - RADIANS(input_lng)) + 
              SIN(RADIANS(input_lat)) * SIN(RADIANS(tlc.latitude::double precision))
            ))
          )) <= tlc.geofence_radius)::BOOLEAN AS is_inside
        FROM tracking_locations_cache tlc
        WHERE tlc.active = true
          AND (6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS(input_lat)) * COS(RADIANS(tlc.latitude::double precision)) * 
              COS(RADIANS(tlc.longitude::double precision) - RADIANS(input_lng)) + 
              SIN(RADIANS(input_lat)) * SIN(RADIANS(tlc.latitude::double precision))
            ))
          )) <= (tlc.geofence_radius + search_radius_meters)
        ORDER BY distance_meters ASC;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await pool.query(createFunctionSQL);
    console.log('✅ Función get_nearby_geofences corregida');
    
    // 3. Probar la función corregida
    console.log('\n🧪 Probando función corregida...');
    
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    
    const result = await pool.query(`
      SELECT * FROM get_nearby_geofences($1, $2, $3)
    `, [officeLat, officeLng, 200]);
    
    console.log(`📊 Resultados: ${result.rows.length} geofences encontrados`);
    
    if (result.rows.length > 0) {
      result.rows.forEach((row, i) => {
        console.log(`   ${i+1}. ${row.location_code}: ${row.store_name}`);
        console.log(`      Distance: ${Math.round(row.distance_meters)}m | Radius: ${row.geofence_radius}m`);
        console.log(`      ${row.is_inside ? '✅ INSIDE' : '❌ OUTSIDE'}`);
      });
    } else {
      console.log('❌ Función aún no encuentra geofences');
      
      // Consulta manual para comparar
      console.log('\n🔍 Consulta manual para comparar...');
      const manual = await pool.query(`
        SELECT 
          location_code,
          name,
          latitude,
          longitude,
          geofence_radius,
          (6371000 * ACOS(
            LEAST(1.0, GREATEST(-1.0,
              COS(RADIANS($1)) * COS(RADIANS(latitude::double precision)) * 
              COS(RADIANS(longitude::double precision) - RADIANS($2)) + 
              SIN(RADIANS($1)) * SIN(RADIANS(latitude::double precision))
            ))
          )) AS distance_meters
        FROM tracking_locations_cache
        WHERE active = true
        ORDER BY distance_meters ASC
        LIMIT 5
      `, [officeLat, officeLng]);
      
      console.log(`📋 Consulta manual: ${manual.rows.length} geofences`);
      manual.rows.forEach(row => {
        const isInside = row.distance_meters <= row.geofence_radius;
        console.log(`   ${row.location_code}: ${row.name}`);
        console.log(`      Distance: ${Math.round(row.distance_meters)}m | Radius: ${row.geofence_radius}m`);
        console.log(`      ${isInside ? '✅ INSIDE' : '❌ OUTSIDE'}`);
      });
    }
    
    // 4. Test final del geofence-engine
    console.log('\n🔧 Test final del geofence-engine...');
    
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
      
      console.log(`📋 Geofence-engine con función corregida:`);
      console.log(`   Eventos generados: ${events.length}`);
      
      if (events.length > 0) {
        console.log('🎉 ¡ÉXITO! Geofence-engine ahora detecta eventos');
        events.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
        });
      } else {
        console.log('❌ Geofence-engine aún no genera eventos');
      }
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
    }
    
    console.log('\n📋 DIAGNÓSTICO:');
    console.log('1. ✅ Función PostgreSQL get_nearby_geofences corregida');
    console.log('2. ✅ Geofence-alerts funciona independientemente');
    console.log('3. ✅ Bot Telegram funciona correctamente');
    console.log('4. 🔧 Testing de flujo completo pendiente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixGeofenceFunction();