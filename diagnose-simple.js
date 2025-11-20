const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function diagnoseSimple() {
  try {
    console.log('🔍 DIAGNÓSTICO SIMPLE - QUÉ ESTÁ PASANDO CON LAS ALERTAS\n');
    
    // 1. Verificar eventos recientes básico
    console.log('📊 EVENTOS GEOFENCE ÚLTIMAS 2 HORAS:');
    
    const events = await pool.query(`
      SELECT 
        id, event_type, location_code, event_timestamp,
        telegram_sent, telegram_error
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '2 hours'
      ORDER BY event_timestamp DESC
      LIMIT 20
    `);
    
    console.log(`📈 Total eventos: ${events.rows.length}`);
    
    if (events.rows.length > 0) {
      events.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action}`);
        console.log(`      📱 Enviado: ${event.telegram_sent ? '✅ SÍ' : '❌ NO'}`);
        if (event.telegram_error) {
          console.log(`      ❌ Error: ${event.telegram_error}`);
        }
        console.log('');
      });
    }
    
    // 2. Verificar ubicaciones GPS recientes
    console.log('📍 UBICACIONES GPS ÚLTIMAS 2 HORAS:');
    
    const gpsData = await pool.query(`
      SELECT 
        latitude, longitude, gps_timestamp, accuracy, battery
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp >= NOW() - INTERVAL '2 hours'
      ORDER BY gps_timestamp DESC
      LIMIT 10
    `);
    
    console.log(`📍 Total ubicaciones: ${gpsData.rows.length}`);
    
    if (gpsData.rows.length > 0) {
      const officeLat = 25.650648;
      const officeLng = -100.373529;
      const radius = 15;
      
      gpsData.rows.forEach((loc, i) => {
        const timestamp = new Date(loc.gps_timestamp);
        const timeStr = timestamp.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
        
        const distance = calculateDistance(
          parseFloat(loc.latitude),
          parseFloat(loc.longitude),
          officeLat,
          officeLng
        );
        
        const isInside = distance <= radius;
        const status = isInside ? '🟢 DENTRO' : '🔴 FUERA';
        
        console.log(`   ${i+1}. ${timeStr} - ${status} (${Math.round(distance)}m)`);
      });
    }
    
    // 3. Estado actual del usuario
    console.log('\\n👤 TU ESTADO ACTUAL:');
    
    if (gpsData.rows.length > 0) {
      const latest = gpsData.rows[0];
      const distance = calculateDistance(
        parseFloat(latest.latitude),
        parseFloat(latest.longitude),
        25.650648,
        -100.373529
      );
      
      const isInside = distance <= 15;
      console.log(`📍 Ubicación: ${latest.latitude}, ${latest.longitude}`);
      console.log(`📏 Distancia: ${Math.round(distance)}m del centro`);
      console.log(`🎯 Estado: ${isInside ? '🟢 DENTRO' : '🔴 FUERA'} del geofence (15m)`);
      console.log(`⏰ Última actualización: ${new Date(latest.gps_timestamp).toLocaleString('es-MX')}`);
    }
    
    // 4. Análisis rápido
    console.log('\\n🔧 ANÁLISIS:');
    
    const eventsCount = events.rows.length;
    const gpsCount = gpsData.rows.length;
    const sentCount = events.rows.filter(e => e.telegram_sent).length;
    const errorCount = events.rows.filter(e => e.telegram_error).length;
    
    console.log(`📊 GPS ubicaciones: ${gpsCount}`);
    console.log(`📊 Eventos geofence: ${eventsCount}`);
    console.log(`📊 Eventos "enviados": ${sentCount}`);
    console.log(`📊 Eventos con error: ${errorCount}`);
    
    console.log('\\n💡 PROBLEMA IDENTIFICADO:');
    
    if (gpsCount === 0) {
      console.log('❌ OwnTracks no está enviando ubicaciones');
    } else if (eventsCount === 0) {
      console.log('❌ Geofence-engine no está detectando cambios de estado');
    } else if (sentCount === 0 && errorCount > 0) {
      console.log('❌ Bot de Telegram no está funcionando (todos los eventos tienen error)');
    } else if (sentCount > 0 && errorCount === 0) {
      console.log('⚠️ Sistema dice que envía, pero tú no recibes alertas');
      console.log('   CAUSA: Problema en bot o configuración Telegram');
    } else {
      console.log('❓ Problema mixto - requiere análisis más profundo');
    }
    
    // 5. Test directo del endpoint
    console.log('\\n🧪 SIGUIENTE PASO RECOMENDADO:');
    
    if (eventsCount > 0) {
      console.log('1. Test directo del bot de Telegram');
      console.log('2. Verificar que el servidor esté corriendo con el bot inicializado');
    } else {
      console.log('1. Verificar que OwnTracks esté enviando datos');
      console.log('2. Test manual del geofence-engine');
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

diagnoseSimple();