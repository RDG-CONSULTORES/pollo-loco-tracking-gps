const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Acelerar detección para Roberto - Múltiples estrategias
 */
async function speedUpDetectionRoberto() {
  try {
    console.log('⚡ ACELERANDO DETECCIÓN PARA ROBERTO\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Verificar configuración actual del usuario Roberto
    console.log('👤 PASO 1: VERIFICANDO USUARIO ROBERTO');
    console.log('');
    
    const roberto = await pool.query(`
      SELECT id, tracker_id, display_name, active, last_location_time
      FROM tracking_users 
      WHERE id = 5 OR tracker_id = '01' OR tracker_id = 'RD01'
      ORDER BY id
    `);
    
    if (roberto.rows.length > 0) {
      console.log('✅ Usuarios Roberto encontrados:');
      roberto.rows.forEach((user, i) => {
        const lastTime = user.last_location_time ? 
          new Date(user.last_location_time).toLocaleString('es-MX', { timeZone: 'America/Monterrey' }) : 
          'Nunca';
        console.log(`   ${i+1}. ID: ${user.id} | ${user.tracker_id} | ${user.display_name}`);
        console.log(`      Estado: ${user.active ? '🟢 ACTIVO' : '❌ INACTIVO'}`);
        console.log(`      Última ubicación: ${lastTime}`);
        console.log('');
      });
    } else {
      console.log('❌ No se encontró usuario Roberto');
      return;
    }
    
    // 2. Verificar frecuencia actual de OwnTracks
    console.log('📡 PASO 2: FRECUENCIA ACTUAL OWNTRACKS');
    console.log('');
    
    const recentLocations = await pool.query(`
      SELECT 
        gps_timestamp,
        LAG(gps_timestamp) OVER (ORDER BY gps_timestamp) as prev_timestamp,
        EXTRACT(EPOCH FROM (gps_timestamp - LAG(gps_timestamp) OVER (ORDER BY gps_timestamp))) as interval_seconds
      FROM gps_locations
      WHERE user_id = 5
        AND gps_timestamp >= NOW() - INTERVAL '30 minutes'
      ORDER BY gps_timestamp DESC
      LIMIT 10
    `);
    
    if (recentLocations.rows.length > 0) {
      console.log('📊 Intervalos entre ubicaciones (últimas 10):');
      
      const intervals = recentLocations.rows
        .filter(row => row.interval_seconds)
        .map(row => Math.round(row.interval_seconds));
      
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const minInterval = Math.min(...intervals);
        const maxInterval = Math.max(...intervals);
        
        console.log(`   ⏱️ Promedio: ${Math.round(avgInterval)} segundos`);
        console.log(`   ⚡ Mínimo: ${minInterval} segundos`);
        console.log(`   🐌 Máximo: ${maxInterval} segundos`);
        console.log('');
        
        intervals.forEach((interval, i) => {
          const speed = interval <= 30 ? '⚡ Rápido' : 
                       interval <= 60 ? '🟡 Normal' : '🐌 Lento';
          console.log(`   ${i+1}. ${interval}s ${speed}`);
        });
        
        if (avgInterval > 60) {
          console.log('\\n⚠️ PROBLEMA: Intervalos muy largos (>60s)');
          console.log('   RECOMENDACIÓN: Optimizar configuración OwnTracks');
        } else if (avgInterval > 30) {
          console.log('\\n🟡 NORMAL: Intervalos moderados (30-60s)');
        } else {
          console.log('\\n✅ ÓPTIMO: Intervalos rápidos (<30s)');
        }
      }
    }
    
    // 3. Estrategias de aceleración
    console.log('\\n⚡ PASO 3: ESTRATEGIAS DE ACELERACIÓN');
    console.log('');
    
    // Estrategia 1: Crear job específico para Roberto
    console.log('📋 ESTRATEGIA 1: Job específico para Roberto');
    
    const jobScript = `/**
 * Job específico para monitorear Roberto más frecuentemente
 */
const cron = require('node-cron');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Ejecutar cada 15 segundos para Roberto (solo testing)
const robertoMonitorJob = cron.schedule('*/15 * * * * *', async () => {
  try {
    console.log('⚡ Verificando Roberto (cada 15s)...');
    
    // Obtener última ubicación
    const lastLocation = await pool.query(\`
      SELECT latitude, longitude, gps_timestamp, accuracy
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    \`);
    
    if (lastLocation.rows.length > 0) {
      const loc = lastLocation.rows[0];
      const now = new Date();
      const locationTime = new Date(loc.gps_timestamp);
      const ageMinutes = (now - locationTime) / 60000;
      
      if (ageMinutes <= 2) {
        console.log(\`✅ Roberto: Ubicación reciente (\${Math.round(ageMinutes * 10) / 10}min)\`);
        
        // Forzar verificación de geofence
        const geofenceEngine = require('../services/geofence-engine');
        await geofenceEngine.processLocation({
          id: Date.now(),
          user_id: 5,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          battery: 100,
          gps_timestamp: loc.gps_timestamp
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error en Roberto monitor:', error.message);
  }
}, {
  scheduled: false // Inicialmente deshabilitado
});

module.exports = { robertoMonitorJob };`;

    const jobPath = './src/jobs/roberto-monitor.js';
    require('fs').writeFileSync(jobPath, jobScript);
    console.log(`✅ Job creado: ${jobPath}`);
    console.log('   🔄 Frecuencia: Cada 15 segundos');
    console.log('   🎯 Solo para Roberto (testing)');
    
    // Estrategia 2: Configuración OwnTracks optimizada
    console.log('\\n📱 ESTRATEGIA 2: Configuración OwnTracks optimizada');
    console.log('');
    console.log('📋 CONFIGURACIÓN RECOMENDADA PARA OWNTRACKS:');
    console.log('   ⚡ Monitoring: High');
    console.log('   📍 Locator interval: 10-15 segundos');
    console.log('   🔄 Move detection: 5-10 metros');
    console.log('   📡 Connection: WiFi + Cellular');
    console.log('   🔋 Ignore battery optimization: ON');
    
    // Estrategia 3: Endpoint de ping manual
    console.log('\\n🔄 ESTRATEGIA 3: Endpoint manual de verificación');
    
    const pingEndpoint = `/**
 * Endpoint para forzar verificación manual de Roberto
 * GET /api/ping-roberto
 */

const express = require('express');
const router = express.Router();
const geofenceEngine = require('../services/geofence-engine');
const db = require('../config/database');

router.get('/ping-roberto', async (req, res) => {
  try {
    console.log('🔄 Ping manual Roberto...');
    
    // Obtener última ubicación
    const result = await db.query(\`
      SELECT latitude, longitude, gps_timestamp, accuracy, battery
      FROM gps_locations
      WHERE user_id = 5
      ORDER BY gps_timestamp DESC
      LIMIT 1
    \`);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'No hay ubicaciones' });
    }
    
    const loc = result.rows[0];
    
    // Forzar procesamiento
    const events = await geofenceEngine.processLocation({
      id: Date.now(),
      user_id: 5,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy || 10,
      battery: loc.battery || 100,
      gps_timestamp: loc.gps_timestamp
    });
    
    console.log(\`✅ Ping Roberto: \${events.length} eventos generados\`);
    
    res.json({
      success: true,
      location: loc,
      events: events.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error ping Roberto:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;`;

    const pingPath = './src/api/routes/ping-roberto.js';
    require('fs').writeFileSync(pingPath, pingEndpoint);
    console.log(`✅ Endpoint creado: ${pingPath}`);
    console.log('   📡 URL: GET /api/ping-roberto');
    console.log('   🎯 Fuerza verificación manual');
    
    // 4. Instrucciones de implementación
    console.log('\\n🚀 PASO 4: INSTRUCCIONES DE IMPLEMENTACIÓN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📝 PARA ACTIVAR ACELERACIÓN:');
    console.log('');
    console.log('1. 📱 OWNTRACKS APP:');
    console.log('   - Abrir configuración');
    console.log('   - Monitoring: High');
    console.log('   - Interval: 10-15 segundos');
    console.log('   - Move threshold: 5 metros');
    console.log('');
    console.log('2. 🔄 JOB AUTOMÁTICO (opcional):');
    console.log('   - Habilitar roberto-monitor.js');
    console.log('   - Ejecuta cada 15 segundos');
    console.log('   - Solo durante testing');
    console.log('');
    console.log('3. 📡 PING MANUAL (inmediato):');
    console.log('   curl https://pollo-loco-tracking-gps-production.up.railway.app/api/ping-roberto');
    console.log('   - Fuerza verificación instantánea');
    console.log('   - Úsalo cuando cambies de ubicación');
    
    console.log('\\n⚡ RECOMENDACIÓN INMEDIATA:');
    console.log('   📱 Optimizar OwnTracks en tu teléfono AHORA');
    console.log('   🔄 Usar ping manual cuando testing');
    console.log('   ⏱️ Debería detectar cambios en <30 segundos');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

speedUpDetectionRoberto();