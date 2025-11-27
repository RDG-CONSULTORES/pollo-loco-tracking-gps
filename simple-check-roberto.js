require('dotenv').config();
const { Pool } = require('pg');

async function simpleCheck() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📍 VERIFICANDO GPS DE ROBERTO01\n');
    
    // Buscar user_id primero
    const userResult = await pool.query(`
      SELECT id, tracker_id, display_name 
      FROM tracking_users 
      WHERE tracker_id = 'ROBERTO01'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuario ROBERTO01 no encontrado en tracking_users');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`👤 Usuario encontrado: ${userResult.rows[0].display_name} (ID: ${userId})`);
    
    // Buscar datos GPS por user_id
    const result = await pool.query(`
      SELECT * 
      FROM gps_locations 
      WHERE user_id = $1
      ORDER BY created_at DESC 
      LIMIT 3
    `, [userId]);
    
    if (result.rows.length === 0) {
      console.log('❌ NO HAY DATOS de ROBERTO01 aún');
      console.log('\n📱 CONFIGURA EN TU IPHONE:');
      console.log('1. Abre Traccar Client');
      console.log('2. Settings > Server URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar');
      console.log('3. Device ID: ROBERTO01');
      console.log('4. Activa tracking y espera 2 minutos');
    } else {
      console.log(`✅ ENCONTRADOS ${result.rows.length} registros:`);
      
      result.rows.forEach((row, i) => {
        console.log(`\n📍 Registro ${i + 1}:`);
        console.log(`   ID: ${row.id}`);
        console.log(`   User ID: ${row.user_id}`);
        console.log(`   Tracker ID: ${row.tracker_id}`);
        console.log(`   Ubicación: ${row.latitude}, ${row.longitude}`);
        console.log(`   Precisión: ${row.accuracy}m`);
        console.log(`   Protocolo: ${row.protocol || 'owntracks'}`);
        console.log(`   Recibido: ${row.created_at}`);
      });
      
      console.log('\n🎉 ¡TRACCAR FUNCIONANDO!');
    }
    
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

simpleCheck();