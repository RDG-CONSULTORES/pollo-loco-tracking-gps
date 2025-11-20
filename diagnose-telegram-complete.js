const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * DIAGNÓSTICO COMPLETO: Por qué no llegan las alertas de Telegram
 * 
 * INVESTIGACIÓN SISTEMÁTICA:
 * 1. Verificar eventos generados vs alertas recibidas
 * 2. Analizar configuración de Telegram
 * 3. Revisar logs de geofence-engine
 * 4. Identificar el punto exacto de falla
 * 5. Diseñar solución definitiva
 */
async function diagnoseComplete() {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO - ALERTAS TELEGRAM NO FUNCIONAN\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. ANÁLISIS DE EVENTOS RECIENTES
    console.log('📊 PASO 1: ANÁLISIS DE EVENTOS RECIENTES (última hora)');
    console.log('');
    
    const recentEvents = await pool.query(`
      SELECT 
        id, event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center,
        telegram_sent, telegram_sent_at, telegram_error,
        created_at
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '1 hour'
      ORDER BY event_timestamp DESC
      LIMIT 10
    `);
    
    console.log(`📈 Eventos encontrados en la última hora: ${recentEvents.rows.length}`);
    
    if (recentEvents.rows.length > 0) {
      console.log('');
      recentEvents.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action} (ID: ${event.id})`);
        console.log(`      📍 ${event.latitude}, ${event.longitude}`);
        console.log(`      📏 ${event.distance_from_center}m del centro`);
        console.log(`      📱 Telegram: ${event.telegram_sent ? '✅ Marcado enviado' : '❌ NO enviado'}`);
        
        if (event.telegram_sent_at) {
          const sentTime = new Date(event.telegram_sent_at).toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
          console.log(`      ⏰ Marcado enviado: ${sentTime}`);
        }
        
        if (event.telegram_error) {
          console.log(`      ❌ Error: ${event.telegram_error}`);
        }
        
        console.log('');
      });
    } else {
      console.log('❌ NO HAY EVENTOS EN LA ÚLTIMA HORA');
      console.log('   Esto indica que el geofence-engine NO está detectando cambios');
    }
    
    // 2. VERIFICAR UBICACIONES GPS RECIENTES
    console.log('📍 PASO 2: UBICACIONES GPS RECIENTES (última hora)');
    console.log('');
    
    const recentGPS = await pool.query(`
      SELECT 
        id, latitude, longitude, accuracy, battery, velocity,
        gps_timestamp, created_at,
        EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (ORDER BY gps_timestamp))) / 60 as interval_minutes
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp >= NOW() - INTERVAL '1 hour'
      ORDER BY gps_timestamp DESC
      LIMIT 15
    `);
    
    console.log(`📊 Ubicaciones GPS en la última hora: ${recentGPS.rows.length}`);
    
    if (recentGPS.rows.length > 0) {
      console.log('');
      
      const officeLat = 25.650648;
      const officeLng = -100.373529;
      const radius = 15;
      
      // Analizar movimientos y cambios de estado
      let stateChanges = [];
      let lastState = null;
      
      const chronologicalGPS = [...recentGPS.rows].reverse();
      
      chronologicalGPS.forEach((loc, i) => {
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
        const interval = loc.interval_minutes ? `(+${Math.round(loc.interval_minutes * 10) / 10}min)` : '';
        
        console.log(`   ${i+1}. ${timeStr} ${interval} - ${status}`);
        console.log(`      📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`      📏 ${Math.round(distance)}m de oficina | Acc: ${loc.accuracy}m | Bat: ${loc.battery}%`);
        
        // Detectar cambios de estado
        if (lastState !== null && lastState !== isInside) {
          const changeType = isInside ? 'ENTRADA' : 'SALIDA';
          stateChanges.push({
            time: timestamp,
            type: changeType,
            distance: Math.round(distance),
            gps_id: loc.id
          });
          console.log(`      🚨 CAMBIO DETECTADO: ${isInside ? '🟢' : '🔴'} ${changeType}`);
        }
        
        lastState = isInside;
        console.log('');
      });
      
      console.log(`🔄 Total de cambios de estado detectados: ${stateChanges.length}`);
      
      if (stateChanges.length > 0) {
        console.log('');
        console.log('📝 Cambios que DEBERÍAN haber generado eventos:');
        stateChanges.forEach((change, i) => {
          const timeStr = change.time.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
          const icon = change.type === 'ENTRADA' ? '🟢' : '🔴';
          console.log(`   ${i+1}. ${timeStr} - ${icon} ${change.type} (${change.distance}m)`);
        });
      }
      
    } else {
      console.log('❌ NO HAY UBICACIONES GPS EN LA ÚLTIMA HORA');
      console.log('   OwnTracks no está enviando datos al servidor');
    }
    
    // 3. VERIFICAR CONFIGURACIÓN DE TELEGRAM
    console.log('\\n🤖 PASO 3: CONFIGURACIÓN TELEGRAM');
    console.log('');
    
    // Verificar variables de entorno
    console.log('🔧 Variables de entorno:');
    console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ NO configurado'}`);
    console.log(`   TELEGRAM_ADMIN_IDS: ${process.env.TELEGRAM_ADMIN_IDS || 'NO configurado'}`);
    console.log('');
    
    // Verificar configuración interna
    try {
      const telegramConfig = require('./src/config/telegram');
      console.log('📋 Configuración interna Telegram:');
      console.log(`   Bot Token: ${telegramConfig.config.botToken ? '✅ OK' : '❌ NO configurado'}`);
      console.log(`   Admin IDs: ${telegramConfig.config.adminIds.length} configurados`);
      
      telegramConfig.config.adminIds.forEach((adminId, i) => {
        console.log(`      ${i+1}. ${adminId} ${adminId == 6932484342 ? '← ROBERTO' : ''}`);
      });
      
    } catch (configError) {
      console.log('❌ Error cargando configuración Telegram:', configError.message);
    }
    
    // 4. ANÁLISIS DEL PROBLEMA
    console.log('\\n🔧 PASO 4: ANÁLISIS DEL PROBLEMA');
    console.log('');
    
    const eventsCount = recentEvents.rows.length;
    const gpsCount = recentGPS.rows.length;
    const sentEvents = recentEvents.rows.filter(e => e.telegram_sent).length;
    const errorEvents = recentEvents.rows.filter(e => e.telegram_error).length;
    
    console.log('📊 ESTADÍSTICAS:');
    console.log(`   GPS ubicaciones: ${gpsCount}`);
    console.log(`   Eventos geofence: ${eventsCount}`);
    console.log(`   Marcados enviados: ${sentEvents}`);
    console.log(`   Con errores: ${errorEvents}`);
    console.log('');
    
    // Diagnóstico
    console.log('🔍 DIAGNÓSTICO:');
    
    if (gpsCount === 0) {
      console.log('❌ PROBLEMA NIVEL 1: OwnTracks no envía datos');
      console.log('   CAUSA: Configuración OwnTracks o conectividad');
      console.log('   SOLUCIÓN: Verificar app OwnTracks en teléfono');
      
    } else if (eventsCount === 0) {
      console.log('❌ PROBLEMA NIVEL 2: Geofence-engine no detecta cambios');
      console.log('   CAUSA: location-processor no llama geofence-engine');
      console.log('   SOLUCIÓN: Verificar integración location-processor');
      
    } else if (sentEvents === 0 && errorEvents > 0) {
      console.log('❌ PROBLEMA NIVEL 3: Telegram bot no funciona');
      console.log('   CAUSA: Bot no inicializado o configuración incorrecta');
      console.log('   SOLUCIÓN: Verificar bot en servidor de producción');
      
    } else {
      console.log('⚠️ PROBLEMA MIXTO: Múltiples posibles causas');
      console.log('   REQUIERE: Análisis más profundo');
    }
    
    // 5. VERIFICAR TABLAS Y ESQUEMA
    console.log('\\n🗄️ PASO 5: VERIFICACIÓN DE ESQUEMA');
    console.log('');
    
    try {
      const tableCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'geofence_events'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Estructura tabla geofence_events:');
      tableCheck.rows.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      
    } catch (schemaError) {
      console.log('❌ Error verificando esquema:', schemaError.message);
    }
    
    // 6. RECOMENDACIONES
    console.log('\\n💡 PASO 6: RECOMENDACIONES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    if (gpsCount > 0 && eventsCount > 0) {
      console.log('✅ DATOS LLEGANDO: GPS y eventos se generan');
      console.log('🎯 PROBLEMA: En el envío de Telegram');
      console.log('');
      console.log('📝 ACCIONES NECESARIAS:');
      console.log('1. 🤖 Verificar que bot está corriendo en Railway');
      console.log('2. 📱 Test directo del bot con mensaje manual');
      console.log('3. 🔄 Revisar integración geofence-alerts con bot');
      console.log('4. 🧪 Test completo del flujo end-to-end');
      
    } else if (gpsCount > 0 && eventsCount === 0) {
      console.log('⚠️ GPS OK, EVENTOS NO: Problema en geofence-engine');
      console.log('🎯 PROBLEMA: location-processor → geofence-engine');
      console.log('');
      console.log('📝 ACCIONES NECESARIAS:');
      console.log('1. 🔧 Verificar que location-processor llama geofence-engine');
      console.log('2. 🧪 Test directo de geofence-engine');
      console.log('3. ⚡ Verificar horarios de trabajo (time-filters)');
      
    } else {
      console.log('❌ PROBLEMA FUNDAMENTAL: No hay datos básicos');
      console.log('🎯 PROBLEMA: OwnTracks → servidor');
      console.log('');
      console.log('📝 ACCIONES NECESARIAS:');
      console.log('1. 📱 Verificar configuración OwnTracks app');
      console.log('2. 🌐 Test conectividad servidor');
      console.log('3. 🔧 Revisar endpoint /owntracks');
    }
    
    console.log('\\n🎯 PRÓXIMO PASO RECOMENDADO:');
    console.log('Ejecutar test específico según el problema identificado');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
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

diagnoseComplete();