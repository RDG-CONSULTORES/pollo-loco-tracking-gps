/**
 * Script de verificación post-deploy
 * Ejecutar después del deploy para verificar que todo funciona
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyPostDeploy() {
  try {
    console.log('🚀 VERIFICACIÓN POST-DEPLOY\n');
    
    // 1. Test bot inicializado
    try {
      const { getBot } = require('./src/telegram/bot');
      const bot = getBot();
      
      if (bot && bot.bot) {
        console.log('✅ Bot inicializado correctamente');
        
        // Test envío
        const testResult = await bot.sendMessage(6932484342, 
          '✅ POST-DEPLOY VERIFICADO\n\nBot funcionando correctamente después del deploy.'
        );
        console.log('✅ Test de envío exitoso');
        
      } else {
        console.log('❌ Bot NO inicializado');
      }
    } catch (botError) {
      console.log('❌ Error verificando bot:', botError.message);
    }
    
    // 2. Test geofence
    const events = await pool.query(`
      SELECT COUNT(*) as count
      FROM geofence_events
      WHERE user_id = 5
        AND event_timestamp >= NOW() - INTERVAL '6 hours'
    `);
    
    console.log(`📊 Eventos recientes: ${events.rows[0].count}`);
    
    console.log('\n🎉 VERIFICACIÓN COMPLETADA');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyPostDeploy();