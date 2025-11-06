require('dotenv').config();

const db = require('./config/database');
const zenputDB = require('./config/zenput-database');
const { createBot } = require('./telegram/bot');
const { startServer } = require('./api/server');
const scheduler = require('./jobs/scheduler');

/**
 * Aplicación principal - Pollo Loco Tracking GPS
 */
async function main() {
  console.log('🐔 Iniciando Pollo Loco Tracking GPS...');
  
  try {
    // 1. Verificar variables de entorno
    validateEnvironment();
    
    // 2. Test conexiones de BD
    console.log('\n🔍 Verificando conexiones...');
    await testDatabaseConnections();
    
    // 3. Inicializar Telegram Bot
    console.log('\n🤖 Inicializando Telegram Bot...');
    const bot = createBot();
    if (bot) {
      const started = bot.start();
      if (!started) {
        console.warn('⚠️ Telegram Bot no se pudo iniciar');
      }
    }
    
    // 4. Iniciar servidor API
    console.log('\n🚀 Iniciando servidor API...');
    startServer();
    
    // 5. Inicializar scheduler de trabajos
    console.log('\n⏰ Inicializando trabajos programados...');
    scheduler.start();
    
    console.log('\n✅ Sistema iniciado exitosamente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ Error fatal iniciando sistema:', error.message);
    process.exit(1);
  }
}

/**
 * Validar variables de entorno requeridas
 */
function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'ZENPUT_DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ADMIN_IDS'
  ];
  
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:');
    missing.forEach(env => console.error(`   - ${env}`));
    throw new Error('Configuración incompleta');
  }
  
  console.log('✅ Variables de entorno validadas');
}

/**
 * Test conexiones de base de datos
 */
async function testDatabaseConnections() {
  // Test Railway DB
  const railwayOk = await db.testConnection();
  if (!railwayOk) {
    throw new Error('No se pudo conectar a Railway PostgreSQL');
  }
  
  // Test Zenput DB
  const zenputOk = await zenputDB.testConnection();
  if (!zenputOk) {
    console.warn('⚠️ No se pudo conectar a Zenput Database (continuando...)');
  }
  
  console.log('✅ Conexiones de BD verificadas');
}

/**
 * Manejo de señales del sistema
 */
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`\n📴 Recibida señal ${signal}, cerrando sistema...`);
  
  try {
    // Detener scheduler
    scheduler.stop();
    console.log('✅ Scheduler detenido');
    
    // Detener bot
    const bot = require('./telegram/bot').getBot();
    if (bot) {
      bot.stop();
      console.log('✅ Telegram Bot detenido');
    }
    
    // Cerrar conexiones de BD
    if (db.pool) {
      await db.pool.end();
      console.log('✅ Railway DB desconectada');
    }
    
    if (zenputDB.pool) {
      await zenputDB.pool.end();
      console.log('✅ Zenput DB desconectada');
    }
    
    console.log('✅ Sistema cerrado correctamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error en shutdown:', error.message);
    process.exit(1);
  }
}

/**
 * Manejo de errores no capturados
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada no manejada:', reason);
  console.error('Promise:', promise);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Iniciar aplicación
if (require.main === module) {
  main();
}

module.exports = { main };