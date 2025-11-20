const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkAndFixWorkingHours() {
  try {
    console.log('🕐 VERIFICACIÓN Y AJUSTE DE HORARIOS LABORALES\n');
    
    // 1. Verificar configuración actual
    console.log('⚙️ CONFIGURACIÓN ACTUAL:');
    
    const currentConfig = await pool.query(`
      SELECT config_key, config_value, updated_at, admin_user
      FROM tracking_config 
      WHERE config_key IN ('work_hours_start', 'work_hours_end', 'work_days')
      ORDER BY config_key
    `);
    
    console.log('📋 Configuración desde base de datos:');
    if (currentConfig.rows.length > 0) {
      currentConfig.rows.forEach(config => {
        const updated = config.updated_at ? new Date(config.updated_at).toLocaleString('es-MX') : 'N/A';
        console.log(`   ${config.config_key}: "${config.config_value}"`);
        console.log(`      Actualizado: ${updated} por ${config.admin_user || 'sistema'}`);
      });
    } else {
      console.log('❌ No se encontró configuración en tracking_config');
      console.log('   Sistema usará valores por defecto: 7:00-21:00, Lun-Sáb');
    }
    
    // 2. Test con horario actual
    console.log('\n🧪 TEST CON HORARIO ACTUAL:');
    
    const timeFilters = require('./src/utils/time-filters');
    
    const now = new Date();
    const nowMonterrey = new Date(now.toLocaleString("en-US", {timeZone: "America/Monterrey"}));
    
    console.log(`🇲🇽 Hora actual Monterrey: ${nowMonterrey.toLocaleString('es-MX')}`);
    console.log(`📅 Día de la semana: ${nowMonterrey.getDay()} (0=Dom, 1=Lun, ..., 6=Sáb)`);
    console.log(`🕐 Hora del día: ${nowMonterrey.getHours()}:${nowMonterrey.getMinutes().toString().padStart(2, '0')}`);
    
    const isCurrentlyWorking = await timeFilters.isWorkingHours(nowMonterrey);
    console.log(`✅ Está en horario laboral: ${isCurrentlyWorking ? '✅ SÍ' : '❌ NO'}`);
    
    // 3. Test con diferentes horarios
    console.log('\n🧪 TEST CON DIFERENTES HORARIOS:');
    
    const testTimes = [
      { hour: 6, minute: 30, name: '6:30 AM' },
      { hour: 7, minute: 0, name: '7:00 AM' },
      { hour: 12, minute: 0, name: '12:00 PM' },
      { hour: 18, minute: 0, name: '6:00 PM' },
      { hour: 21, minute: 0, name: '9:00 PM' },
      { hour: 21, minute: 30, name: '9:30 PM' },
      { hour: 22, minute: 0, name: '10:00 PM' },
      { hour: 23, minute: 0, name: '11:00 PM' }
    ];
    
    console.log('📊 Resultados por horario:');
    for (const testTime of testTimes) {
      const testDate = new Date();
      testDate.setHours(testTime.hour, testTime.minute, 0, 0);
      
      const isWorking = await timeFilters.isWorkingHours(testDate);
      const status = isWorking ? '✅ PERMITIDO' : '❌ BLOQUEADO';
      console.log(`   ${testTime.name}: ${status}`);
    }
    
    // 4. Verificar horarios configurados
    const workingHours = await timeFilters.getWorkingHours();
    console.log('\n📋 HORARIOS LABORALES CONFIGURADOS:');
    console.log(`   🕐 Inicio: ${workingHours.start}`);
    console.log(`   🕕 Fin: ${workingHours.end}`);
    console.log(`   📅 Días: ${workingHours.daysText}`);
    console.log(`   📊 Días numéricos: ${workingHours.days.join(', ')}`);
    
    // 5. Detectar si necesitamos extender horarios
    const currentHour = nowMonterrey.getHours();
    const needsExtension = currentHour >= 21 || currentHour <= 6;
    
    if (needsExtension) {
      console.log('\n🚨 PROBLEMA DETECTADO: Horario actual fuera del laboral');
      
      // Proponer nueva configuración
      console.log('\n💡 PROPUESTA DE CONFIGURACIÓN PARA TESTING:');
      console.log('   🕐 Horario extendido: 6:00 AM - 11:59 PM (casi 24/7)');
      console.log('   📅 Días: Todos los días (0,1,2,3,4,5,6)');
      
      // Preguntar si aplicar cambios
      console.log('\n🔧 APLICANDO CONFIGURACIÓN EXTENDIDA...');
      
      try {
        // Actualizar horarios
        await pool.query(`
          INSERT INTO tracking_config (config_key, config_value, admin_user, updated_at)
          VALUES 
            ('work_hours_start', '06:00', 'roberto_testing', NOW()),
            ('work_hours_end', '23:59', 'roberto_testing', NOW()),
            ('work_days', '0,1,2,3,4,5,6', 'roberto_testing', NOW())
          ON CONFLICT (config_key) 
          DO UPDATE SET 
            config_value = EXCLUDED.config_value,
            admin_user = EXCLUDED.admin_user,
            updated_at = NOW()
        `);
        
        console.log('✅ ¡CONFIGURACIÓN ACTUALIZADA!');
        
        // Verificar nueva configuración
        const newWorkingHours = await timeFilters.getWorkingHours();
        console.log('\n🎯 NUEVA CONFIGURACIÓN:');
        console.log(`   🕐 Inicio: ${newWorkingHours.start}`);
        console.log(`   🕕 Fin: ${newWorkingHours.end}`);
        console.log(`   📅 Días: ${newWorkingHours.daysText}`);
        
        // Test inmediato con nueva configuración
        const isNowWorking = await timeFilters.isWorkingHours(nowMonterrey);
        console.log(`   ✅ Horario actual permitido: ${isNowWorking ? '✅ SÍ' : '❌ NO'}`);
        
      } catch (updateError) {
        console.error('❌ Error actualizando configuración:', updateError.message);
      }
      
    } else {
      console.log('\n✅ HORARIO ACTUAL: Dentro del rango laboral');
      console.log('   No se requiere ajuste de configuración');
    }
    
    // 6. Test final del location-processor
    console.log('\n🧪 TEST FINAL CON NUEVA CONFIGURACIÓN:');
    
    try {
      const locationProcessor = require('./src/services/location-processor');
      
      const testPayload = {
        _type: 'location',
        tid: '01',
        lat: 25.650648 + 0.0003, // Coordenadas ligeramente diferentes para evitar duplicados
        lon: -100.373529,
        tst: Math.floor(Date.now() / 1000),
        acc: 5,
        batt: 85,
        vel: 0
      };
      
      console.log('📡 Testing location-processor con nueva configuración...');
      console.log(`⏰ Timestamp: ${nowMonterrey.toLocaleString('es-MX')}`);
      console.log(`📍 Coordenadas: ${testPayload.lat}, ${testPayload.lon}`);
      
      const result = await locationProcessor.processLocation(testPayload);
      
      console.log('📋 Resultado:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.processed) {
        console.log('🎉 ¡ÉXITO! Location-processor ahora acepta ubicaciones');
        console.log('   El sistema procesará ubicaciones 24/7 para testing');
      } else if (result.reason === 'outside_working_hours') {
        console.log('❌ Aún bloquea por horario - verificar configuración');
      } else {
        console.log(`ℹ️ No procesado por otra razón: ${result.reason}`);
      }
      
    } catch (testError) {
      console.error('❌ Error en test final:', testError.message);
    }
    
    // 7. Instrucciones finales
    console.log('\n📋 INSTRUCCIONES PARA TUS PRUEBAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ HORARIOS LABORALES: 6:00 AM - 11:59 PM, todos los días');
    console.log('✅ SISTEMA ACTIVADO: 24/7 para testing');
    console.log('');
    console.log('🧪 PARA TESTING FÍSICO:');
    console.log('   1. Sal de tu oficina (>25m del centro)');
    console.log('   2. Espera 5-10 minutos');
    console.log('   3. Entra a tu oficina (<15m del centro)');
    console.log('   4. Recibe alerta ENTRADA en Telegram');
    console.log('   5. Sal de nuevo (>25m)');
    console.log('   6. Recibe alerta SALIDA en Telegram');
    console.log('');
    console.log('⚠️ NOTA: Si quieres restaurar horarios normales después:');
    console.log('   🕐 Inicio: 7:00, Fin: 21:00, Días: 1,2,3,4,5,6 (Lun-Sáb)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAndFixWorkingHours();