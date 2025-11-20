const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetTelegramEvents() {
  try {
    console.log('🧹 LIMPIANDO EVENTOS TELEGRAM PROBLEMÁTICOS\n');
    
    // 1. Ver eventos actuales con problema
    console.log('📊 EVENTOS PROBLEMÁTICOS ACTUALES:');
    
    const problemEvents = await pool.query(`
      SELECT 
        id, event_type, location_code, event_timestamp,
        telegram_sent, telegram_sent_at, telegram_error
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '6 hours'
        AND telegram_sent = true
        AND telegram_error IS NULL
      ORDER BY event_timestamp DESC
    `);
    
    console.log(`❌ ${problemEvents.rows.length} eventos marcados incorrectamente como "enviados":`);
    
    if (problemEvents.rows.length > 0) {
      problemEvents.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action} (ID: ${event.id})`);
        console.log(`      ❌ Marcado enviado: ${event.telegram_sent}`);
        console.log(`      📅 Timestamp falso: ${new Date(event.telegram_sent_at).toLocaleString('es-MX')}`);
        console.log('');
      });
      
      // 2. Corregir eventos problemáticos
      console.log('🔧 CORRIGIENDO EVENTOS PROBLEMÁTICOS:');
      
      const resetResult = await pool.query(`
        UPDATE geofence_events 
        SET 
          telegram_sent = false,
          telegram_sent_at = NULL,
          telegram_error = 'Marcado incorrectamente - fix aplicado el ' || NOW()::text
        WHERE user_id = 5
          AND event_timestamp >= NOW() - INTERVAL '6 hours'
          AND telegram_sent = true
          AND telegram_error IS NULL
        RETURNING id, event_type, event_timestamp
      `);
      
      console.log(`✅ ${resetResult.rows.length} eventos corregidos en base de datos`);
      
      resetResult.rows.forEach((event, i) => {
        const timeStr = new Date(event.event_timestamp).toLocaleTimeString('es-MX');
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${event.event_type.toUpperCase()} (ID: ${event.id}) ✅ CORREGIDO`);
      });
    }
    
    // 3. Verificar estado después de la corrección
    console.log('\\n📋 ESTADO DESPUÉS DE CORRECCIÓN:');
    
    const verifyEvents = await pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        SUM(CASE WHEN telegram_sent THEN 1 ELSE 0 END) as marked_sent,
        SUM(CASE WHEN telegram_error IS NOT NULL THEN 1 ELSE 0 END) as with_errors
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '6 hours'
      GROUP BY event_type
      ORDER BY event_type
    `);
    
    if (verifyEvents.rows.length > 0) {
      verifyEvents.rows.forEach(stat => {
        const icon = stat.event_type === 'enter' ? '🟢' : '🔴';
        console.log(`${icon} ${stat.event_type.toUpperCase()}:`);
        console.log(`   📊 Total: ${stat.count}`);
        console.log(`   ✅ Marcados enviados: ${stat.marked_sent}`);
        console.log(`   ❌ Con errores: ${stat.with_errors}`);
        console.log('');
      });
    }
    
    // 4. Resumen del fix aplicado
    console.log('\\n🎯 RESUMEN DEL FIX APLICADO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ geofence-alerts.js modificado para verificar envío real');
    console.log('✅ telegram_sent = false por defecto (no más hardcoded true)');
    console.log('✅ Solo marca telegram_sent = true si broadcastToAdmins() tiene éxito');
    console.log('✅ Registra errores reales en telegram_error');
    console.log('✅ Eventos problemáticos pasados corregidos en BD');
    console.log('');
    console.log('📱 PRÓXIMOS PASOS PARA ROBERTO:');
    console.log('1. 🔄 REINICIA el servidor: npm start');
    console.log('2. 🚶‍♂️ SAL de tu oficina (>15m del centro)');
    console.log('3. 🚶‍♂️ REGRESA a tu oficina (<15m del centro)');
    console.log('4. 📱 VERIFICA si ahora SÍ recibes alertas en Telegram');
    console.log('');
    console.log('🐛 PROBLEMA ORIGINAL:');
    console.log('   El código marcaba telegram_sent=true sin verificar');
    console.log('   Por eso los logs mostraban "8 eventos enviados"');
    console.log('   Pero en realidad el bot no estaba enviando nada');
    console.log('');
    console.log('🔧 SOLUCIÓN:');
    console.log('   Ahora verifica resultado de bot.broadcastToAdmins()');
    console.log('   Solo marca enviado si result.successful > 0');
    console.log('   Registra errores reales para debugging');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

resetTelegramEvents();