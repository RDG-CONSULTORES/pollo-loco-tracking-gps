const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugOwnTracksSimple() {
  try {
    console.log('🔍 ANÁLISIS RÁPIDO - TUS MOVIMIENTOS RECIENTES\n');
    
    const now = new Date();
    const last60Minutes = new Date(now.getTime() - 60 * 60 * 1000);
    
    // 1. Ubicaciones GPS recientes
    console.log('📍 TUS UBICACIONES ÚLTIMOS 60 MINUTOS:');
    
    const locations = await pool.query(`
      SELECT 
        latitude, longitude, accuracy, battery,
        gps_timestamp,
        EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (ORDER BY gps_timestamp))) / 60 as interval_minutes
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp >= $1
      ORDER BY gps_timestamp DESC
      LIMIT 20
    `, [last60Minutes]);
    
    if (locations.rows.length > 0) {
      console.log(`📊 ${locations.rows.length} ubicaciones encontradas:`);
      console.log('');
      
      const officeLat = 25.650648;
      const officeLng = -100.373529;
      const radius = 15;
      
      locations.rows.forEach((loc, i) => {
        const timestamp = new Date(loc.gps_timestamp);
        const timeStr = timestamp.toLocaleString('es-MX', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        
        // Calcular distancia a oficina
        const distance = calculateDistance(
          parseFloat(loc.latitude),
          parseFloat(loc.longitude),
          officeLat,
          officeLng
        );
        
        const isInside = distance <= radius;
        const status = isInside ? '🟢 DENTRO' : '🔴 FUERA';
        const interval = loc.interval_minutes ? `(+${Math.round(loc.interval_minutes * 10) / 10}min)` : '';
        
        console.log(`   ${i+1}. ${timeStr} ${interval} - ${status}`);
        console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`      📏 ${Math.round(distance)}m de oficina | Acc: ${loc.accuracy}m | Bat: ${loc.battery}%`);
        console.log('');
      });
    } else {
      console.log('❌ NO HAY UBICACIONES EN LA ÚLTIMA HORA');
      return;
    }
    
    // 2. Eventos geofence recientes
    console.log('🎯 EVENTOS GEOFENCE ÚLTIMOS 60 MINUTOS:');
    
    const events = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center,
        telegram_sent, telegram_sent_at
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= $1
      ORDER BY event_timestamp DESC
      LIMIT 10
    `, [last60Minutes]);
    
    if (events.rows.length > 0) {
      console.log(`📊 ${events.rows.length} eventos encontrados:`);
      console.log('');
      
      events.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleString('es-MX', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action}`);
        console.log(`      📍 ${event.latitude}, ${event.longitude}`);
        console.log(`      📏 ${event.distance_from_center}m del centro`);
        console.log(`      📱 Telegram: ${event.telegram_sent ? '✅ Enviado' : '❌ No enviado'}`);
        if (event.telegram_sent_at) {
          const telegramTime = new Date(event.telegram_sent_at).toLocaleString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          console.log(`      ⏰ Enviado: ${telegramTime}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ NO HAY EVENTOS GEOFENCE EN LA ÚLTIMA HORA');
    }
    
    // 3. Análisis de secuencia - ¿hubo cambios de estado?
    console.log('🧠 ANÁLISIS DE SECUENCIA:');
    console.log('');
    
    let lastState = null;
    const changes = [];
    
    // Procesar en orden cronológico
    const chronologicalLocs = [...locations.rows].reverse();
    
    chronologicalLocs.forEach((loc, i) => {
      const distance = calculateDistance(
        parseFloat(loc.latitude),
        parseFloat(loc.longitude),
        25.650648,
        -100.373529
      );
      
      const isInside = distance <= 15;
      
      if (lastState !== null && lastState !== isInside) {
        const changeType = isInside ? 'ENTRADA' : 'SALIDA';
        const timestamp = new Date(loc.gps_timestamp);
        changes.push({
          time: timestamp,
          type: changeType,
          coords: `${loc.latitude}, ${loc.longitude}`,
          distance: Math.round(distance)
        });
      }
      
      lastState = isInside;
    });
    
    console.log(`📊 Cambios de estado detectados: ${changes.length}`);
    
    if (changes.length > 0) {
      console.log('');
      console.log('📝 Cambios que DEBERÍAN haber generado eventos:');
      changes.forEach((change, i) => {
        const timeStr = change.time.toLocaleString('es-MX', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const icon = change.type === 'ENTRADA' ? '🟢' : '🔴';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${change.type}`);
        console.log(`      📍 ${change.coords}`);
        console.log(`      📏 ${change.distance}m del centro`);
        console.log('');
      });
      
      console.log(`🚨 PROBLEMA IDENTIFICADO:`);
      console.log(`   Cambios esperados: ${changes.length}`);
      console.log(`   Eventos generados: ${events.rows.length}`);
      
      if (changes.length > events.rows.length) {
        console.log(`   ❌ HAY ${changes.length - events.rows.length} EVENTOS PERDIDOS`);
      }
    } else {
      console.log('ℹ️ No hubo cambios de estado (dentro ↔ fuera) en la última hora');
      console.log('   Esto explica por qué no hay eventos geofence nuevos');
    }
    
    // 4. Estado actual
    console.log('\n👤 TU ESTADO ACTUAL:');
    
    if (locations.rows.length > 0) {
      const latest = locations.rows[0];
      const latestDistance = calculateDistance(
        parseFloat(latest.latitude),
        parseFloat(latest.longitude),
        25.650648,
        -100.373529
      );
      
      const isCurrentlyInside = latestDistance <= 15;
      const currentStatus = isCurrentlyInside ? '🟢 DENTRO' : '🔴 FUERA';
      
      console.log(`   ${currentStatus} (${Math.round(latestDistance)}m del centro)`);
      console.log(`   📍 Última ubicación: ${new Date(latest.gps_timestamp).toLocaleString('es-MX')}`);
    }
    
    // 5. Diagnóstico final
    console.log('\n🔧 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    
    if (locations.rows.length === 0) {
      console.log('❌ OwnTracks no envía ubicaciones');
    } else if (changes.length === 0) {
      console.log('ℹ️ No hubo entrada/salida real del geofence');
      console.log('   Necesitas moverte más para cruzar la frontera de 15m');
    } else if (events.rows.length === 0) {
      console.log('❌ El geofence-engine no está detectando los cambios');
      console.log('   Problema en location-processor → geofence-engine');
    } else {
      console.log('✅ Sistema funcionando - eventos generados correctamente');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
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

debugOwnTracksSimple();