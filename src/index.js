require('dotenv').config();

const db = require('./config/database');
const { createBot } = require('./telegram/bot');
const { startServer } = require('./api/server');

/**
 * Aplicación principal - Pollo Loco Tracking GPS
 * ENTERPRISE VERSION - Sin scheduler corrupto
 * Arquitectura completamente limpia para producción
 */
async function main() {
  console.log('🐔 Iniciando Pollo Loco Tracking GPS v1.0.5-ENTERPRISE...');
  
  try {
    // 1. Verificar variables de entorno críticas
    validateEnvironment();
    
    // 2. Setup base de datos automáticamente
    console.log('\n🔧 Configurando base de datos...');
    await setupDatabase();
    
    // 3. Test conexión Railway DB únicamente
    console.log('\n🔍 Verificando conexión Railway...');
    await testRailwayConnection();
    
    // 4. Inicializar Telegram Bot
    console.log('\n🤖 Inicializando Telegram Bot...');
    const bot = createBot();
    if (bot) {
      const started = bot.start();
      if (!started) {
        console.warn('⚠️ Telegram Bot no se pudo iniciar');
      } else {
        console.log('✅ Telegram Bot iniciado correctamente');
      }
    }
    
    // 5. Iniciar servidor API
    console.log('\n🚀 Iniciando servidor API...');
    startServer();
    
    console.log('\n✅ SISTEMA ENTERPRISE ESTABILIZADO Y FUNCIONANDO');
    console.log('📱 Dashboard: /webapp/dashboard.html');
    console.log('🗺️ Admin: /webapp/admin.html');
    console.log('💚 Health: /health');
    console.log('📊 Version: 1.0.5-ENTERPRISE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ Error fatal iniciando sistema:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Validar variables de entorno requeridas
 */
function validateEnvironment() {
  const required = ['DATABASE_URL'];
  const optional = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_IDS'];
  
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Variables de entorno críticas faltantes:');
    missing.forEach(env => console.error(`   - ${env}`));
    throw new Error('Configuración incompleta');
  }
  
  const missingOptional = optional.filter(env => !process.env[env]);
  if (missingOptional.length > 0) {
    console.warn('⚠️ Variables opcionales faltantes:');
    missingOptional.forEach(env => console.warn(`   - ${env}`));
  }
  
  console.log('✅ Variables de entorno validadas');
}

/**
 * Configurar base de datos automáticamente
 */
async function setupDatabase() {
  try {
    const { execSync } = require('child_process');
    
    console.log('📄 Ejecutando schema SQL...');
    execSync('node scripts/setup-database.js', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('✅ Base de datos configurada');
    
    // Run Telegram detection migration (Mini-Step 1B)
    try {
      const { addTelegramDetectionColumns } = require('./migrations/add-telegram-detection-columns');
      await addTelegramDetectionColumns();
      console.log('✅ Telegram detection migration completed');
    } catch (migrationError) {
      console.warn('⚠️ Telegram detection migration warning:', migrationError.message);
      // Continue even if migration fails (columns might already exist)
    }
    
  } catch (error) {
    console.log('⚠️ Error en setup DB (continuando):', error.message);
    // No hacer throw - continuar aunque falle el setup
  }
}

/**
 * Test conexión Railway DB únicamente
 */
async function testRailwayConnection() {
  try {
    const railwayOk = await db.testConnection();
    if (!railwayOk) {
      throw new Error('No se pudo conectar a Railway PostgreSQL');
    }
    console.log('✅ Conexión Railway verificada');
  } catch (error) {
    console.error('❌ Error conexión Railway:', error.message);
    throw error;
  }
}

/**
 * Manejo de señales del sistema
 */
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`\n📴 Recibida señal ${signal}, cerrando sistema...`);
  
  try {
    // Detener bot
    const bot = require('./telegram/bot').getBot();
    if (bot) {
      bot.stop();
      console.log('✅ Telegram Bot detenido');
    }
    
    // Cerrar conexión Railway DB
    if (db.pool) {
      await db.pool.end();
      console.log('✅ Railway DB desconectada');
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
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Iniciar aplicación
if (require.main === module) {
  main();
}

module.exports = { main };