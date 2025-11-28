/**
 * Crear datos demo para mostrar historial de entradas/salidas
 */

require('dotenv').config();
const { Pool } = require('pg');

async function createDemoData() {
  console.log('🎭 CREANDO DATOS DEMO PARA HISTORIAL DE ENTRADAS/SALIDAS\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // 1. Crear sucursales demo
    console.log('1️⃣ Creando sucursales demo...');
    
    const sucursales = [
      { 
        code: 'SUC001', 
        name: 'Pollo Loco Polanco', 
        lat: 19.4326, 
        lng: -99.1332,
        address: 'Av. Presidente Masaryk 101, Polanco',
        radius: 100 
      },
      { 
        code: 'SUC002', 
        name: 'Pollo Loco Roma Norte', 
        lat: 19.4284, 
        lng: -99.1676,
        address: 'Av. Álvaro Obregón 286, Roma Norte',
        radius: 80 
      },
      { 
        code: 'SUC003', 
        name: 'Pollo Loco Condesa', 
        lat: 19.4147, 
        lng: -99.1722,
        address: 'Av. Michoacán 78, Condesa',
        radius: 90 
      },
      { 
        code: 'SUC004', 
        name: 'Pollo Loco Santa Fe', 
        lat: 19.3593, 
        lng: -99.2576,
        address: 'Centro Santa Fe, Cuajimalpa',
        radius: 120 
      },
      { 
        code: 'SUC005', 
        name: 'Pollo Loco Insurgentes', 
        lat: 19.4230, 
        lng: -99.1677,
        address: 'Av. Insurgentes Sur 1235',
        radius: 85 
      }
    ];
    
    for (const sucursal of sucursales) {
      await pool.query(`
        INSERT INTO tracking_locations_cache (
          location_code, name, latitude, longitude, 
          geofence_radius, geofence_enabled, active,
          address, group_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, true, true, $6, 'CDMX_NORTE', NOW())
        ON CONFLICT (location_code) 
        DO UPDATE SET 
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          name = EXCLUDED.name
      `, [sucursal.code, sucursal.name, sucursal.lat, sucursal.lng, sucursal.radius, sucursal.address]);
      
      console.log(`   ✅ ${sucursal.name} creada`);
    }
    
    // 2. Crear usuarios demo
    console.log('\n2️⃣ Creando usuarios demo...');
    
    const usuarios = [
      { tracker_id: 'DEMO001', name: 'María González', role: 'Gerente', email: 'maria.gonzalez@polloloco.com' },
      { tracker_id: 'DEMO002', name: 'Carlos Rodríguez', role: 'Supervisor', email: 'carlos.rodriguez@polloloco.com' },
      { tracker_id: 'DEMO003', name: 'Ana Martínez', role: 'Empleado', email: 'ana.martinez@polloloco.com' },
      { tracker_id: 'DEMO004', name: 'Luis Hernández', role: 'Delivery', email: 'luis.hernandez@polloloco.com' },
      { tracker_id: 'DEMO005', name: 'Sofia Ramírez', role: 'Cajera', email: 'sofia.ramirez@polloloco.com' }
    ];
    
    for (const usuario of usuarios) {
      await pool.query(`
        INSERT INTO tracking_users (
          tracker_id, display_name, role, zenput_email, 
          active, group_name, created_at
        ) VALUES ($1, $2, $3, $4, true, 'CDMX_NORTE', NOW())
        ON CONFLICT (tracker_id) 
        DO UPDATE SET 
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role
      `, [usuario.tracker_id, usuario.name, usuario.role, usuario.email]);
      
      console.log(`   ✅ ${usuario.name} (${usuario.tracker_id}) creado`);
    }
    
    // 3. Crear eventos de entrada/salida demo (últimos 3 días)
    console.log('\n3️⃣ Creando historial de entradas/salidas demo...');
    
    const now = new Date();
    let eventCount = 0;
    
    // Crear eventos para cada usuario en diferentes sucursales
    for (let day = 2; day >= 0; day--) {
      const date = new Date(now);
      date.setDate(date.getDate() - day);
      
      for (const usuario of usuarios) {
        // 2-3 eventos por usuario por día
        const eventsPerDay = Math.floor(Math.random() * 2) + 2;
        
        for (let event = 0; event < eventsPerDay; event++) {
          const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];
          const eventTime = new Date(date);
          eventTime.setHours(8 + Math.floor(Math.random() * 10)); // Entre 8 AM y 6 PM
          eventTime.setMinutes(Math.floor(Math.random() * 60));
          
          const eventType = Math.random() > 0.5 ? 'entry' : 'exit';
          
          // Obtener user_id
          const userResult = await pool.query('SELECT id FROM tracking_users WHERE tracker_id = $1', [usuario.tracker_id]);
          if (userResult.rows.length === 0) continue;
          
          const userId = userResult.rows[0].id;
          
          await pool.query(`
            INSERT INTO geofence_events (
              user_id, user_tracker_id, event_type, 
              location_name, latitude, longitude,
              event_time, telegram_sent, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
          `, [
            userId, usuario.tracker_id, eventType, sucursal.name,
            sucursal.lat + (Math.random() - 0.5) * 0.001, // Pequeña variación
            sucursal.lng + (Math.random() - 0.5) * 0.001,
            eventTime
          ]);
          
          eventCount++;
        }
      }
    }
    
    console.log(`   ✅ ${eventCount} eventos de entrada/salida creados`);
    
    // 4. Crear algunas ubicaciones GPS recientes
    console.log('\n4️⃣ Creando ubicaciones GPS recientes...');
    
    for (const usuario of usuarios) {
      const userResult = await pool.query('SELECT id FROM tracking_users WHERE tracker_id = $1', [usuario.tracker_id]);
      if (userResult.rows.length === 0) continue;
      
      const userId = userResult.rows[0].id;
      const sucursal = sucursales[Math.floor(Math.random() * sucursales.length)];
      
      // Ubicación reciente (última hora)
      const recentTime = new Date();
      recentTime.setMinutes(recentTime.getMinutes() - Math.floor(Math.random() * 60));
      
      await pool.query(`
        INSERT INTO gps_locations (
          user_id, latitude, longitude, accuracy, 
          battery_level, timestamp, protocol, created_at
        ) VALUES ($1, $2, $3, 5, $4, $5, 'demo', NOW())
      `, [
        userId,
        sucursal.lat + (Math.random() - 0.5) * 0.001,
        sucursal.lng + (Math.random() - 0.5) * 0.001,
        80 + Math.floor(Math.random() * 20), // Batería 80-100%
        recentTime
      ]);
    }
    
    console.log(`   ✅ ${usuarios.length} ubicaciones GPS recientes creadas`);
    
    console.log('\n🎉 ¡DATOS DEMO CREADOS EXITOSAMENTE!');
    console.log('\n📊 RESUMEN:');
    console.log(`   🏢 5 sucursales demo en CDMX`);
    console.log(`   👥 5 usuarios demo con roles diferentes`);
    console.log(`   🚪 ${eventCount} eventos de entrada/salida (últimos 3 días)`);
    console.log(`   📍 5 ubicaciones GPS recientes`);
    
    console.log('\n🔗 DASHBOARDS PARA VER LOS DATOS:');
    console.log('   📊 Admin Panel: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/admin.html');
    console.log('   📱 Mobile: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/admin-mobile.html');
    console.log('   🗺️ Mapa: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

createDemoData().then(success => {
  if (success) {
    console.log('\n✅ Demo data ready! Abre los dashboards para ver el historial.');
  }
}).catch(console.error);