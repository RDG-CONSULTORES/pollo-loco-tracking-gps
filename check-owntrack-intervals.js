const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkOwnTrackIntervals() {
  try {
    console.log('📱 ANÁLISIS DE INTERVALOS OWNTRACK Y ALERTAS\n');
    
    // 1. Ver configuración actual del sistema
    console.log('⚙️ Configuración actual del sistema:');
    
    const configs = await pool.query(`
      SELECT config_key, config_value 
      FROM system_config 
      WHERE config_key IN (
        'gps_accuracy_threshold',
        'geofencing_enabled',
        'geofence_telegram_alerts',
        'system_active'
      )
      ORDER BY config_key
    `);
    
    configs.rows.forEach(config => {
      console.log(`   ${config.config_key}: ${config.config_value}`);
    });
    
    // 2. Analizar tus ubicaciones GPS recientes
    console.log('\n📍 Análisis de tus ubicaciones GPS recientes:');
    
    const recentLocations = await pool.query(`
      SELECT 
        latitude, longitude, accuracy, battery, gps_timestamp,
        LAG(gps_timestamp) OVER (ORDER BY gps_timestamp) as prev_timestamp,
        EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (ORDER BY gps_timestamp))) as interval_seconds
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp > NOW() - INTERVAL '2 hours'
      ORDER BY gps_timestamp DESC
      LIMIT 10
    `);
    
    console.log(`📊 Últimas ${recentLocations.rows.length} ubicaciones GPS:`);
    
    let totalInterval = 0;
    let intervalCount = 0;
    
    recentLocations.rows.forEach((loc, i) => {
      const timestamp = new Date(loc.gps_timestamp).toLocaleTimeString('es-MX');
      console.log(`   ${i+1}. ${timestamp} - ${loc.latitude}, ${loc.longitude}`);
      console.log(`      Accuracy: ${loc.accuracy}m | Battery: ${loc.battery}%`);
      
      if (loc.interval_seconds && loc.interval_seconds > 0) {
        const minutes = Math.round(loc.interval_seconds / 60 * 10) / 10;
        console.log(`      Intervalo desde anterior: ${minutes} minutos`);
        totalInterval += loc.interval_seconds;
        intervalCount++;
      }
      console.log('');
    });
    
    if (intervalCount > 0) {
      const avgInterval = (totalInterval / intervalCount) / 60;
      console.log(`⏱️ Intervalo promedio OwnTracks: ${Math.round(avgInterval * 10) / 10} minutos`);
    }
    
    // 3. Configuración de geofence
    console.log('\n🎯 Configuración de tu oficina:');
    
    const office = await pool.query(`
      SELECT 
        location_code, name, latitude, longitude, 
        geofence_radius, active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (office.rows.length > 0) {
      const off = office.rows[0];
      console.log(`   📍 ${off.name}`);
      console.log(`   🎯 Coordenadas: ${off.latitude}, ${off.longitude}`);
      console.log(`   📏 Radio: ${off.geofence_radius} metros`);
      console.log(`   🟢 Estado: ${off.active ? 'Activo' : 'Inactivo'}`);
    }
    
    // 4. Calcular distancia de movimiento necesaria
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    const radius = 20; // metros
    
    console.log('\n🚶‍♂️ DISTANCIA DE MOVIMIENTO REQUERIDA:');
    console.log(`   📍 Centro oficina: ${officeLat}, ${officeLng}`);
    console.log(`   📏 Radio geofence: ${radius} metros`);
    console.log('');
    console.log('   🟢 Para ENTRADA: Camina DENTRO de los 20m del centro');
    console.log('   🔴 Para SALIDA: Camina FUERA de los 20m del centro');
    console.log('');
    console.log('💡 RECOMENDACIÓN DE PRUEBA:');
    console.log(`   1. Estar FUERA de la oficina (>25m del centro)`);
    console.log(`   2. Caminar DENTRO de la oficina (<15m del centro)`);
    console.log(`   3. Esperar 1-3 minutos para que OwnTracks envíe ubicación`);
    console.log(`   4. Recibir alerta ENTRADA en Telegram`);
    console.log(`   5. Caminar FUERA de la oficina (>25m del centro)`);
    console.log(`   6. Esperar 1-3 minutos`);
    console.log(`   7. Recibir alerta SALIDA en Telegram`);
    
    // 5. Ver eventos geofence recientes
    console.log('\n📋 Eventos geofence recientes:');
    
    const recentEvents = await pool.query(`
      SELECT 
        event_type, location_code, event_timestamp,
        latitude, longitude, distance_from_center,
        telegram_sent, telegram_sent_at
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY event_timestamp DESC
      LIMIT 5
    `);
    
    if (recentEvents.rows.length > 0) {
      console.log(`📊 Últimos ${recentEvents.rows.length} eventos:`);
      recentEvents.rows.forEach((event, i) => {
        const time = new Date(event.event_timestamp).toLocaleTimeString('es-MX');
        const telegramTime = event.telegram_sent_at ? new Date(event.telegram_sent_at).toLocaleTimeString('es-MX') : 'No enviado';
        console.log(`   ${i+1}. ${time} - ${event.event_type.toUpperCase()}: ${event.location_code}`);
        console.log(`      Distancia: ${event.distance_from_center}m`);
        console.log(`      Telegram: ${event.telegram_sent ? `✅ ${telegramTime}` : '❌ No enviado'}`);
      });
    } else {
      console.log('❌ No hay eventos geofence en las últimas 24 horas');
    }
    
    // 6. Configuración OwnTracks típica
    console.log('\n📱 CONFIGURACIÓN TÍPICA OWNTRACK:');
    console.log('   🔋 Modo Normal: 2-5 minutos entre ubicaciones');
    console.log('   🏃‍♂️ Modo Movimiento: 30 segundos - 2 minutos');
    console.log('   🔋 Batería Baja: 5-10 minutos');
    console.log('   📶 WiFi/Cellular: Puede variar intervalos');
    console.log('');
    console.log('⚠️ FACTORES QUE AFECTAN:');
    console.log('   • Nivel de batería del celular');
    console.log('   • Señal GPS (interiores vs exteriores)');
    console.log('   • Configuración de ahorro de energía');
    console.log('   • Velocidad de movimiento detectada');
    
    // 7. Estado actual del usuario
    console.log('\n👤 Tu estado actual en el sistema:');
    
    const userState = await pool.query(`
      SELECT 
        uss.location_code, uss.is_inside, 
        uss.last_enter_time, uss.last_exit_time,
        tlc.name as store_name
      FROM user_sucursal_state uss
      JOIN tracking_locations_cache tlc ON uss.location_code = tlc.location_code
      WHERE uss.user_id = 5
      ORDER BY uss.updated_at DESC
    `);
    
    if (userState.rows.length > 0) {
      console.log('📊 Estados de geofence:');
      userState.rows.forEach((state, i) => {
        console.log(`   ${i+1}. ${state.store_name} (${state.location_code})`);
        console.log(`      Estado: ${state.is_inside ? '🟢 DENTRO' : '🔴 FUERA'}`);
        if (state.last_enter_time) {
          console.log(`      Última entrada: ${new Date(state.last_enter_time).toLocaleString('es-MX')}`);
        }
        if (state.last_exit_time) {
          console.log(`      Última salida: ${new Date(state.last_exit_time).toLocaleString('es-MX')}`);
        }
      });
    } else {
      console.log('❌ No hay estado de geofence registrado');
    }
    
    console.log('\n🎯 RESUMEN PARA TUS PRUEBAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 OwnTracks envía ubicación cada 1-5 minutos típicamente');
    console.log('📏 Necesitas moverte >20m desde el centro para salir del geofence');
    console.log('📏 Necesitas moverte <20m del centro para entrar al geofence'); 
    console.log('⏱️ Las alertas llegan 1-3 minutos después del movimiento');
    console.log('🔄 El sistema detecta cambios de estado (dentro ↔ fuera)');
    console.log('📧 Recibes notificación en Telegram inmediatamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkOwnTrackIntervals();