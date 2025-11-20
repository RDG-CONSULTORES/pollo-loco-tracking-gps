const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTimeRestrictions() {
  try {
    console.log('🕐 ANÁLISIS DE RESTRICCIONES DE HORARIO\n');
    
    // 1. Verificar zona horaria del servidor
    console.log('⏰ INFORMACIÓN DE ZONA HORARIA:');
    
    const timezoneInfo = await pool.query(`
      SELECT 
        NOW() as server_time,
        EXTRACT(TIMEZONE FROM NOW()) as timezone_offset,
        to_char(NOW(), 'TZ') as timezone_name,
        NOW() AT TIME ZONE 'America/Monterrey' as monterrey_time
    `);
    
    if (timezoneInfo.rows.length > 0) {
      const tz = timezoneInfo.rows[0];
      console.log(`   🖥️ Hora del servidor: ${new Date(tz.server_time).toLocaleString('es-MX')}`);
      console.log(`   🇲🇽 Hora Monterrey: ${new Date(tz.monterrey_time).toLocaleString('es-MX')}`);
      console.log(`   📍 Offset timezone: ${tz.timezone_offset} segundos`);
      console.log(`   🌍 Timezone name: ${tz.timezone_name}`);
    }
    
    // 2. Buscar archivo de filtros de tiempo
    console.log('\n🔍 BUSCANDO RESTRICCIONES DE HORARIO...');
    
    try {
      const timeFilters = require('./src/utils/time-filters');
      
      console.log('✅ Encontrado archivo time-filters.js');
      
      // Test horarios específicos
      const testTimes = [
        new Date('2025-11-20T21:30:00-06:00'), // 9:30 PM Monterrey
        new Date('2025-11-20T22:00:00-06:00'), // 10:00 PM Monterrey  
        new Date('2025-11-20T08:00:00-06:00'), // 8:00 AM Monterrey
        new Date('2025-11-20T18:00:00-06:00'), // 6:00 PM Monterrey
        new Date('2025-11-20T12:00:00-06:00'), // 12:00 PM Monterrey
      ];
      
      console.log('\n🧪 TEST DE HORARIOS ESPECÍFICOS:');
      testTimes.forEach(testTime => {
        const isWorking = timeFilters.isWorkingHours(testTime);
        const timeStr = testTime.toLocaleString('es-MX', {
          timeZone: 'America/Monterrey',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        console.log(`   ${timeStr}: ${isWorking ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
      });
      
      // Test hora actual
      const now = new Date();
      const isCurrentlyWorking = timeFilters.isWorkingHours(now);
      const currentTimeStr = now.toLocaleString('es-MX', {
        timeZone: 'America/Monterrey',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      console.log(`\n⏰ HORA ACTUAL (${currentTimeStr}): ${isCurrentlyWorking ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
      
      if (!isCurrentlyWorking) {
        console.log('🚨 ¡ESTE ES EL PROBLEMA! El sistema está en horario no laboral');
        console.log('   Las ubicaciones GPS se procesan pero se descartan por filtro de tiempo');
      }
      
    } catch (filterError) {
      console.log('❌ No se encontró archivo time-filters.js o error cargándolo');
      console.log(`   Error: ${filterError.message}`);
    }
    
    // 3. Verificar configuraciones de sistema activo
    console.log('\n⚙️ CONFIGURACIONES DEL SISTEMA:');
    
    try {
      // Buscar en diferentes tablas posibles
      const systemConfigs = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE '%config%'
      `);
      
      console.log(`📊 Tablas de configuración encontradas: ${systemConfigs.rows.length}`);
      systemConfigs.rows.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      
    } catch (configError) {
      console.log('❌ Error buscando configuraciones:', configError.message);
    }
    
    // 4. Analizar location-processor para restricciones de tiempo
    console.log('\n📄 ANALIZANDO LOCATION-PROCESSOR...');
    
    try {
      const fs = require('fs');
      const locationProcessorPath = './src/services/location-processor.js';
      
      if (fs.existsSync(locationProcessorPath)) {
        const content = fs.readFileSync(locationProcessorPath, 'utf8');
        
        // Buscar líneas relacionadas con horario
        const timeRelatedLines = content.split('\n').filter((line, index) => {
          return line.toLowerCase().includes('working') || 
                 line.toLowerCase().includes('hours') ||
                 line.toLowerCase().includes('time') ||
                 line.toLowerCase().includes('horario');
        });
        
        if (timeRelatedLines.length > 0) {
          console.log('🔍 Líneas relacionadas con horario en location-processor:');
          timeRelatedLines.forEach((line, i) => {
            console.log(`   ${i+1}. ${line.trim()}`);
          });
        } else {
          console.log('❌ No se encontraron restricciones de horario evidentes');
        }
        
        // Buscar específicamente la función isWorkingHours
        if (content.includes('isWorkingHours')) {
          console.log('\n🎯 ¡ENCONTRADO! El location-processor usa isWorkingHours()');
          
          // Extraer el bloque de código relevante
          const lines = content.split('\n');
          const workingHoursIndex = lines.findIndex(line => line.includes('isWorkingHours'));
          
          if (workingHoursIndex !== -1) {
            console.log('\n📋 Código de verificación de horario:');
            for (let i = Math.max(0, workingHoursIndex - 2); i <= Math.min(lines.length - 1, workingHoursIndex + 5); i++) {
              const lineNum = i + 1;
              const marker = i === workingHoursIndex ? '➤' : ' ';
              console.log(`   ${marker} ${lineNum}: ${lines[i]}`);
            }
          }
        }
        
      } else {
        console.log('❌ No se encontró location-processor.js');
      }
      
    } catch (fsError) {
      console.log('❌ Error leyendo location-processor:', fsError.message);
    }
    
    // 5. Test simulado de procesamiento con hora actual
    console.log('\n🧪 TEST CON HORA ACTUAL:');
    
    try {
      const locationProcessor = require('./src/services/location-processor');
      
      const testPayload = {
        _type: 'location',
        tid: '01',
        lat: 25.650648,
        lon: -100.373529,
        tst: Math.floor(Date.now() / 1000),
        acc: 5,
        batt: 85,
        vel: 0
      };
      
      console.log('📡 Simulando procesamiento con horario actual...');
      const now = new Date();
      console.log(`⏰ Timestamp: ${now.toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}`);
      
      const result = await locationProcessor.processLocation(testPayload);
      
      console.log('📋 Resultado:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.reason === 'outside_working_hours') {
        console.log('\n🚨 ¡CONFIRMADO! El problema son las restricciones de horario');
        console.log('   El sistema rechaza ubicaciones fuera del horario laboral');
      }
      
    } catch (processError) {
      console.log('❌ Error en test de procesamiento:', processError.message);
    }
    
    // 6. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const currentHour = new Date().getHours();
    
    if (currentHour >= 21 || currentHour <= 6) {
      console.log('🕘 PROBLEMA IDENTIFICADO: Horario fuera del laboral');
      console.log('');
      console.log('📝 SOLUCIONES:');
      console.log('   1. 🕐 Hacer pruebas entre 7:00 AM y 8:00 PM');
      console.log('   2. 🔧 Deshabilitar temporalmente filtros de horario');
      console.log('   3. ⚙️ Configurar horarios extendidos para testing');
      console.log('   4. 🚀 Usar bypass directo del geofence-engine (como hicimos)');
    } else {
      console.log('✅ HORARIO ACTUAL: Dentro del horario laboral probable');
      console.log('   El problema puede ser otro (duplicados, configuración, etc.)');
    }
    
    console.log('\n🎯 PRÓXIMO PASO:');
    console.log('   Revisar y ajustar time-filters.js para permitir pruebas nocturnas');
    
  } catch (error) {
    console.error('❌ Error en análisis:', error.message);
  } finally {
    await pool.end();
  }
}

checkTimeRestrictions();