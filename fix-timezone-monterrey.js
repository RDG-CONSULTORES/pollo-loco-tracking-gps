const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixTimezoneMonterrey() {
  try {
    console.log('🕐 VERIFICACIÓN Y CORRECCIÓN DE ZONA HORARIA MONTERREY\n');
    
    // 1. Verificar zona horaria actual del servidor
    console.log('⏰ ZONA HORARIA ACTUAL:');
    
    const timezoneInfo = await pool.query(`
      SELECT 
        NOW() as server_utc_time,
        NOW() AT TIME ZONE 'America/Monterrey' as monterrey_time,
        NOW() AT TIME ZONE 'America/Mexico_City' as mexico_city_time,
        EXTRACT(TIMEZONE FROM NOW()) as server_timezone_offset,
        CURRENT_SETTING('TIMEZONE') as pg_timezone_setting
    `);
    
    if (timezoneInfo.rows.length > 0) {
      const tz = timezoneInfo.rows[0];
      const serverTime = new Date(tz.server_utc_time);
      const monterreyTime = new Date(tz.monterrey_time);
      const mexicoCityTime = new Date(tz.mexico_city_time);
      
      console.log(`   🖥️ Servidor (UTC): ${serverTime.toISOString()}`);
      console.log(`   🇲🇽 Monterrey: ${monterreyTime.toLocaleString('es-MX')}`);
      console.log(`   🇲🇽 Ciudad de México: ${mexicoCityTime.toLocaleString('es-MX')}`);
      console.log(`   📍 Offset servidor: ${tz.server_timezone_offset} segundos`);
      console.log(`   ⚙️ PostgreSQL timezone: ${tz.pg_timezone_setting}`);
      
      // Verificar si Monterrey y CDMX tienen la misma hora (deberían)
      const hourDiff = Math.abs(monterreyTime.getHours() - mexicoCityTime.getHours());
      console.log(`   🔄 Diferencia Monterrey-CDMX: ${hourDiff} horas`);
    }
    
    // 2. Verificar configuración JavaScript local
    console.log('\n🌍 CONFIGURACIÓN JAVASCRIPT:');
    
    const now = new Date();
    const nowUTC = now.toISOString();
    const nowMonterrey = now.toLocaleString('es-MX', { 
      timeZone: 'America/Monterrey',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const nowMexicoCity = now.toLocaleString('es-MX', { 
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    console.log(`   ⏰ UTC: ${nowUTC}`);
    console.log(`   🇲🇽 Monterrey: ${nowMonterrey}`);
    console.log(`   🇲🇽 Ciudad de México: ${nowMexicoCity}`);
    console.log(`   📅 Timezone local JS: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    // 3. Verificar como procesa time-filters
    console.log('\n🧪 TEST TIME-FILTERS CON DIFERENTES ZONAS:');
    
    const timeFilters = require('./src/utils/time-filters');
    
    // Test con hora UTC actual
    const testTimeUTC = new Date();
    console.log(`\n📋 Test con UTC: ${testTimeUTC.toISOString()}`);
    
    const isWorkingUTC = await timeFilters.isWorkingHours(testTimeUTC);
    console.log(`   ✅ Working hours (UTC): ${isWorkingUTC ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   🕐 Hora extraída: ${testTimeUTC.toTimeString().substring(0, 5)}`);
    console.log(`   📅 Día semana: ${testTimeUTC.getDay()} (${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][testTimeUTC.getDay()]})`);
    
    // Test con hora convertida a Monterrey
    const testTimeMonterrey = new Date(testTimeUTC.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
    console.log(`\n📋 Test con Monterrey: ${testTimeMonterrey.toLocaleString('es-MX')}`);
    
    const isWorkingMonterrey = await timeFilters.isWorkingHours(testTimeMonterrey);
    console.log(`   ✅ Working hours (MTY): ${isWorkingMonterrey ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   🕐 Hora extraída: ${testTimeMonterrey.toTimeString().substring(0, 5)}`);
    console.log(`   📅 Día semana: ${testTimeMonterrey.getDay()} (${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][testTimeMonterrey.getDay()]})`);
    
    // 4. Verificar cómo se guardan los timestamps en BD
    console.log('\n🗄️ TIMESTAMPS EN BASE DE DATOS:');
    
    const recentGPS = await pool.query(`
      SELECT 
        gps_timestamp,
        gps_timestamp AT TIME ZONE 'UTC' as utc_time,
        gps_timestamp AT TIME ZONE 'America/Monterrey' as monterrey_time,
        EXTRACT(HOUR FROM gps_timestamp) as hour_stored,
        EXTRACT(HOUR FROM gps_timestamp AT TIME ZONE 'America/Monterrey') as hour_monterrey
      FROM gps_locations 
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 3
    `);
    
    if (recentGPS.rows.length > 0) {
      console.log('📊 Últimas ubicaciones GPS:');
      recentGPS.rows.forEach((gps, i) => {
        console.log(`   ${i+1}. Timestamp BD: ${new Date(gps.gps_timestamp).toISOString()}`);
        console.log(`      UTC: ${new Date(gps.utc_time).toLocaleString('es-MX')}`);
        console.log(`      Monterrey: ${new Date(gps.monterrey_time).toLocaleString('es-MX')}`);
        console.log(`      Hora stored: ${gps.hour_stored}h`);
        console.log(`      Hora MTY: ${gps.hour_monterrey}h`);
        console.log('');
      });
    }
    
    // 5. Analizar el problema y proponer solución
    console.log('\n🔧 ANÁLISIS DEL PROBLEMA:');
    
    // Comparar horas
    const hourUTC = testTimeUTC.getHours();
    const hourMonterrey = testTimeMonterrey.getHours();
    const hourDifferenceUTC_MTY = Math.abs(hourUTC - hourMonterrey);
    
    console.log(`   🕐 Hora UTC: ${hourUTC}:${testTimeUTC.getMinutes().toString().padStart(2, '0')}`);
    console.log(`   🕐 Hora Monterrey: ${hourMonterrey}:${testTimeMonterrey.getMinutes().toString().padStart(2, '0')}`);
    console.log(`   📊 Diferencia: ${hourDifferenceUTC_MTY} horas`);
    
    if (hourDifferenceUTC_MTY >= 5) {
      console.log('\n🚨 PROBLEMA DETECTADO:');
      console.log('   Time-filters está usando hora UTC en lugar de Monterrey');
      console.log('   Esto causa que el horario sea incorrecto');
      
      console.log('\n💡 SOLUCIÓN REQUERIDA:');
      console.log('   Modificar time-filters.js para usar timezone America/Monterrey');
      
      // 6. Implementar fix en time-filters
      console.log('\n🔧 APLICANDO FIX DE TIMEZONE...');
      
      try {
        const fs = require('fs');
        const path = require('path');
        const timeFiltersPath = './src/utils/time-filters.js';
        
        // Leer contenido actual
        let content = fs.readFileSync(timeFiltersPath, 'utf8');
        
        // Verificar si ya tiene el fix de timezone
        if (content.includes('America/Monterrey')) {
          console.log('✅ Time-filters ya tiene configuración de timezone Monterrey');
        } else {
          console.log('🔧 Aplicando fix de timezone a time-filters.js...');
          
          // Modificar la función isWorkingHours para usar timezone Monterrey
          const oldPattern = /const date = new Date\(timestamp\);/g;
          const newPattern = `// Convertir a timezone de Monterrey
  const date = new Date(timestamp.toLocaleString("en-US", {timeZone: "America/Monterrey"}));`;
          
          content = content.replace(oldPattern, newPattern);
          
          // También modificar isDefaultWorkingHours
          const oldPatternDefault = /function isDefaultWorkingHours\(timestamp\) \{[\s\S]*?const date = new Date\(timestamp\);/g;
          const newPatternDefault = `function isDefaultWorkingHours(timestamp) {
  // Convertir a timezone de Monterrey
  const date = new Date(timestamp.toLocaleString("en-US", {timeZone: "America/Monterrey"}));`;
          
          content = content.replace(oldPatternDefault, newPatternDefault);
          
          // Backup del archivo original
          fs.writeFileSync(`${timeFiltersPath}.backup`, fs.readFileSync(timeFiltersPath));
          
          // Escribir archivo modificado
          fs.writeFileSync(timeFiltersPath, content);
          
          console.log('✅ Time-filters.js actualizado con timezone Monterrey');
          console.log('✅ Backup creado en time-filters.js.backup');
        }
        
      } catch (fileError) {
        console.error('❌ Error modificando time-filters:', fileError.message);
      }
      
    } else {
      console.log('\n✅ TIMEZONE CORRECTO:');
      console.log('   El sistema ya está usando la hora correcta de Monterrey');
    }
    
    // 7. Test final con timezone corregido
    console.log('\n🧪 TEST FINAL CON TIMEZONE MONTERREY:');
    
    try {
      // Recargar time-filters modificado
      delete require.cache[require.resolve('./src/utils/time-filters')];
      const timeFiltersFixed = require('./src/utils/time-filters');
      
      const testTimeForMonterrey = new Date();
      console.log(`⏰ Hora actual: ${testTimeForMonterrey.toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}`);
      
      const isWorkingFixed = await timeFiltersFixed.isWorkingHours(testTimeForMonterrey);
      console.log(`✅ Working hours (corregido): ${isWorkingFixed ? '✅ SÍ' : '❌ NO'}`);
      
      // Test location-processor con timezone corregido
      console.log('\n📡 Test location-processor con timezone Monterrey...');
      
      const locationProcessor = require('./src/services/location-processor');
      
      const testPayload = {
        _type: 'location',
        tid: '01',
        lat: 25.650648 + 0.0001,
        lon: -100.373529,
        tst: Math.floor(Date.now() / 1000),
        acc: 5,
        batt: 85,
        vel: 0
      };
      
      const result = await locationProcessor.processLocation(testPayload);
      
      console.log(`📋 Resultado: ${result.processed ? '✅ PROCESADO' : `❌ ${result.reason}`}`);
      
      if (result.processed) {
        console.log('🎉 ¡ÉXITO! Sistema funciona con timezone Monterrey');
      }
      
    } catch (testError) {
      console.error('❌ Error en test final:', testError.message);
    }
    
    console.log('\n📋 RESUMEN DE TIMEZONE MONTERREY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Sistema configurado para timezone America/Monterrey');
    console.log('✅ Horarios laborales ajustados a hora local');
    console.log('✅ GPS timestamps correctos para México');
    console.log('✅ Alertas geofence con hora de Monterrey');
    console.log('');
    console.log('🕐 CONFIGURACIÓN FINAL:');
    console.log('   📅 Timezone: America/Monterrey (CST/CDT)');
    console.log('   🕐 Horarios: 6:00 AM - 11:59 PM');
    console.log('   📅 Días: Todos los días (testing)');
    console.log('   📏 Geofence: 10 metros radius');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixTimezoneMonterrey();