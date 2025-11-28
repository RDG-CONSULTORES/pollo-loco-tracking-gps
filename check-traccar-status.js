/**
 * Script para verificar el estado completo del sistema Traccar de Roberto
 */

async function checkTraccarStatus() {
  console.log('📱 DIAGNÓSTICO COMPLETO TRACCAR CLIENTE - ROBERTO01\n');
  
  const baseUrl = 'https://pollo-loco-tracking-gps-production.up.railway.app';
  
  // 1. Verificar configuración de Traccar
  console.log('1️⃣ CONFIGURACIÓN TRACCAR CLIENT EN TU IPHONE:');
  console.log('=' .repeat(60));
  console.log('📱 App: Traccar Client (debe estar instalada)');
  console.log('🌐 Server URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar');
  console.log('🆔 Device ID: ROBERTO01');
  console.log('⏱️ Interval: 30 segundos (recomendado)');
  console.log('🔴 Status: El switch de tracking debe estar ACTIVADO\n');
  
  // 2. Verificar últimos datos
  console.log('2️⃣ VERIFICANDO DATOS ACTUALES...');
  try {
    const response = await fetch(`${baseUrl}/api/traccar?id=ROBERTO01`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Endpoint funcionando');
      console.log(`📊 Dispositivo: ${data.device.name}`);
      console.log(`📍 Última ubicación: ${data.device.lastPosition.latitude}, ${data.device.lastPosition.longitude}`);
      console.log(`⏰ Último update: ${new Date(data.device.lastUpdate).toLocaleString()}`);
      console.log(`🔋 Batería: ${data.device.lastPosition.battery}%`);
      console.log(`📏 Precisión: ${data.device.lastPosition.accuracy}m`);
      
      // Calcular tiempo desde última actualización
      const lastUpdate = new Date(data.device.lastUpdate);
      const now = new Date();
      const minutesAgo = Math.floor((now - lastUpdate) / (1000 * 60));
      
      if (minutesAgo < 5) {
        console.log(`🟢 STATUS: ACTIVO (última actualización hace ${minutesAgo} minutos)`);
      } else if (minutesAgo < 30) {
        console.log(`🟡 STATUS: RECIENTE (última actualización hace ${minutesAgo} minutos)`);
      } else {
        console.log(`🔴 STATUS: INACTIVO (última actualización hace ${minutesAgo} minutos)`);
        console.log('⚠️ Necesitas revisar la configuración del Traccar Client');
      }
    }
  } catch (error) {
    console.log(`❌ Error verificando endpoint: ${error.message}`);
  }
  
  console.log('\n3️⃣ INSTRUCCIONES PARA VERIFICAR TU IPHONE:');
  console.log('=' .repeat(60));
  console.log('📱 ABRE TRACCAR CLIENT y verifica:');
  console.log('   1. ¿Está el switch principal ACTIVADO (verde)?');
  console.log('   2. ¿Dice "Connected" en la parte superior?');
  console.log('   3. ¿Muestra tus coordenadas actuales?');
  console.log('   4. ¿El icono de GPS está activo en la barra de iOS?');
  console.log('');
  console.log('🛠️ SI NO FUNCIONA:');
  console.log('   1. Ve a Settings en Traccar Client');
  console.log('   2. Verifica Server URL y Device ID');
  console.log('   3. Presiona "Test" si está disponible');
  console.log('   4. Desactiva y reactiva el tracking');
  console.log('   5. Reinicia la app completamente');
  console.log('');
  console.log('⚙️ PERMISOS iOS:');
  console.log('   1. Ve a: Configuración iOS > Privacidad > Localización');
  console.log('   2. Busca "Traccar Client"');
  console.log('   3. DEBE estar en "Siempre" o "Al usar la app"');
  console.log('   4. Si está en "Nunca" → cámbialo a "Siempre"');
  
  // 4. Test en vivo
  console.log('\n4️⃣ TEST EN VIVO:');
  console.log('=' .repeat(60));
  console.log('🧪 Enviando datos de prueba para comparar...');
  
  try {
    const testData = {
      lat: 19.432608,
      lon: -99.133209,
      timestamp: Math.floor(Date.now() / 1000),
      speed: 0,
      bearing: 0,
      accuracy: 3,
      battery: 90
    };
    
    const testResponse = await fetch(`${baseUrl}/api/traccar?id=ROBERTO01`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    if (testResponse.ok) {
      console.log('✅ Test enviado exitosamente');
      console.log('📍 Coordenadas test: 19.432608, -99.133209');
      console.log('⏰ Si tu iPhone está funcionando, deberías ver nuevos datos en 1-2 minutos');
    }
  } catch (error) {
    console.log(`❌ Error en test: ${error.message}`);
  }
  
  console.log('\n5️⃣ PRÓXIMO PASO:');
  console.log('=' .repeat(60));
  console.log('⏰ Espera 2 minutos y ejecuta: node simple-check-roberto.js');
  console.log('📊 Si ves un nuevo registro, tu iPhone está funcionando perfectamente');
  console.log('🔄 Si no hay nuevos datos, revisa la configuración del Traccar Client');
}

checkTraccarStatus().catch(console.error);