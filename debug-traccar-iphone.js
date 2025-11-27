/**
 * Diagnóstico específico para iPhone de Roberto
 */

console.log('🔧 DIAGNÓSTICO TRACCAR IPHONE - ROBERTO01\n');

console.log('📱 VERIFICA EN TU IPHONE TRACCAR CLIENT:');
console.log('=' .repeat(50));

console.log('1️⃣ PANTALLA PRINCIPAL:');
console.log('   🔴 ¿Hay un botón/switch ROJO activo?');
console.log('   📊 ¿Dice "Tracking: ON" o "Tracking: Enabled"?');
console.log('   📍 ¿Muestra coordenadas actuales?');

console.log('\n2️⃣ CONFIGURACIÓN (Settings):');
console.log('   🌐 Server URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar');
console.log('   🆔 Device ID: ROBERTO01');
console.log('   ⏱️ Interval: 30 segundos (o menos)');
console.log('   📡 Status: Connected/Online');

console.log('\n3️⃣ PERMISOS iOS:');
console.log('   📍 Ve a: Configuración > Privacidad > Localización');
console.log('   🔍 Busca "Traccar Client"');
console.log('   ✅ DEBE estar "Siempre" o "Al usar la app"');
console.log('   ⚠️ Si dice "Nunca" → Cámbialo a "Siempre"');

console.log('\n4️⃣ SOLUCIONES RÁPIDAS:');
console.log('   🔄 Cierra y abre Traccar Client');
console.log('   🔴 Desactiva y reactiva el tracking');
console.log('   📱 Reinicia el iPhone si es necesario');
console.log('   🔧 Borra y vuelve a configurar en Settings');

console.log('\n5️⃣ TEST MANUAL:');
console.log('   📍 En Traccar Client, ve a Settings');
console.log('   🧪 Busca "Test" o "Send Location Now"');
console.log('   👆 Presiona para enviar ubicación manual');

console.log('\n⚡ ESTADÍSTICAS ACTUALES:');
console.log(`   📊 Total registros: 1`);
console.log(`   ⏰ Último dato: hace ~15 minutos`);
console.log(`   📍 Última ubicación: Centro CDMX`);
console.log(`   🔴 STATUS: NO está enviando datos nuevos`);

console.log('\n🎯 ACCIÓN INMEDIATA:');
console.log('1. Verifica permisos iOS de ubicación');
console.log('2. Reactiva tracking en Traccar Client');
console.log('3. Espera 1 minuto y ejecuta: node simple-check-roberto.js');
console.log('4. Deberías ver un registro nuevo con timestamp reciente');

console.log('\n💡 ALTERNATIVA RÁPIDA:');
console.log('Si no funciona, podemos probar con OwnTracks:');
console.log('URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks-remote/setup/ROBERTO01');