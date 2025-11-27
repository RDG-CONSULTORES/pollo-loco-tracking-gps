require('dotenv').config();
const { Pool } = require('pg');

async function checkRobertoGPS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📍 VERIFICANDO GPS DE ROBERTO01\n');
    
    // Buscar datos de ROBERTO01
    const result = await pool.query(`
      SELECT 
        id, latitude, longitude, accuracy, battery_level, 
        gps_timestamp, protocol, created_at
      FROM gps_locations 
      WHERE tracker_id = 'ROBERTO01' OR user_id = (
        SELECT id FROM tracking_users WHERE tracker_id = 'ROBERTO01'
      )
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ NO HAY DATOS de ROBERTO01 aún');
      console.log('\n🔧 VERIFICA:');
      console.log('1. Abre Traccar Client en tu iPhone');
      console.log('2. Ve a Settings');
      console.log('3. Configura:');
      console.log('   Server URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar');
      console.log('   Device ID: ROBERTO01');
      console.log('4. Activa el tracking');
      console.log('5. Espera 1 minuto y vuelve a ejecutar este script');
    } else {
      console.log(`✅ ENCONTRADOS ${result.rows.length} registros de ROBERTO01:`);
      
      result.rows.forEach((row, i) => {
        console.log(`\n📍 Registro ${i + 1}:`);
        console.log(`   Ubicación: ${row.latitude}, ${row.longitude}`);
        console.log(`   Precisión: ${row.accuracy}m`);
        console.log(`   Batería: ${row.battery_level || 'N/A'}%`);
        console.log(`   Protocolo: ${row.protocol}`);
        console.log(`   Timestamp GPS: ${row.gps_timestamp}`);
        console.log(`   Recibido: ${row.created_at}`);
      });
      
      const latest = result.rows[0];
      const ageMinutes = (new Date() - new Date(latest.created_at)) / (1000 * 60);
      
      console.log(`\n⏰ Último dato hace: ${Math.round(ageMinutes)} minutos`);
      
      if (ageMinutes < 5) {
        console.log('🎉 ¡GPS FUNCIONANDO EN TIEMPO REAL!');
      } else {
        console.log('⚠️ GPS no está enviando datos recientes');
      }
    }
    
    // Verificar user en BD
    const userCheck = await pool.query(`
      SELECT id, tracker_id, display_name, active 
      FROM tracking_users 
      WHERE tracker_id = 'ROBERTO01'
    `);
    
    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log(`\n👤 Usuario: ${user.display_name} (ID: ${user.id})`);
      console.log(`   Tracker ID: ${user.tracker_id}`);
      console.log(`   Estado: ${user.active ? 'Activo' : 'Inactivo'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRobertoGPS();