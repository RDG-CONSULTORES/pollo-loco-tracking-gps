const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testRobertoAlerts() {
  try {
    console.log('🔍 Verificando configuración de alertas para Roberto...\n');
    
    // 1. Verificar oficina configurada
    const officeResult = await pool.query(`
      SELECT * FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    console.log('🏢 Oficina configurada:', officeResult.rows.length > 0 ? '✅ SÍ' : '❌ NO');
    if (officeResult.rows.length > 0) {
      const office = officeResult.rows[0];
      console.log(`   Nombre: ${office.name}`);
      console.log(`   Coordenadas: ${office.latitude}, ${office.longitude}`);
      console.log(`   Radio: ${office.geofence_radius}m`);
      console.log(`   Activa: ${office.active ? '✅' : '❌'}`);
    }
    
    // 2. Verificar usuarios activos de Roberto
    console.log('\n👤 Usuarios GPS de Roberto:');
    const usersResult = await pool.query(`
      SELECT id, tracker_id, display_name, zenput_email, active
      FROM tracking_users 
      WHERE tracker_id ILIKE '%roberto%' OR display_name ILIKE '%roberto%'
      ORDER BY id
    `);
    
    usersResult.rows.forEach(user => {
      console.log(`   ${user.active ? '✅' : '❌'} ID:${user.id} | ${user.tracker_id} | ${user.display_name}`);
    });
    
    // 3. Verificar últimas ubicaciones GPS
    console.log('\n📍 Últimas ubicaciones GPS:');
    const locationsResult = await pool.query(`
      SELECT 
        tl.user_id,
        tu.tracker_id,
        tu.display_name,
        tl.latitude,
        tl.longitude,
        tl.accuracy,
        tl.battery,
        tl.gps_timestamp
      FROM tracking_locations tl
      JOIN tracking_users tu ON tl.user_id = tu.id
      WHERE tu.tracker_id ILIKE '%roberto%' OR tu.display_name ILIKE '%roberto%'
      ORDER BY tl.gps_timestamp DESC
      LIMIT 5
    `);
    
    if (locationsResult.rows.length > 0) {
      locationsResult.rows.forEach(loc => {
        console.log(`   📍 ${loc.display_name} (${loc.tracker_id}): ${loc.latitude}, ${loc.longitude}`);
        console.log(`      🕒 ${loc.gps_timestamp} | 🔋 ${loc.battery}% | 📏 ${loc.accuracy}m`);
      });
    } else {
      console.log('   ⚠️ No hay ubicaciones GPS recientes');
    }
    
    // 4. Verificar configuración Telegram
    console.log('\n🤖 Configuración Telegram:');
    console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
    console.log(`   Admin IDs: ${process.env.TELEGRAM_ADMIN_IDS}`);
    
    // 5. Verificar eventos de geofence recientes
    console.log('\n🎯 Eventos geofence recientes:');
    const eventsResult = await pool.query(`
      SELECT 
        ge.event_type,
        ge.location_code,
        ge.event_timestamp,
        ge.telegram_sent,
        tu.display_name,
        tu.tracker_id
      FROM geofence_events ge
      JOIN tracking_users tu ON ge.user_id = tu.id
      WHERE ge.location_code = 'ROBERTO_OFFICE'
      ORDER BY ge.event_timestamp DESC
      LIMIT 10
    `);
    
    if (eventsResult.rows.length > 0) {
      eventsResult.rows.forEach(event => {
        console.log(`   ${event.event_type === 'entry' ? '🟢' : '🔴'} ${event.event_type.toUpperCase()}: ${event.display_name} | ${event.event_timestamp} | Telegram: ${event.telegram_sent ? '✅' : '❌'}`);
      });
    } else {
      console.log('   📭 No hay eventos recientes');
    }
    
    // 6. Simular entrada a oficina (para testing)
    console.log('\n🧪 ¿Quieres simular una entrada a tu oficina para testing? (Presiona Ctrl+C para cancelar)');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔄 Simulando entrada a oficina...');
    
    // Usar el primer usuario activo de Roberto
    const activeUser = usersResult.rows.find(u => u.active);
    if (activeUser) {
      // Crear ubicación justo dentro de la oficina
      const testLat = 25.650648;
      const testLng = -100.373529;
      
      console.log(`📍 Simulando GPS: ${activeUser.display_name} @ ${testLat}, ${testLng}`);
      
      // Insertar ubicación de prueba
      const testLocationResult = await pool.query(`
        INSERT INTO tracking_locations (
          user_id,
          zenput_email,
          latitude,
          longitude,
          accuracy,
          battery,
          velocity,
          altitude,
          course,
          gps_timestamp,
          raw_payload
        ) VALUES ($1, $2, $3, $4, 5, 85, 0, 100, 0, NOW(), '{"test": true}')
        RETURNING id
      `, [activeUser.id, activeUser.zenput_email, testLat, testLng]);
      
      console.log(`✅ Ubicación de prueba creada: ID ${testLocationResult.rows[0].id}`);
      console.log('\n⚠️  NOTA: Esta es solo una prueba. El sistema real procesará ubicaciones de OwnTracks.');
      
    } else {
      console.log('❌ No hay usuarios activos para simular');
    }
    
    console.log('\n📱 Para testing real:');
    console.log('1. Abre OwnTracks en tu celular');
    console.log('2. Verifica que esté enviando datos');
    console.log('3. Camina hacia tu oficina');
    console.log('4. Verifica alertas Telegram');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testRobertoAlerts();