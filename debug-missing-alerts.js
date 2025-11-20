const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugMissingAlerts() {
  try {
    console.log('🔍 ANÁLISIS COMPLETO - POR QUÉ NO LLEGAN ALERTAS\n');
    
    // 1. Ver las últimas 20 ubicaciones GPS con timestamps exactos
    console.log('📍 TUS ÚLTIMAS 20 UBICACIONES GPS:');
    
    const recentLocations = await pool.query(`
      SELECT 
        id, latitude, longitude, accuracy, battery, gps_timestamp,
        LAG(gps_timestamp) OVER (ORDER BY gps_timestamp) as prev_timestamp,
        EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (ORDER BY gps_timestamp))) as interval_seconds
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp > NOW() - INTERVAL '2 hours'
      ORDER BY gps_timestamp DESC
      LIMIT 20
    `);
    
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    const radius = 20;
    
    console.log(`📊 Últimas ${recentLocations.rows.length} ubicaciones (con distancia a oficina):`);
    
    recentLocations.rows.forEach((loc, i) => {
      const timestamp = new Date(loc.gps_timestamp);
      const timeStr = timestamp.toLocaleTimeString('es-MX');
      const dateStr = timestamp.toLocaleDateString('es-MX');
      
      const distance = calculateDistance(
        parseFloat(loc.latitude),
        parseFloat(loc.longitude),
        officeLat,
        officeLng
      );
      
      const isInside = distance <= radius;
      const status = isInside ? '🟢 DENTRO' : '🔴 FUERA';
      
      console.log(`   ${i+1}. ${dateStr} ${timeStr} - ${status}`);
      console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
      console.log(`      📏 Distancia: ${Math.round(distance)}m | Radius: ${radius}m`);
      console.log(`      🎯 Accuracy: ${loc.accuracy}m | 🔋 Battery: ${loc.battery}%`);
      
      if (loc.interval_seconds && loc.interval_seconds > 0) {
        const minutes = Math.round(loc.interval_seconds / 60 * 10) / 10;
        console.log(`      ⏱️ Intervalo: ${minutes} min desde anterior`);
      }
      console.log('');
    });
    
    // 2. Ver eventos geofence generados vs esperados
    console.log('\n📋 EVENTOS GEOFENCE GENERADOS:');
    
    const recentEvents = await pool.query(`
      SELECT 
        id, event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center,
        telegram_sent, telegram_sent_at, telegram_error
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp > NOW() - INTERVAL '2 hours'
      ORDER BY event_timestamp DESC
      LIMIT 10
    `);
    
    if (recentEvents.rows.length > 0) {
      console.log(`📊 Últimos ${recentEvents.rows.length} eventos geofence:`);
      recentEvents.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleTimeString('es-MX');
        const dateStr = eventTime.toLocaleDateString('es-MX');
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${icon} ${dateStr} ${timeStr} - ${action}`);
        console.log(`      📍 ${event.latitude}, ${event.longitude}`);
        console.log(`      📏 Distancia: ${event.distance_from_center}m`);
        console.log(`      📱 Telegram: ${event.telegram_sent ? '✅' : '❌'} ${event.telegram_sent_at ? new Date(event.telegram_sent_at).toLocaleTimeString('es-MX') : ''}`);
        if (event.telegram_error) {
          console.log(`      ❌ Error: ${event.telegram_error}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ NO HAY EVENTOS GEOFENCE EN LAS ÚLTIMAS 2 HORAS');
      console.log('   Esto indica que el geofence-engine NO está detectando cambios');
    }
    
    // 3. Comprobar estado del usuario en geofences
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
    } else {
      console.log('❌ No hay estado guardado');
    }
    
    // 4. Analizar secuencia de movimientos para detectar entrada/salida perdida
    console.log('\n🧠 ANÁLISIS DE SECUENCIA DE MOVIMIENTOS:');
    
    const movements = [];
    recentLocations.rows.reverse().forEach(loc => {
      const distance = calculateDistance(
        parseFloat(loc.latitude),
        parseFloat(loc.longitude),
        officeLat,
        officeLng
      );
      const isInside = distance <= radius;
      movements.push({
        timestamp: new Date(loc.gps_timestamp),
        distance: distance,
        isInside: isInside,
        coords: `${loc.latitude}, ${loc.longitude}`
      });
    });
    
    console.log('📊 Secuencia de movimientos (cronológico):');
    let expectedEvents = [];
    let lastState = null;
    
    movements.forEach((mov, i) => {
      const timeStr = mov.timestamp.toLocaleTimeString('es-MX');
      const status = mov.isInside ? '🟢 DENTRO' : '🔴 FUERA';
      
      console.log(`   ${i+1}. ${timeStr} - ${status} (${Math.round(mov.distance)}m)`);
      
      // Detectar cambios de estado esperados
      if (lastState !== null && lastState !== mov.isInside) {
        const eventType = mov.isInside ? 'ENTRADA' : 'SALIDA';
        const icon = mov.isInside ? '🟢' : '🔴';
        expectedEvents.push({
          time: mov.timestamp,
          type: eventType,
          icon: icon
        });
        console.log(`      🚨 CAMBIO DETECTADO: ${icon} ${eventType} esperada aquí`);
      }
      
      lastState = mov.isInside;
    });
    
    console.log(`\n📊 EVENTOS ESPERADOS vs REALES:`);
    console.log(`   🎯 Eventos que DEBERÍAN haberse generado: ${expectedEvents.length}`);
    console.log(`   📋 Eventos REALES generados: ${recentEvents.rows.length}`);
    
    if (expectedEvents.length > 0) {
      console.log('\n   📝 Eventos esperados:');
      expectedEvents.forEach((exp, i) => {
        const timeStr = exp.time.toLocaleTimeString('es-MX');
        console.log(`      ${i+1}. ${exp.icon} ${exp.type} a las ${timeStr}`);
      });
    }
    
    // 5. Test directo del location-processor con coordenadas recientes
    if (recentLocations.rows.length > 0) {
      console.log('\n🧪 TEST DIRECTO CON TU UBICACIÓN MÁS RECIENTE:');
      
      const latestLocation = recentLocations.rows[0];
      console.log(`📍 Testing con: ${latestLocation.latitude}, ${latestLocation.longitude}`);
      
      try {
        const locationProcessor = require('./src/services/location-processor');
        
        // Simular payload OwnTracks con tu ubicación real
        const testPayload = {
          _type: 'location',
          tid: '01',
          lat: parseFloat(latestLocation.latitude),
          lon: parseFloat(latestLocation.longitude),
          tst: Math.floor(Date.now() / 1000),
          acc: latestLocation.accuracy,
          batt: latestLocation.battery,
          vel: 0
        };
        
        console.log('📡 Enviando a location-processor...');
        const result = await locationProcessor.processLocation(testPayload);
        
        console.log('📋 Resultado location-processor:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.processed) {
          console.log('✅ Location-processor funcionó');
          console.log('🔍 Verificando si se generó evento...');
          
          // Verificar eventos muy recientes
          const newEvents = await pool.query(`
            SELECT 
              event_type, event_timestamp, distance_from_center, telegram_sent
            FROM geofence_events
            WHERE user_id = 5 
              AND event_timestamp > NOW() - INTERVAL '1 minute'
            ORDER BY event_timestamp DESC
            LIMIT 1
          `);
          
          if (newEvents.rows.length > 0) {
            const event = newEvents.rows[0];
            console.log(`🎯 ¡EVENTO GENERADO! ${event.event_type} - Telegram: ${event.telegram_sent ? '✅' : '❌'}`);
          } else {
            console.log('❌ No se generó evento nuevo');
          }
          
        } else {
          console.log(`❌ Location-processor falló: ${result.reason}`);
        }
        
      } catch (processorError) {
        console.error(`❌ Error en location-processor: ${processorError.message}`);
      }
    }
    
    // 6. Diagnóstico final
    console.log('\n🔧 DIAGNÓSTICO DEL PROBLEMA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (recentEvents.rows.length === 0) {
      console.log('❌ PROBLEMA PRINCIPAL: No se están generando eventos geofence');
      console.log('   Posibles causas:');
      console.log('   1. Location-processor no está llamando a geofence-engine');
      console.log('   2. Geofence-engine no detecta cambios de estado');
      console.log('   3. Sistema está filtrando ubicaciones (duplicados, precisión, etc)');
    } else if (recentEvents.rows.some(e => !e.telegram_sent)) {
      console.log('⚠️ PROBLEMA: Eventos se generan pero Telegram falla');
      console.log('   Geofence-engine funciona, problema en envío Telegram');
    } else {
      console.log('✅ Sistema funcionando - verificar timing de pruebas');
    }
    
    console.log('\n💡 PRÓXIMOS PASOS DE DEBUG:');
    console.log('1. 🔍 Revisar por qué no se generan eventos geofence');
    console.log('2. 🧪 Test manual con coordenadas específicas');
    console.log('3. 📱 Verificar configuración Telegram');
    console.log('4. ⚡ Forzar test con location-processor directo');
    
  } catch (error) {
    console.error('❌ Error en análisis:', error.message);
    console.error('Stack:', error.stack);
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

debugMissingAlerts();