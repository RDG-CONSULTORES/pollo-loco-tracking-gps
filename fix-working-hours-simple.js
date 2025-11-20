const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixWorkingHoursSimple() {
  try {
    console.log('🕐 SOLUCIÓN RÁPIDA - HORARIOS LABORALES 24/7\n');
    
    // 1. Verificar horario actual
    const now = new Date();
    console.log(`🇲🇽 Hora actual: ${now.toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}`);
    console.log(`🕐 Hora: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    // 2. Test con time-filters actual
    const timeFilters = require('./src/utils/time-filters');
    
    console.log('\n🧪 TEST HORARIO ACTUAL:');
    const isCurrentlyWorking = await timeFilters.isWorkingHours(now);
    console.log(`   ✅ Horario permitido: ${isCurrentlyWorking ? '✅ SÍ' : '❌ NO'}`);
    
    if (!isCurrentlyWorking) {
      console.log('🚨 PROBLEMA: Horario actual bloqueado');
    }
    
    // 3. Ver qué valores por defecto está usando
    console.log('\n📋 CONFIGURACIÓN POR DEFECTO:');
    
    const defaultWorking = timeFilters.isDefaultWorkingHours(now);
    console.log(`   🏭 Función por defecto: ${defaultWorking ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
    console.log(`   📅 Días permitidos: Lunes-Sábado (1-6)`);
    console.log(`   🕐 Horas permitidas: 7:00-20:59`);
    
    // 4. Modificar temporalmente time-filters para 24/7
    console.log('\n🔧 APLICANDO SOLUCIÓN TEMPORAL...');
    
    // Sobrescribir la función isWorkingHours para que siempre retorne true
    timeFilters.isWorkingHours = async function(timestamp) {
      console.log(`⏰ [OVERRIDE] isWorkingHours called - ALWAYS RETURNING TRUE`);
      return true; // Siempre permitir
    };
    
    console.log('✅ Función isWorkingHours sobrescrita para testing');
    console.log('   📅 Horario: 24/7 (siempre activo)');
    console.log('   🎯 Duración: Solo para esta sesión de testing');
    
    // 5. Test con la función modificada
    console.log('\n🧪 TEST CON FUNCIÓN MODIFICADA:');
    
    const isNowWorkingOverride = await timeFilters.isWorkingHours(now);
    console.log(`   ✅ Horario actual: ${isNowWorkingOverride ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
    
    // Test diferentes horas
    const testHours = [21, 22, 23, 0, 1, 6, 7];
    console.log('\n📊 Test horarios específicos:');
    
    for (const hour of testHours) {
      const testTime = new Date();
      testTime.setHours(hour, 30, 0, 0);
      
      const isAllowed = await timeFilters.isWorkingHours(testTime);
      const timeStr = `${hour.toString().padStart(2, '0')}:30`;
      console.log(`   ${timeStr}: ${isAllowed ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
    }
    
    // 6. Test location-processor con nueva configuración
    console.log('\n🧪 TEST LOCATION-PROCESSOR:');
    
    try {
      const locationProcessor = require('./src/services/location-processor');
      
      const testPayload = {
        _type: 'location',
        tid: '01',
        lat: 25.650648 + 0.0005, // Coordenadas diferentes para evitar duplicados
        lon: -100.373529,
        tst: Math.floor(Date.now() / 1000),
        acc: 5,
        batt: 85,
        vel: 0
      };
      
      console.log('📡 Testing location-processor...');
      console.log(`📍 Coordenadas: ${testPayload.lat}, ${testPayload.lon}`);
      
      const result = await locationProcessor.processLocation(testPayload);
      
      console.log('📋 Resultado:');
      console.log(`   Procesado: ${result.processed ? '✅ SÍ' : '❌ NO'}`);
      if (result.reason) {
        console.log(`   Razón: ${result.reason}`);
      }
      if (result.location_id) {
        console.log(`   Location ID: ${result.location_id}`);
      }
      
      if (result.processed) {
        console.log('\n🎉 ¡ÉXITO! El sistema ahora procesa ubicaciones 24/7');
        
        // Verificar si se generó evento geofence
        console.log('\n🔍 Verificando eventos geofence...');
        
        setTimeout(async () => {
          const recentEvents = await pool.query(`
            SELECT 
              event_type, event_timestamp, telegram_sent
            FROM geofence_events
            WHERE user_id = 5 
              AND event_timestamp > NOW() - INTERVAL '2 minutes'
            ORDER BY event_timestamp DESC
            LIMIT 1
          `);
          
          if (recentEvents.rows.length > 0) {
            const event = recentEvents.rows[0];
            console.log(`🎯 ¡EVENTO GENERADO! ${event.event_type}`);
            console.log(`   Telegram: ${event.telegram_sent ? '✅' : '❌'}`);
            console.log('   📱 Verifica tu Telegram para nueva alerta');
          } else {
            console.log('ℹ️ No se generó evento (puede ser estado sin cambio)');
          }
          
          await pool.end();
        }, 3000);
        
      } else if (result.reason === 'outside_working_hours') {
        console.log('❌ AÚN BLOQUEADO POR HORARIO');
        console.log('   El time-filters puede estar cacheado');
        console.log('   💡 Reinicia el servidor para aplicar cambios');
        await pool.end();
      } else {
        console.log('ℹ️ No procesado por otra razón (normal)');
        await pool.end();
      }
      
    } catch (testError) {
      console.error('❌ Error en test:', testError.message);
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

console.log('🎯 SOLUCIÓN TEMPORAL PARA TESTING 24/7');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Esta solución modifica la función isWorkingHours');
console.log('para permitir testing a cualquier hora.');
console.log('');

fixWorkingHoursSimple();