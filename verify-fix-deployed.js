const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyFixDeployed() {
  try {
    console.log('🔍 VERIFICANDO QUE EL FIX ESTÁ ACTIVO EN RAILWAY\n');
    
    // 1. Verificar configuración de geofence Roberto
    console.log('📍 CONFIGURACIÓN GEOFENCE ROBERTO:');
    
    const office = await pool.query(`
      SELECT location_code, name, latitude, longitude, geofence_radius, active, synced_at
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (office.rows.length > 0) {
      const config = office.rows[0];
      console.log(`✅ Oficina configurada: ${config.name}`);
      console.log(`📍 Centro: ${config.latitude}, ${config.longitude}`);
      console.log(`📏 Radio: ${config.geofence_radius} metros`);
      console.log(`🟢 Estado: ${config.active ? 'Activo' : 'Inactivo'}`);
      console.log(`🔄 Última sync: ${new Date(config.synced_at).toLocaleString('es-MX')}`);
    } else {
      console.log('❌ Oficina Roberto no encontrada');
      return;
    }
    
    // 2. Verificar que los eventos problemáticos están corregidos
    console.log('\n📊 ESTADO EVENTOS DESPUÉS DEL FIX:');
    
    const events = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN telegram_sent THEN 1 ELSE 0 END) as marked_sent,
        SUM(CASE WHEN telegram_error IS NOT NULL THEN 1 ELSE 0 END) as with_errors,
        MAX(event_timestamp) as last_event
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '6 hours'
    `);
    
    if (events.rows.length > 0) {
      const stats = events.rows[0];
      console.log(`📈 Eventos últimas 6 horas: ${stats.total}`);
      console.log(`✅ Marcados como enviados: ${stats.marked_sent}`);
      console.log(`❌ Con errores registrados: ${stats.with_errors}`);
      
      if (stats.last_event) {
        console.log(`⏰ Último evento: ${new Date(stats.last_event).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}`);
      }
      
      if (stats.marked_sent == 0 && stats.with_errors > 0) {
        console.log('✅ FIX CONFIRMADO: No hay eventos marcados falsamente como enviados');
      }
    }
    
    // 3. Verificar última ubicación Roberto
    console.log('\n📍 TU UBICACIÓN ACTUAL:');
    
    const lastLocation = await pool.query(`
      SELECT latitude, longitude, gps_timestamp, accuracy, battery
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    `);
    
    if (lastLocation.rows.length > 0) {
      const loc = lastLocation.rows[0];
      const lat = parseFloat(loc.latitude);
      const lng = parseFloat(loc.longitude);
      
      // Calcular distancia a oficina
      const officeLat = 25.650648;
      const officeLng = -100.373529;
      const distance = calculateDistance(lat, lng, officeLat, officeLng);
      const isInside = distance <= 15;
      
      console.log(`📍 Coordenadas: ${lat}, ${lng}`);
      console.log(`📏 Distancia a oficina: ${Math.round(distance)} metros`);
      console.log(`🎯 Estado actual: ${isInside ? '🟢 DENTRO del geofence' : '🔴 FUERA del geofence'}`);
      console.log(`⏰ Última actualización: ${new Date(loc.gps_timestamp).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}`);
      console.log(`📱 Batería: ${loc.battery}% | Precisión: ${loc.accuracy}m`);
    } else {
      console.log('❌ No hay ubicaciones recientes');
    }
    
    // 4. Instrucciones para testing
    console.log('\n🧪 INSTRUCCIONES DE TESTING:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. 📱 VERIFICA que tienes Telegram abierto');
    console.log('   - Bot: @pollolocogps_bot');
    console.log('   - Tu ID: 6932484342');
    console.log('');
    console.log('2. 🚶‍♂️ SAL DE LA OFICINA (camina >15m del centro)');
    console.log(`   - Centro: ${office.rows[0].latitude}, ${office.rows[0].longitude}`);
    console.log('   - Radio: 15 metros');
    console.log('   - Camina al menos 20-25 metros del centro para estar seguro');
    console.log('');
    console.log('3. ⏰ ESPERA 1-2 minutos');
    console.log('   - Para que OwnTracks envíe nueva ubicación');
    console.log('   - Sistema detecte el cambio de estado');
    console.log('');
    console.log('4. 🚶‍♂️ REGRESA A LA OFICINA (camina <15m del centro)');
    console.log('   - Vuelve al centro de tu oficina');
    console.log('   - Espera 1-2 minutos más');
    console.log('');
    console.log('5. 📱 VERIFICA ALERTAS EN TELEGRAM');
    console.log('   - Deberías recibir mensaje de SALIDA');
    console.log('   - Deberías recibir mensaje de ENTRADA');
    console.log('');
    console.log('✅ SI RECIBES ALERTAS → FIX EXITOSO');
    console.log('❌ SI NO RECIBES ALERTAS → Reportar problema específico');
    console.log('');
    console.log('📝 DIFERENCIAS ESPERADAS:');
    console.log('   ANTES: Logs mostraban "enviado" pero no llegaban alertas');
    console.log('   AHORA: Solo se marca "enviado" si Telegram confirma entrega');
    
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

verifyFixDeployed();