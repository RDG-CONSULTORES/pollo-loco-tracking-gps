require('dotenv').config();
const { createBot } = require('./src/telegram/bot');

/**
 * Probar el bot localmente para verificar que funcione
 */

console.log('🚀 Iniciando prueba local del bot...\n');

// Crear instancia del bot
const bot = createBot();

if (!bot) {
  console.log('❌ No se pudo crear el bot');
  process.exit(1);
}

// Verificar configuración
console.log('📋 Configuración actual:');
console.log(`   TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
console.log(`   ADMINS: ${process.env.TELEGRAM_ADMIN_IDS}`);
console.log(`   WEB_APP_URL: ${process.env.WEB_APP_URL}`);

// Intentar iniciar el bot
console.log('\n🤖 Iniciando bot...');
const started = bot.start();

if (started) {
  console.log('✅ Bot iniciado exitosamente');
  console.log('📱 El bot @pollolocogps_bot está ahora escuchando mensajes');
  console.log('\n🧪 PRUEBAS QUE PUEDES HACER:');
  console.log('1. Abrir Telegram');
  console.log('2. Buscar: @pollolocogps_bot');
  console.log('3. Enviar: /start');
  console.log('4. Probar comandos: /usuarios, /estado, /ubicaciones');
  console.log('\n⚠️  NOTA: Necesitas configurar tu User ID en TELEGRAM_ADMIN_IDS');
  console.log('   Para obtenerlo, envía un mensaje a @userinfobot');
  
  // Mantener el bot corriendo por 60 segundos para pruebas
  console.log('\n⏱️  Bot corriendo por 60 segundos para pruebas...');
  setTimeout(() => {
    console.log('\n⏹️  Deteniendo bot de prueba...');
    bot.stop();
    process.exit(0);
  }, 60000);
  
} else {
  console.log('❌ Error iniciando el bot');
  process.exit(1);
}