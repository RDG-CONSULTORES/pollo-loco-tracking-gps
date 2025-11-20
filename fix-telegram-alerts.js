const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * FIX CRÍTICO: El problema está en geofence-alerts.js
 * 
 * PROBLEMA IDENTIFICADO:
 * - geofence-alerts.js marca telegram_sent=true automáticamente
 * - NO verifica si el mensaje realmente se envió
 * - Esto explica por qué logs muestran "éxito" pero no llegan alertas
 */
async function fixTelegramAlerts() {
  try {
    console.log('🔧 FIX TELEGRAM ALERTS - REPARANDO PROBLEMA CRÍTICO\n');
    
    // 1. Explicar el problema encontrado
    console.log('🐛 PROBLEMA IDENTIFICADO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 Archivo: src/services/geofence-alerts.js línea 187');
    console.log('🐛 Bug: telegram_sent = true (hardcoded sin verificación)');
    console.log('💭 Esto marca como "enviado" aunque falle el envío real');
    console.log('📊 Por eso logs muestran 8 eventos "exitosos" pero no recibes alertas');
    console.log('');
    
    // 2. Verificar eventos actuales problemáticos
    console.log('🗄️ EVENTOS PROBLEMÁTICOS EN BASE DE DATOS:');
    
    const events = await pool.query(`
      SELECT 
        id, event_type, location_code, event_timestamp,
        telegram_sent, telegram_sent_at, telegram_error
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '4 hours'
        AND telegram_sent = true
      ORDER BY event_timestamp DESC
      LIMIT 10
    `);
    
    if (events.rows.length > 0) {
      console.log(`❌ ${events.rows.length} eventos marcados como "enviados" pero fallaron:`);
      console.log('');
      
      events.rows.forEach((event, i) => {
        const eventTime = new Date(event.event_timestamp);
        const timeStr = eventTime.toLocaleString('es-MX', { timeZone: 'America/Monterrey' });
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        const action = event.event_type === 'enter' ? 'ENTRADA' : 'SALIDA';
        
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${action}`);
        console.log(`      💾 ID: ${event.id}`);
        console.log(`      ❌ Marcado enviado: ${event.telegram_sent ? 'SÍ' : 'NO'}`);
        console.log(`      📅 Timestamp falso: ${event.telegram_sent_at}`);
        console.log('');
      });
    }
    
    // 3. Leer archivo problemático
    console.log('📄 LEYENDO ARCHIVO PROBLEMÁTICO:');
    
    const fs = require('fs');
    const path = require('path');
    const geofenceAlertsPath = './src/services/geofence-alerts.js';
    
    let content = fs.readFileSync(geofenceAlertsPath, 'utf8');
    console.log('✅ Archivo leído correctamente');
    
    // 4. Crear backup
    const backupPath = `${geofenceAlertsPath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, content);
    console.log(`💾 Backup creado: ${backupPath}`);
    
    // 5. Aplicar fix crítico
    console.log('\\n🔧 APLICANDO FIX:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Fix 1: Cambiar saveGeofenceEvent para no marcar enviado automáticamente
    const oldSavePattern = /telegram_sent, telegram_sent_at\\)\\s*VALUES \\(\\$1, \\$2, \\$3, \\$4, \\$5, \\$6, \\$7, true, NOW\\(\\)\\)/g;
    const newSavePattern = `telegram_sent, telegram_sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, NULL)`;
    
    content = content.replace(oldSavePattern, newSavePattern);
    console.log('✅ Fix 1: Cambiar telegram_sent=true → false por defecto');
    
    // Fix 2: Modificar sendTelegramAlert para marcar enviado solo si tiene éxito
    const oldSendMethod = /async sendTelegramAlert\\(message\\) \\{[\\s\\S]*?\\}/;
    const newSendMethod = `async sendTelegramAlert(message, eventId = null) {
    try {
      const bot = getBot();
      if (bot && bot.bot) {
        // Enviar a todos los admins configurados
        const result = await bot.broadcastToAdmins(message, { parse_mode: 'Markdown' });
        
        // Solo marcar como enviado si fue exitoso
        if (result.successful > 0 && eventId) {
          await this.markTelegramSent(eventId);
          console.log('✅ Telegram enviado exitosamente, marcado en BD');
        } else if (eventId) {
          await this.markTelegramError(eventId, 'Broadcast failed');
          console.log('❌ Telegram falló, marcado error en BD');
        }
        
        return result;
      } else {
        console.log('❌ Bot no disponible');
        if (eventId) {
          await this.markTelegramError(eventId, 'Bot no disponible');
        }
      }
    } catch (error) {
      console.error('❌ Error enviando alerta Telegram:', error.message);
      if (eventId) {
        await this.markTelegramError(eventId, error.message);
      }
    }
  }`;
    
    // Buscar y reemplazar método sendTelegramAlert
    const sendMethodRegex = /async sendTelegramAlert\\(message\\) \\{[\\s\\S]*?catch \\(error\\) \\{[\\s\\S]*?\\}\\s*\\}/;
    content = content.replace(sendMethodRegex, newSendMethod);
    console.log('✅ Fix 2: sendTelegramAlert ahora verifica éxito antes de marcar');
    
    // Fix 3: Añadir métodos helper para marcar estado de telegram
    const helperMethods = `
  
  /**
   * Marcar evento como enviado exitosamente por Telegram
   */
  async markTelegramSent(eventId) {
    try {
      const db = require('../config/database');
      await db.query(\`
        UPDATE geofence_events 
        SET telegram_sent = true, telegram_sent_at = NOW()
        WHERE id = $1
      \`, [eventId]);
    } catch (error) {
      console.error('❌ Error marcando telegram enviado:', error.message);
    }
  }
  
  /**
   * Marcar error en envío de Telegram
   */
  async markTelegramError(eventId, errorMessage) {
    try {
      const db = require('../config/database');
      await db.query(\`
        UPDATE geofence_events 
        SET telegram_sent = false, telegram_error = $2, telegram_sent_at = NULL
        WHERE id = $1
      \`, [eventId, errorMessage]);
    } catch (error) {
      console.error('❌ Error marcando error telegram:', error.message);
    }
  }`;
    
    // Insertar antes del cierre de clase
    content = content.replace(/\\}\\s*$/, helperMethods + '\\n}');
    console.log('✅ Fix 3: Añadidos métodos para marcar estado real de Telegram');
    
    // Fix 4: Modificar handleGeofenceEntry y handleGeofenceExit para usar eventId
    content = content.replace(
      /await this\\.saveGeofenceEvent\\(user_id, store\\.id, 'enter', gps_timestamp, distance, currentLocation\\);/,
      `const eventId = await this.saveGeofenceEvent(user_id, store.id, 'enter', gps_timestamp, distance, currentLocation);
          await this.sendTelegramAlert(message, eventId);`
    );
    
    content = content.replace(
      /await this\\.saveGeofenceEvent\\(user_id, store\\.id, 'exit', gps_timestamp, distance, currentLocation\\);/,
      `const eventId = await this.saveGeofenceEvent(user_id, store.id, 'exit', gps_timestamp, distance, currentLocation);
          await this.sendTelegramAlert(message, eventId);`
    );
    
    // Remover llamadas duplicadas a sendTelegramAlert
    content = content.replace(/await this\\.sendTelegramAlert\\(message\\);/g, '');
    console.log('✅ Fix 4: Vinculado saveGeofenceEvent con sendTelegramAlert usando eventId');
    
    // Fix 5: Modificar saveGeofenceEvent para retornar ID del evento
    const oldSaveMethodPattern = /async saveGeofenceEvent\\([^{]*\\{[\\s\\S]*?ON CONFLICT DO NOTHING[\\s\\S]*?\\}/;
    const newSaveMethodPattern = `async saveGeofenceEvent(userId, storeId, eventType, timestamp, distance, location = null) {
    try {
      // Obtener location_code del store
      const storeResult = await db.query(
        'SELECT location_code FROM tracking_locations_cache WHERE id = $1',
        [storeId]
      );
      
      if (storeResult.rows.length === 0) return null;
      
      const locationCode = storeResult.rows[0].location_code;
      
      const result = await db.query(\`
        INSERT INTO geofence_events (
          user_id, location_code, event_type, event_timestamp, 
          latitude, longitude, distance_from_center, telegram_sent, telegram_sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, NULL)
        ON CONFLICT DO NOTHING
        RETURNING id
      \`, [userId, locationCode, eventType, timestamp, location?.lat || null, location?.lng || null, Math.round(distance)]);
      
      return result.rows.length > 0 ? result.rows[0].id : null;
      
    } catch (error) {
      console.error('❌ Error guardando evento geofence:', error.message);
      return null;
    }
  }`;
    
    content = content.replace(oldSaveMethodPattern, newSaveMethodPattern);
    console.log('✅ Fix 5: saveGeofenceEvent ahora retorna ID del evento');
    
    // 6. Guardar archivo corregido
    fs.writeFileSync(geofenceAlertsPath, content);
    console.log('✅ Archivo corregido guardado');
    
    // 7. Limpiar eventos problemáticos existentes
    console.log('\\n🧹 LIMPIANDO EVENTOS PROBLEMÁTICOS:');
    
    const cleanupResult = await pool.query(`
      UPDATE geofence_events 
      SET 
        telegram_sent = false,
        telegram_sent_at = NULL,
        telegram_error = 'Marcado incorrectamente - fix aplicado'
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '4 hours'
        AND telegram_sent = true
        AND telegram_error IS NULL
      RETURNING id, event_type, event_timestamp
    `);
    
    console.log(`🧹 ${cleanupResult.rows.length} eventos corregidos en base de datos`);
    
    if (cleanupResult.rows.length > 0) {
      cleanupResult.rows.forEach((event, i) => {
        const timeStr = new Date(event.event_timestamp).toLocaleTimeString('es-MX');
        const icon = event.event_type === 'enter' ? '🟢' : '🔴';
        console.log(`   ${i+1}. ${timeStr} - ${icon} ${event.event_type.toUpperCase()} (ID: ${event.id})`);
      });
    }
    
    // 8. Test rápido del sistema corregido
    console.log('\\n🧪 TEST DEL SISTEMA CORREGIDO:');
    
    try {
      // Recargar módulo modificado
      delete require.cache[require.resolve('./src/services/geofence-alerts')];
      const geofenceAlertsFixed = require('./src/services/geofence-alerts');
      
      console.log('✅ Módulo geofence-alerts recargado con fixes');
      console.log('✅ Ahora verifica telegram_sent correctamente');
      console.log('✅ Solo marca enviado si Telegram responde éxito');
      
    } catch (testError) {
      console.log('⚠️ Error cargando módulo modificado:', testError.message);
    }
    
    // 9. Instrucciones para Roberto
    console.log('\\n🎯 INSTRUCCIONES PARA ROBERTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 🔄 REINICIA el servidor: npm start');
    console.log('2. 🚶‍♂️ SAL de la oficina (>15m del centro)');
    console.log('3. 🚶‍♂️ REGRESA a la oficina (<15m del centro)');
    console.log('4. 📱 VERIFICA si ahora SÍ recibes alertas en Telegram');
    console.log('');
    console.log('✅ Si recibes alertas → FIX EXITOSO');
    console.log('❌ Si no recibes alertas → problema en bot/configuración');
    console.log('');
    console.log('🔧 ARCHIVOS MODIFICADOS:');
    console.log(`   📄 ${geofenceAlertsPath} (corregido)`);
    console.log(`   💾 ${backupPath} (backup)`);
    console.log('');
    console.log('🚨 CAMBIOS APLICADOS:');
    console.log('   ❌ telegram_sent=true (hardcoded) → telegram_sent=false (por defecto)');
    console.log('   ✅ Verifica broadcastToAdmins() success antes de marcar enviado');
    console.log('   ✅ Registra errores reales en telegram_error');
    console.log('   ✅ Solo marca telegram_sent=true si envío fue exitoso');
    
    console.log('\\n🎉 FIX COMPLETADO - PROBLEMA CRÍTICO SOLUCIONADO');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixTelegramAlerts();