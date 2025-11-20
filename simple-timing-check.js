const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function simpleTimingCheck() {
  try {
    console.log('📱 INTERVALOS OWNTRACK Y CONFIGURACIÓN GEOFENCE\n');
    
    // 1. Analizar tus ubicaciones GPS recientes para ver intervalos reales
    console.log('📍 Análisis de tus ubicaciones GPS recientes:');
    
    const recentLocations = await pool.query(`
      SELECT 
        latitude, longitude, accuracy, battery, gps_timestamp,
        LAG(gps_timestamp) OVER (ORDER BY gps_timestamp) as prev_timestamp,
        EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (ORDER BY gps_timestamp))) as interval_seconds
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp > NOW() - INTERVAL '3 hours'
      ORDER BY gps_timestamp DESC
      LIMIT 15
    `);
    
    console.log(`📊 Últimas ${recentLocations.rows.length} ubicaciones GPS:`);
    
    let totalInterval = 0;
    let intervalCount = 0;
    const intervals = [];
    
    recentLocations.rows.forEach((loc, i) => {
      const timestamp = new Date(loc.gps_timestamp);
      const timeStr = timestamp.toLocaleTimeString('es-MX');
      const dateStr = timestamp.toLocaleDateString('es-MX');
      
      console.log(`   ${i+1}. ${dateStr} ${timeStr}`);
      console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
      console.log(`      🎯 Accuracy: ${loc.accuracy}m | 🔋 Battery: ${loc.battery}%`);
      
      if (loc.interval_seconds && loc.interval_seconds > 0 && loc.interval_seconds < 3600) {
        const minutes = Math.round(loc.interval_seconds / 60 * 10) / 10;
        console.log(`      ⏱️ Intervalo desde anterior: ${minutes} minutos`);
        totalInterval += loc.interval_seconds;
        intervalCount++;
        intervals.push(minutes);
      }
      console.log('');
    });
    
    if (intervalCount > 0) {
      const avgInterval = (totalInterval / intervalCount) / 60;
      const minInterval = Math.min(...intervals);
      const maxInterval = Math.max(...intervals);
      
      console.log(`📊 ESTADÍSTICAS DE INTERVALOS OWNTRACK:`);
      console.log(`   ⏱️ Intervalo promedio: ${Math.round(avgInterval * 10) / 10} minutos`);
      console.log(`   ⚡ Intervalo mínimo: ${minInterval} minutos`);
      console.log(`   🐌 Intervalo máximo: ${maxInterval} minutos`);
      console.log(`   📈 Total muestras: ${intervalCount} intervalos`);
    }
    
    // 2. Configuración de tu oficina
    console.log('\n🏢 CONFIGURACIÓN DE TU OFICINA:');
    
    const office = await pool.query(`
      SELECT 
        location_code, name, latitude, longitude, 
        geofence_radius, active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (office.rows.length > 0) {
      const off = office.rows[0];
      console.log(`   🏢 Nombre: ${off.name}`);
      console.log(`   📍 Centro: ${off.latitude}, ${off.longitude}`);
      console.log(`   📏 Radio geofence: ${off.geofence_radius} metros`);
      console.log(`   🟢 Estado: ${off.active ? 'Activo ✅' : 'Inactivo ❌'}`);
      
      // Calcular tu distancia actual
      if (recentLocations.rows.length > 0) {
        const lastLoc = recentLocations.rows[0];
        const distance = calculateDistance(
          parseFloat(lastLoc.latitude),
          parseFloat(lastLoc.longitude),
          parseFloat(off.latitude),
          parseFloat(off.longitude)
        );
        
        const isInside = distance <= off.geofence_radius;
        console.log(`   📏 Tu distancia actual: ${Math.round(distance)}m del centro`);
        console.log(`   🎯 Estado actual: ${isInside ? '🟢 DENTRO del geofence' : '🔴 FUERA del geofence'}`);
        
        if (!isInside) {
          const needToWalk = Math.round(distance - off.geofence_radius);
          console.log(`   🚶‍♂️ Para entrar: Acércate ${needToWalk}m más al centro`);
        } else {
          const needToWalk = Math.round(off.geofence_radius - distance + 5); // +5m para estar seguro
          console.log(`   🚶‍♂️ Para salir: Aléjate ${needToWalk}m más del centro`);
        }
      }
    }
    
    // 3. Ver eventos geofence recientes
    console.log('\n📋 TUS EVENTOS GEOFENCE RECIENTES:');
    
    const recentEvents = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center,
        telegram_sent, telegram_sent_at
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY event_timestamp DESC
      LIMIT 10
    `);
    
    if (recentEvents.rows.length > 0) {
      console.log(`📊 Últimos ${recentEvents.rows.length} eventos:`);
      recentEvents.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleTimeString('es-MX');
        const dateStr = eventTime.toLocaleDateString('es-MX');
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${icon} ${dateStr} ${timeStr} - ${action}`);
        console.log(`      📍 ${event.latitude}, ${event.longitude}`);
        console.log(`      📏 Distancia: ${event.distance_from_center}m del centro`);
        
        if (event.telegram_sent && event.telegram_sent_at) {
          const telegramTime = new Date(event.telegram_sent_at).toLocaleTimeString('es-MX');
          console.log(`      📱 Telegram: ✅ Enviado a las ${telegramTime}`);
        } else {
          console.log(`      📱 Telegram: ❌ No enviado`);
        }
        console.log('');
      });
    } else {
      console.log('❌ No hay eventos geofence en las últimas 24 horas');
    }
    
    // 4. Instrucciones específicas para pruebas
    console.log('\n🧪 INSTRUCCIONES PARA TUS PRUEBAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📱 CONFIGURACIÓN OWNTRACK:');
    console.log('   • Tracking ID: "01" ✅');
    console.log('   • Modo: HTTP POST to your server ✅');
    console.log('   • Intervalo típico: 1-5 minutos');
    console.log('   • Accuracy requerida: <100m (tu typical: 5-15m) ✅');
    console.log('');
    console.log('🎯 RADIO GEOFENCE: 20 metros');
    console.log('   📍 Centro: 25.650648, -100.373529');
    console.log('   🟢 ENTRADA: Cuando estés <20m del centro');
    console.log('   🔴 SALIDA: Cuando estés >20m del centro');
    console.log('');
    console.log('🚶‍♂️ SECUENCIA DE PRUEBA:');
    console.log('   1. Estar FUERA de la oficina (>25m del centro)');
    console.log('   2. 📱 Ver en dashboard que tu ubicación se actualiza');
    console.log('   3. 🚶‍♂️ Caminar DENTRO de la oficina (<15m del centro)');
    console.log('   4. ⏰ Esperar 1-5 minutos (para próximo envío OwnTracks)');
    console.log('   5. 📬 Recibir alerta ENTRADA en Telegram');
    console.log('   6. 🚶‍♂️ Caminar FUERA de la oficina (>25m del centro)');
    console.log('   7. ⏰ Esperar 1-5 minutos');
    console.log('   8. 📬 Recibir alerta SALIDA en Telegram');
    console.log('');
    console.log('⚡ PARA PRUEBAS MÁS RÁPIDAS:');
    console.log('   • Fuerza envío en OwnTracks (botón manual)');
    console.log('   • Muévete en línea recta (dentro ↔ fuera)');
    console.log('   • Verifica en dashboard que ubicación cambia');
    console.log('   • Alertas llegan inmediatamente después de GPS update');
    
    // 5. Estado actual del sistema
    console.log('\n🔧 ESTADO ACTUAL DEL SISTEMA:');
    
    const userState = await pool.query(`
      SELECT 
        uss.location_code, uss.is_inside, 
        uss.last_enter_time, uss.last_exit_time,
        uss.updated_at,
        tlc.name as store_name
      FROM user_sucursal_state uss
      JOIN tracking_locations_cache tlc ON uss.location_code = tlc.location_code
      WHERE uss.user_id = 5
      ORDER BY uss.updated_at DESC
    `);
    
    if (userState.rows.length > 0) {
      console.log('📊 Tu estado en geofences:');
      userState.rows.forEach((state, i) => {
        const icon = state.is_inside ? '🟢' : '🔴';
        const status = state.is_inside ? 'DENTRO' : 'FUERA';
        console.log(`   ${i+1}. ${icon} ${state.store_name}: ${status}`);
        
        if (state.last_enter_time) {
          console.log(`      ⬅️ Última entrada: ${new Date(state.last_enter_time).toLocaleString('es-MX')}`);
        }
        if (state.last_exit_time) {
          console.log(`      ➡️ Última salida: ${new Date(state.last_exit_time).toLocaleString('es-MX')}`);
        }
        console.log(`      🔄 Actualizado: ${new Date(state.updated_at).toLocaleString('es-MX')}`);
      });
    } else {
      console.log('ℹ️ No hay estado de geofence registrado (normal en primera prueba)');
    }
    
    console.log('\n🎯 TU PRÓXIMO PASO:');
    console.log('🚶‍♂️ Sal de tu oficina, camina >25m del centro, espera ver tu ubicación actualizada en dashboard, luego regresa.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

simpleTimingCheck();