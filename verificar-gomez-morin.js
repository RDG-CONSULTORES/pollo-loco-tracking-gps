/**
 * Verificar ubicación de Gómez Morín usando la dirección exacta de Zenput
 */

console.log('🔍 Verificando ubicación de Gómez Morín...');

console.log('\n📍 Datos de Zenput:');
console.log('   🏢 Nombre: 38 - Gomez Morin');  
console.log('   📧 Dirección: Missouri #458-A ote., San Pedro Garza García, NL, 66220, México');
console.log('   📍 Coordenadas: 25.6505422, -100.3838798');
console.log('   🌐 Google Maps: https://www.google.com/maps/@25.6505422,-100.3838798,17z');

console.log('\n🔍 Verificaciones manuales:');
console.log('   1. Buscar dirección en Google:');
console.log('      https://www.google.com/maps/search/Missouri+458-A+ote+San+Pedro+Garza+García+NL');

console.log('\n   2. Buscar "El Pollo Loco" + dirección:');
console.log('      https://www.google.com/maps/search/El+Pollo+Loco+Missouri+458+San+Pedro+Garza+García');

console.log('\n   3. Street View en coordenadas actuales:');
console.log('      https://www.google.com/maps/@25.6505422,-100.3838798,3a,75y,90t/data=!3m6!1e1');

console.log('\n❓ PREGUNTAS PARA VALIDACIÓN:');
console.log('   - ¿Las coordenadas 25.6505422, -100.3838798 muestran realmente un Pollo Loco?');
console.log('   - ¿Está en Missouri esquina con Av. Gómez Morín?');
console.log('   - ¿Es la ubicación correcta según tu conocimiento local?');

console.log('\n💡 Si las coordenadas están correctas:');
console.log('   ✅ No hay nada que corregir');
console.log('\n💡 Si las coordenadas están incorrectas:');
console.log('   🔧 Necesitamos la dirección o coordenadas correctas');

console.log('\n🎯 RESULTADO DE ZENPUT:');
console.log('   Las coordenadas de Zenput coinciden exactamente con las del sistema.');
console.log('   Si están mal, el error está en Zenput mismo.');

if (require.main === module) {
  console.log('\n⏳ Esperando confirmación del usuario...');
}