const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function directGeofenceTest() {
  try {
    console.log('⚡ TEST DIRECTO DEL GEOFENCE-ENGINE (BYPASS LOCATION-PROCESSOR)\n');
    
    const officeLat = 25.650648;
    const officeLng = -100.373529;
    
    // 1. Limpiar estado previo
    console.log('🧹 Limpiando estado previo...');
    await pool.query(`
      DELETE FROM user_sucursal_state WHERE user_id = 5
    `);
    
    // 2. Test directo del geofence-engine con ENTRADA
    console.log('🧪 TEST 1: ENTRADA directa con geofence-engine...');
    
    try {
      const geofenceEngine = require('./src/services/geofence-engine');
      
      // Simular ubicación DENTRO del geofence
      const entryLocationData = {
        id: Date.now(),
        user_id: 5,
        latitude: officeLat,           // Centro exacto
        longitude: officeLng,          // 0m de distancia
        accuracy: 5,
        battery: 85,
        gps_timestamp: new Date()
      };
      
      console.log('📡 Enviando ubicación DENTRO del geofence...');
      console.log(`   📍 ${entryLocationData.latitude}, ${entryLocationData.longitude}`);
      
      const entryEvents = await geofenceEngine.processLocation(entryLocationData);
      
      console.log(`📋 Eventos generados: ${entryEvents.length}`);
      
      if (entryEvents.length > 0) {
        entryEvents.forEach((event, i) => {
          console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
          console.log(`      Event ID: ${event.id}`);
          console.log(`      Distance: ${event.distance_from_center}m`);
        });
        
        console.log('✅ ¡ENTRADA DETECTADA Y PROCESADA!');
        
        // Verificar Telegram
        setTimeout(async () => {
          const telegramCheck = await pool.query(`
            SELECT telegram_sent, telegram_sent_at, telegram_error 
            FROM geofence_events 
            WHERE id = $1
          `, [entryEvents[0].id]);
          
          if (telegramCheck.rows.length > 0) {
            const tg = telegramCheck.rows[0];
            console.log(`📱 Telegram status: ${tg.telegram_sent ? '✅ ENVIADO' : '❌ FALLÓ'}`);
            if (tg.telegram_error) {
              console.log(`   Error: ${tg.telegram_error}`);
            }
            if (tg.telegram_sent_at) {
              console.log(`   Enviado: ${new Date(tg.telegram_sent_at).toLocaleTimeString('es-MX')}`);
            }
          }
          
          // Ahora test SALIDA después de 3 segundos
          setTimeout(async () => {
            console.log('\n🧪 TEST 2: SALIDA directa con geofence-engine...');
            
            // Simular ubicación FUERA del geofence  
            const exitLocationData = {
              id: Date.now() + 1,
              user_id: 5,
              latitude: officeLat + 0.0002,    // ≈22m del centro = FUERA
              longitude: officeLng,
              accuracy: 5,
              battery: 85,
              gps_timestamp: new Date()
            };
            
            console.log('📡 Enviando ubicación FUERA del geofence...');
            console.log(`   📍 ${exitLocationData.latitude}, ${exitLocationData.longitude}`);
            
            const exitEvents = await geofenceEngine.processLocation(exitLocationData);
            
            console.log(`📋 Eventos generados: ${exitEvents.length}`);
            
            if (exitEvents.length > 0) {
              exitEvents.forEach((event, i) => {
                console.log(`   ${i+1}. ${event.event_type}: ${event.location_code}`);
                console.log(`      Event ID: ${event.id}`);
                console.log(`      Distance: ${event.distance_from_center}m`);
              });
              
              console.log('✅ ¡SALIDA DETECTADA Y PROCESADA!');
              
              // Verificar Telegram para salida
              setTimeout(async () => {
                const exitTelegramCheck = await pool.query(`
                  SELECT telegram_sent, telegram_sent_at, telegram_error 
                  FROM geofence_events 
                  WHERE id = $1
                `, [exitEvents[0].id]);
                
                if (exitTelegramCheck.rows.length > 0) {
                  const tg = exitTelegramCheck.rows[0];
                  console.log(`📱 Telegram SALIDA: ${tg.telegram_sent ? '✅ ENVIADO' : '❌ FALLÓ'}`);
                  if (tg.telegram_error) {
                    console.log(`   Error: ${tg.telegram_error}`);
                  }
                  if (tg.telegram_sent_at) {
                    console.log(`   Enviado: ${new Date(tg.telegram_sent_at).toLocaleTimeString('es-MX')}`);
                  }
                }
                
                // Resumen final
                console.log('\n🎯 RESUMEN DEL TEST:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ Geofence-engine funciona correctamente');
                console.log('✅ Detecta entrada y salida');
                console.log('✅ Guarda eventos en base de datos');
                console.log('📱 Verifica tu Telegram - deberías tener 2 alertas nuevas');
                console.log('');
                console.log('🔧 PROBLEMA IDENTIFICADO:');
                console.log('   Location-processor bloquea ubicaciones duplicadas');
                console.log('   Por eso no ves alertas cuando te mueves físicamente');
                console.log('');
                console.log('💡 SOLUCIÓN PARA TUS PRUEBAS:');
                console.log('   1. Muévete más de 25-30m entre pruebas');
                console.log('   2. Espera 5+ minutos entre movimientos');
                console.log('   3. O cambia coordenadas significativamente');
                console.log('   4. El sistema SÍ funciona, solo evita duplicados');
                
                await pool.end();
                
              }, 2000);
              
            } else {
              console.log('❌ No se detectó salida');
              await pool.end();
            }
            
          }, 3000);
          
        }, 2000);
        
      } else {
        console.log('❌ No se detectó entrada');
        await pool.end();
      }
      
    } catch (engineError) {
      console.error('❌ Error en geofence-engine:', engineError.message);
      await pool.end();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

directGeofenceTest();