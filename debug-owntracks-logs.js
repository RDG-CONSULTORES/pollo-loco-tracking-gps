const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugOwnTracksLogs() {
  try {
    console.log('🔍 ANÁLISIS COMPLETO DE LOGS OWNTRACKS - ROBERTO\n');
    
    const now = new Date();
    const last30Minutes = new Date(now.getTime() - 30 * 60 * 1000);
    
    // 1. Verificar ubicaciones GPS recientes
    console.log('📍 UBICACIONES GPS ÚLTIMOS 30 MINUTOS:');
    
    const recentLocations = await pool.query(`
      SELECT 
        id, latitude, longitude, accuracy, battery, velocity,
        gps_timestamp, raw_payload,
        LAG(latitude) OVER (ORDER BY gps_timestamp) as prev_lat,
        LAG(longitude) OVER (ORDER BY gps_timestamp) as prev_lng,
        LAG(gps_timestamp) OVER (ORDER BY gps_timestamp) as prev_timestamp
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp >= $1
      ORDER BY gps_timestamp DESC
      LIMIT 15
    `, [last30Minutes]);
    
    if (recentLocations.rows.length > 0) {
      console.log(`📊 ${recentLocations.rows.length} ubicaciones encontradas:`);
      
      recentLocations.rows.forEach((loc, i) => {
        const timestamp = new Date(loc.gps_timestamp);
        const timeStr = timestamp.toLocaleTimeString('es-MX');
        
        // Calcular distancia a oficina
        const officeLat = 25.650648;
        const officeLng = -100.373529;
        const distanceToOffice = calculateDistance(
          parseFloat(loc.latitude),
          parseFloat(loc.longitude),
          officeLat,
          officeLng
        );
        
        const isInside = distanceToOffice <= 15;
        const status = isInside ? '🟢 DENTRO' : '🔴 FUERA';
        
        // Calcular intervalo desde anterior
        let intervalText = '';
        if (loc.prev_timestamp) {
          const intervalMs = timestamp - new Date(loc.prev_timestamp);
          const intervalMin = Math.round(intervalMs / 60000 * 10) / 10;
          intervalText = `(+${intervalMin}min)`;
        }
        
        // Calcular movimiento desde anterior
        let movementText = '';
        if (loc.prev_lat && loc.prev_lng) {
          const movement = calculateDistance(
            parseFloat(loc.prev_lat),
            parseFloat(loc.prev_lng),
            parseFloat(loc.latitude),
            parseFloat(loc.longitude)
          );
          movementText = `📏 ${Math.round(movement)}m moved`;
        }
        
        console.log(`   ${i+1}. ${timeStr} ${intervalText} - ${status}`);
        console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`      📏 ${Math.round(distanceToOffice)}m de oficina | Acc: ${loc.accuracy}m | Bat: ${loc.battery}%`);
        if (movementText) console.log(`      ${movementText}`);
        
        // Analizar payload raw si existe
        if (loc.raw_payload) {
          try {
            const payload = JSON.parse(loc.raw_payload);
            console.log(`      📱 OwnTracks: tid=${payload.tid}, tst=${payload.tst}, vel=${payload.vel || 0}km/h`);
          } catch (e) {
            console.log(`      📱 Raw payload: ${loc.raw_payload.substring(0, 50)}...`);
          }
        }
        console.log('');
      });
    } else {
      console.log('❌ NO HAY UBICACIONES GPS EN LOS ÚLTIMOS 30 MINUTOS');
      console.log('   Esto indica que OwnTracks no está enviando datos');
      return;
    }
    
    // 2. Verificar eventos geofence en el mismo período
    console.log('\n🎯 EVENTOS GEOFENCE ÚLTIMOS 30 MINUTOS:');
    
    const recentEvents = await pool.query(`
      SELECT 
        id, event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center,
        telegram_sent, telegram_sent_at, telegram_error
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= $1
      ORDER BY event_timestamp DESC
      LIMIT 10
    `, [last30Minutes]);
    
    if (recentEvents.rows.length > 0) {
      console.log(`📊 ${recentEvents.rows.length} eventos geofence encontrados:`);
      
      recentEvents.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleTimeString('es-MX');
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action}`);
        console.log(`      📍 ${event.latitude}, ${event.longitude}`);
        console.log(`      📏 ${event.distance_from_center}m de centro`);
        console.log(`      📱 Telegram: ${event.telegram_sent ? '✅ Enviado' : '❌ No enviado'}`);
        if (event.telegram_error) {
          console.log(`      ❌ Error: ${event.telegram_error}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ NO HAY EVENTOS GEOFENCE EN LOS ÚLTIMOS 30 MINUTOS');
      console.log('   Esto indica que el geofence-engine no detectó cambios');
    }
    
    // 3. Analizar secuencia de entrada/salida esperada vs real
    console.log('\n🧠 ANÁLISIS DE SECUENCIA ENTRADA/SALIDA:');
    
    let lastState = null;
    const expectedEvents = [];
    
    console.log('📊 Secuencia de movimientos (cronológico):');
    recentLocations.rows.reverse().forEach((loc, i) => {
      const timestamp = new Date(loc.gps_timestamp);
      const timeStr = timestamp.toLocaleTimeString('es-MX');
      
      const officeLat = 25.650648;
      const officeLng = -100.373529;
      const distance = calculateDistance(
        parseFloat(loc.latitude),
        parseFloat(loc.longitude),
        officeLat,
        officeLng
      );
      
      const isInside = distance <= 15;
      const status = isInside ? '🟢 DENTRO' : '🔴 FUERA';
      
      console.log(`   ${i+1}. ${timeStr} - ${status} (${Math.round(distance)}m)`);
      
      // Detectar cambios de estado esperados
      if (lastState !== null && lastState !== isInside) {
        const eventType = isInside ? 'ENTRADA' : 'SALIDA';
        const icon = isInside ? '🟢' : '🔴';
        expectedEvents.push({
          time: timestamp,
          type: eventType,
          icon: icon,
          coords: `${loc.latitude}, ${loc.longitude}`,
          distance: Math.round(distance)
        });
        console.log(`      🚨 CAMBIO ESPERADO: ${icon} ${eventType}`);
      }
      
      lastState = isInside;
    });
    
    console.log(`\n📊 RESUMEN DE ANÁLISIS:`);
    console.log(`   🎯 Cambios esperados: ${expectedEvents.length}`);
    console.log(`   📋 Eventos reales: ${recentEvents.rows.length}`);
    
    if (expectedEvents.length > 0) {
      console.log('\n📝 Eventos que DEBERÍAN haberse generado:');
      expectedEvents.forEach((exp, i) => {
        const timeStr = exp.time.toLocaleTimeString('es-MX');
        console.log(`   ${i+1}. ${exp.icon} ${exp.type} a las ${timeStr}`);
        console.log(`      📍 ${exp.coords} (${exp.distance}m del centro)`);
        
        // Buscar si existe evento real correspondiente
        const matchingEvent = recentEvents.rows.find(event => {
          const timeDiff = Math.abs(new Date(event.event_timestamp) - exp.time);
          return timeDiff < 5 * 60 * 1000; // 5 minutos tolerancia
        });
        
        if (matchingEvent) {
          console.log(`      ✅ Evento ENCONTRADO en BD`);
        } else {
          console.log(`      ❌ Evento NO ENCONTRADO en BD`);
        }
      });
    }
    
    // 4. Verificar estado actual del usuario
    console.log('\n👤 ESTADO ACTUAL DEL USUARIO:');
    
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
      userState.rows.forEach((state, i) => {
        const icon = state.is_inside ? '🟢' : '🔴';
        const status = state.is_inside ? 'DENTRO' : 'FUERA';
        console.log(`   ${state.store_name}: ${icon} ${status}`);
        
        if (state.last_enter_time) {
          console.log(`      ⬅️ Última entrada: ${new Date(state.last_enter_time).toLocaleString('es-MX')}`);
        }
        if (state.last_exit_time) {
          console.log(`      ➡️ Última salida: ${new Date(state.last_exit_time).toLocaleString('es-MX')}`);
        }
        console.log(`      🔄 Actualizado: ${new Date(state.updated_at).toLocaleString('es-MX')}`);
      });
    }
    
    // 5. Diagnóstico del problema
    console.log('\n🔧 DIAGNÓSTICO DEL PROBLEMA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (recentLocations.rows.length === 0) {
      console.log('❌ PROBLEMA: OwnTracks no está enviando ubicaciones');
      console.log('   Solución: Verificar configuración OwnTracks app');
    } else if (expectedEvents.length === 0) {
      console.log('❌ PROBLEMA: No hubo cambios de estado (dentro ↔ fuera)');
      console.log('   Solución: Asegurar movimiento >15m del centro');
    } else if (recentEvents.rows.length === 0) {
      console.log('❌ PROBLEMA: Geofence-engine no detecta cambios');
      console.log('   Solución: Verificar que location-processor llame a geofence-engine');
    } else {
      console.log('✅ SISTEMA: Funcionando correctamente');
      console.log('   Los eventos se generan y Telegram se envía');
    }
    
    console.log('\n💡 PRÓXIMOS PASOS:');
    if (expectedEvents.length > recentEvents.rows.length) {
      console.log('1. 🔧 Hay eventos perdidos - revisar location-processor');
      console.log('2. 🧪 Test manual del geofence-engine');
      console.log('3. 📱 Verificar configuración OwnTracks');
    } else {
      console.log('1. 📱 Verificar que recibiste alertas en Telegram');
      console.log('2. 🔄 Si no, hay problema en envío Telegram');
    }
    
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

debugOwnTracksLogs();