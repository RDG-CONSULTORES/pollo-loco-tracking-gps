const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function forceEntryTest() {
  try {
    console.log('🧪 FORZAR TEST DE ENTRADA - COORDENADAS EXACTAS\n');
    
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    
    console.log('📍 Coordenadas para test inmediato:');
    console.log(`   🎯 Centro oficina: ${officeLat}, ${officeLng}`);
    console.log('');
    console.log('🚶‍♂️ COORDENADAS PARA PROBAR:');
    console.log('');
    console.log('🟢 PARA ENTRADA INMEDIATA (dentro de 20m):');
    console.log(`   📍 ${officeLat + 0.0001}, ${officeLng + 0.0001} (≈11m del centro)`);
    console.log(`   📍 ${officeLat - 0.0001}, ${officeLng - 0.0001} (≈11m del centro)`);
    console.log(`   📍 ${officeLat}, ${officeLng + 0.00005} (≈6m del centro)`);
    console.log(`   📍 ${officeLat}, ${officeLng} (0m del centro - EXACTO)`);
    console.log('');
    console.log('🔴 PARA SALIDA INMEDIATA (fuera de 20m):');
    console.log(`   📍 ${officeLat + 0.0002}, ${officeLng} (≈22m del centro)`);
    console.log(`   📍 ${officeLat}, ${officeLng + 0.0002} (≈22m del centro)`);
    console.log(`   📍 ${officeLat - 0.0002}, ${officeLng - 0.0002} (≈31m del centro)`);
    
    // Test directo con coordenadas dentro del geofence
    console.log('\n🧪 TEST 1: Simulando ENTRADA inmediata...');
    
    try {
      const locationProcessor = require('./src/services/location-processor');
      
      // Coordenadas EXACTAS del centro de la oficina
      const entryPayload = {
        _type: 'location',
        tid: '01',
        lat: officeLat,           // Coordenadas EXACTAS del centro
        lon: officeLng,           // 0m de distancia = DENTRO
        tst: Math.floor(Date.now() / 1000),
        acc: 5,
        batt: 85,
        vel: 0
      };
      
      console.log('📡 Enviando coordenadas del CENTRO EXACTO...');
      console.log(`   📍 ${entryPayload.lat}, ${entryPayload.lon}`);
      
      const entryResult = await locationProcessor.processLocation(entryPayload);
      
      console.log('📋 Resultado entrada:');
      console.log(JSON.stringify(entryResult, null, 2));
      
      if (entryResult.processed) {
        console.log('✅ ¡ENTRADA PROCESADA!');
        
        // Verificar evento inmediatamente
        setTimeout(async () => {
          const entryCheck = await pool.query(`
            SELECT 
              event_type, event_timestamp, distance_from_center, 
              telegram_sent, telegram_sent_at
            FROM geofence_events
            WHERE user_id = 5 
              AND event_timestamp > NOW() - INTERVAL '1 minute'
              AND event_type = 'enter'
            ORDER BY event_timestamp DESC
            LIMIT 1
          `);
          
          if (entryCheck.rows.length > 0) {
            const event = entryCheck.rows[0];
            const time = new Date(event.event_timestamp).toLocaleTimeString('es-MX');
            console.log(`🎯 ¡ENTRADA CONFIRMADA! ${time}`);
            console.log(`   📏 Distancia: ${event.distance_from_center}m`);
            console.log(`   📱 Telegram: ${event.telegram_sent ? '✅ ENVIADO' : '❌ PENDIENTE'}`);
            
            if (event.telegram_sent_at) {
              const telegramTime = new Date(event.telegram_sent_at).toLocaleTimeString('es-MX');
              console.log(`   ⏰ Enviado a: ${telegramTime}`);
            }
          } else {
            console.log('❌ No se generó evento de entrada');
          }
          
          // Ahora test de SALIDA
          console.log('\n🧪 TEST 2: Simulando SALIDA inmediata...');
          
          const exitPayload = {
            _type: 'location',
            tid: '01',
            lat: officeLat + 0.0002,  // ≈22m del centro = FUERA
            lon: officeLng,
            tst: Math.floor(Date.now() / 1000) + 1, // +1 segundo para evitar duplicados
            acc: 5,
            batt: 85,
            vel: 0
          };
          
          console.log('📡 Enviando coordenadas FUERA del geofence...');
          console.log(`   📍 ${exitPayload.lat}, ${exitPayload.lon}`);
          
          const exitResult = await locationProcessor.processLocation(exitPayload);
          
          console.log('📋 Resultado salida:');
          console.log(JSON.stringify(exitResult, null, 2));
          
          if (exitResult.processed) {
            console.log('✅ ¡SALIDA PROCESADA!');
            
            setTimeout(async () => {
              const exitCheck = await pool.query(`
                SELECT 
                  event_type, event_timestamp, distance_from_center, 
                  telegram_sent, telegram_sent_at
                FROM geofence_events
                WHERE user_id = 5 
                  AND event_timestamp > NOW() - INTERVAL '1 minute'
                  AND event_type = 'exit'
                ORDER BY event_timestamp DESC
                LIMIT 1
              `);
              
              if (exitCheck.rows.length > 0) {
                const event = exitCheck.rows[0];
                const time = new Date(event.event_timestamp).toLocaleTimeString('es-MX');
                console.log(`🎯 ¡SALIDA CONFIRMADA! ${time}`);
                console.log(`   📏 Distancia: ${event.distance_from_center}m`);
                console.log(`   📱 Telegram: ${event.telegram_sent ? '✅ ENVIADO' : '❌ PENDIENTE'}`);
                
                if (event.telegram_sent_at) {
                  const telegramTime = new Date(event.telegram_sent_at).toLocaleTimeString('es-MX');
                  console.log(`   ⏰ Enviado a: ${telegramTime}`);
                }
              } else {
                console.log('❌ No se generó evento de salida');
              }
              
              console.log('\n📱 VERIFICA TU TELEGRAM AHORA');
              console.log('   Deberías tener 2 alertas nuevas:');
              console.log('   🟢 ENTRADA DETECTADA');
              console.log('   🔴 SALIDA DETECTADA');
              
              await pool.end();
            }, 2000);
            
          } else {
            console.log(`❌ Salida no procesada: ${exitResult.reason}`);
            await pool.end();
          }
          
        }, 2000);
        
      } else {
        console.log(`❌ Entrada no procesada: ${entryResult.reason}`);
        await pool.end();
      }
      
    } catch (error) {
      console.error('❌ Error en test:', error.message);
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

forceEntryTest();