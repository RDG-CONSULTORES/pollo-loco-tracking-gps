require('dotenv').config();
const { Pool } = require('pg');

async function checkLatestData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📍 VERIFICANDO DATOS REALES EN BD\n');
    
    // Ver los últimos 10 registros de gps_locations
    console.log('🔍 ÚLTIMOS 10 REGISTROS EN gps_locations:');
    const recent = await pool.query(`
      SELECT 
        id, tracker_id, user_id, latitude, longitude, 
        timestamp, battery_level, created_at
      FROM gps_locations 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (recent.rows.length === 0) {
      console.log('   ❌ NO HAY REGISTROS en gps_locations');
    } else {
      recent.rows.forEach((row, i) => {
        console.log(`   ${i+1}. ID: ${row.id}`);
        console.log(`      Tracker: ${row.tracker_id}`);
        console.log(`      User ID: ${row.user_id}`);
        console.log(`      Ubicación: ${row.latitude}, ${row.longitude}`);
        console.log(`      Timestamp: ${row.timestamp}`);
        console.log(`      Creado: ${row.created_at}`);
        console.log(`      Batería: ${row.battery_level}%`);
        console.log('');
      });
    }
    
    // Buscar específicamente RD01
    console.log('🎯 DATOS ESPECÍFICOS DE RD01:');
    const rd01Data = await pool.query(`
      SELECT * FROM gps_locations 
      WHERE tracker_id LIKE '%rd01%' OR tracker_id LIKE '%RD01%'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (rd01Data.rows.length === 0) {
      console.log('   ❌ NO HAY DATOS de RD01 en gps_locations');
      
      // Buscar por user_id en vez de tracker_id
      const userSearch = await pool.query(`
        SELECT gl.*, tu.tracker_id as real_tracker_id, tu.display_name
        FROM gps_locations gl
        JOIN tracking_users tu ON gl.user_id = tu.id
        WHERE tu.tracker_id = 'RD01'
        ORDER BY gl.created_at DESC
        LIMIT 3
      `);
      
      if (userSearch.rows.length > 0) {
        console.log('   🔍 ENCONTRADOS por JOIN con tracking_users:');
        userSearch.rows.forEach((row, i) => {
          console.log(`      ${i+1}. ${row.display_name} (${row.real_tracker_id})`);
          console.log(`         UUID: ${row.tracker_id}`);
          console.log(`         Ubicación: ${row.latitude}, ${row.longitude}`);
          console.log(`         Creado: ${row.created_at}`);
        });
      }
    } else {
      console.log(`   ✅ ENCONTRADOS ${rd01Data.rows.length} registros de RD01:`);
      rd01Data.rows.forEach((row, i) => {
        console.log(`      ${i+1}. UUID: ${row.tracker_id}`);
        console.log(`         Ubicación: ${row.latitude}, ${row.longitude}`);
        console.log(`         Timestamp: ${row.timestamp}`);
        console.log(`         Creado: ${row.created_at}`);
      });
    }
    
    // Ver cuándo fue el último insert
    const lastInsert = await pool.query(`
      SELECT created_at, COUNT(*) as total
      FROM gps_locations 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY created_at
      ORDER BY created_at DESC
    `);
    
    console.log('\n⏰ ACTIVIDAD EN LA ÚLTIMA HORA:');
    if (lastInsert.rows.length === 0) {
      console.log('   ❌ NO HAY ACTIVIDAD en la última hora');
    } else {
      console.log(`   ✅ ${lastInsert.rows.length} timestamps con datos nuevos`);
      lastInsert.rows.slice(0, 5).forEach((row) => {
        console.log(`      ${row.created_at}: ${row.total} registros`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLatestData();