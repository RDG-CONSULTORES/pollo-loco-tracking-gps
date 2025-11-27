/**
 * Script para verificar que Traccar esté configurado correctamente
 */

console.log('🔧 VERIFICANDO CONFIGURACIÓN TRACCAR\n');

console.log('📱 ABRE TRACCAR CLIENT EN TU IPHONE Y VERIFICA:');
console.log('=' .repeat(50));

console.log('1️⃣ CONFIGURACIÓN:');
console.log('   📍 Server URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar');
console.log('   🆔 Device ID: ROBERTO01');
console.log('   ⏱️ Frequency: 30 seconds');
console.log('   🔐 Protocol: HTTPS (activado)');

console.log('\n2️⃣ STATUS:');
console.log('   📡 Tracking: DEBE estar ACTIVADO (switch verde)');
console.log('   📍 Location: DEBE estar permitido');
console.log('   🔋 Battery: Optimización desactivada para GPS');

console.log('\n3️⃣ SI NO ESTÁ CONFIGURADO:');
console.log('   🔧 Ve a Settings en Traccar Client');
console.log('   📝 Configura manualmente:');
console.log('      Server: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar');
console.log('      Device: ROBERTO01');
console.log('   ✅ Activa el tracking');
console.log('   📍 Permite ubicación cuando iOS te pregunte');

console.log('\n4️⃣ TESTING INMEDIATO:');
console.log('   🧪 Después de activar, espera 1 minuto');
console.log('   🔄 Ejecuta: node simple-check-roberto.js');
console.log('   📊 Deberías ver tus coordenadas GPS');

console.log('\n⚡ PARA VER EN MAPA:');
console.log('   🗺️ Dashboard: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
console.log('   📱 Mobile: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/admin-mobile.html');

console.log('\n🎯 CHECKLIST:');
console.log('   ☐ Traccar Client instalado');
console.log('   ☐ Configuración correcta');
console.log('   ☐ Tracking activado');
console.log('   ☐ Ubicación permitida');
console.log('   ☐ Datos llegando a BD');
console.log('   ☐ Visible en mapa');