/**
 * PASOS PARA OBTENER TU USER ID DE TELEGRAM:
 * 
 * 1. Abre Telegram en tu teléfono o computadora
 * 2. Busca y habla con: @userinfobot
 * 3. Envía cualquier mensaje al bot (ejemplo: "hola")
 * 4. El bot te responderá con tu información, incluyendo tu User ID
 * 5. Copia el número que aparece como "Id: 123456789"
 * 6. Ese número es tu User ID
 * 
 * ALTERNATIVA:
 * 1. Habla con: @myidbot
 * 2. Envía el comando: /getid
 * 3. Te dará tu User ID
 * 
 * Una vez que tengas tu User ID, ejecuta:
 * node configurar-mi-admin-id.js TU_USER_ID_AQUI
 */

console.log('📱 OBTENER TU USER ID DE TELEGRAM\n');

console.log('🤖 OPCIÓN 1: @userinfobot');
console.log('   1. Abre Telegram');
console.log('   2. Busca: @userinfobot');
console.log('   3. Envía: cualquier mensaje');
console.log('   4. Copia tu "Id: 123456789"\n');

console.log('🤖 OPCIÓN 2: @myidbot');
console.log('   1. Abre Telegram'); 
console.log('   2. Busca: @myidbot');
console.log('   3. Envía: /getid');
console.log('   4. Copia tu User ID\n');

console.log('⚙️  LUEGO EJECUTA:');
console.log('   node configurar-mi-admin-id.js TU_USER_ID_AQUI\n');

console.log('💡 EJEMPLO:');
console.log('   Si tu User ID es 123456789, ejecuta:');
console.log('   node configurar-mi-admin-id.js 123456789');

if (process.argv[2]) {
  const userId = process.argv[2];
  console.log(`\n✅ User ID proporcionado: ${userId}`);
  console.log('   Ejecutando configuración...');
  
  // Validar que sea un número
  if (!/^\d+$/.test(userId)) {
    console.log('❌ Error: El User ID debe ser solo números');
    process.exit(1);
  }
  
  // Configurar en .env
  const fs = require('fs');
  let envContent = fs.readFileSync('.env', 'utf8');
  envContent = envContent.replace(/TELEGRAM_ADMIN_IDS=.*/, `TELEGRAM_ADMIN_IDS=${userId}`);
  fs.writeFileSync('.env', envContent);
  
  console.log(`✅ User ID configurado: ${userId}`);
  console.log('🚀 Ahora el bot reconocerá tus comandos');
  console.log('📱 Prueba enviando /start a @pollolocogps_bot');
}