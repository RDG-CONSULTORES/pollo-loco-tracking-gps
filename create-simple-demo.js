/**
 * Crear datos demo simples para historial
 */

require('dotenv').config();
const { Pool } = require('pg');

async function createSimpleDemo() {
  console.log('🎭 CREANDO DATOS DEMO PARA HISTORIAL\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // 1. Verificar tu usuario actual
    console.log('1️⃣ Verificando usuario ROBERTO01...');
    const userResult = await pool.query('SELECT id FROM tracking_users WHERE tracker_id = $1', ['ROBERTO01']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuario ROBERTO01 no encontrado');
      return false;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`   ✅ Usuario encontrado (ID: ${userId})`);
    
    // 2. Crear algunos eventos demo para Roberto
    console.log('\n2️⃣ Creando eventos demo para ROBERTO01...');
    
    const eventos = [
      {
        type: 'entry',
        location: 'Pollo Loco Polanco',
        lat: 19.4326,
        lng: -99.1332,
        time: new Date(Date.now() - 2 * 60 * 60 * 1000) // Hace 2 horas
      },
      {
        type: 'exit', 
        location: 'Pollo Loco Polanco',
        lat: 19.4326,
        lng: -99.1332,
        time: new Date(Date.now() - 1 * 60 * 60 * 1000) // Hace 1 hora
      },
      {
        type: 'entry',
        location: 'Pollo Loco Roma Norte', 
        lat: 19.4284,
        lng: -99.1676,
        time: new Date(Date.now() - 30 * 60 * 1000) // Hace 30 minutos
      }
    ];
    
    for (const evento of eventos) {
      await pool.query(`
        INSERT INTO geofence_events (
          user_id, user_tracker_id, event_type,
          location_name, latitude, longitude,
          event_time, telegram_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [
        userId, 'ROBERTO01', evento.type,
        evento.location, evento.lat, evento.lng,
        evento.time
      ]);
      
      console.log(`   ✅ ${evento.type.toUpperCase()} en ${evento.location} - ${evento.time.toLocaleTimeString()}`);
    }
    
    console.log('\n🎉 ¡EVENTOS DEMO CREADOS!');
    
    // 3. Verificar eventos creados
    console.log('\n3️⃣ Verificando eventos creados...');
    const events = await pool.query(`
      SELECT event_type, location_name, event_time
      FROM geofence_events 
      WHERE user_tracker_id = 'ROBERTO01'
      ORDER BY event_time DESC
      LIMIT 10
    `);
    
    console.log('📋 HISTORIAL DE EVENTOS:');
    events.rows.forEach((event, index) => {
      const time = new Date(event.event_time).toLocaleString();
      const icon = event.event_type === 'entry' ? '🟢 ENTRADA' : '🔴 SALIDA';
      console.log(`   ${index + 1}. ${icon} - ${event.location_name} - ${time}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

createSimpleDemo().then(success => {
  if (success) {
    console.log('\n🔗 VE TU HISTORIAL EN:');
    console.log('📊 https://pollo-loco-tracking-gps-production.up.railway.app/webapp/admin.html');
    console.log('📱 https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
  }
}).catch(console.error);