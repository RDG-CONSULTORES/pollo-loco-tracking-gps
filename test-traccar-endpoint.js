/**
 * Test directo del endpoint Traccar para verificar que esté funcionando
 */

async function testTraccarEndpoint() {
  console.log('🧪 TEST DIRECTO ENDPOINT TRACCAR\n');
  
  const baseUrl = 'https://pollo-loco-tracking-gps-production.up.railway.app';
  
  // 1. Test si el endpoint responde
  console.log('1️⃣ TEST ENDPOINT DISPONIBILIDAD:');
  try {
    const testResponse = await fetch(`${baseUrl}/api/traccar?id=ROBERTO01`, {
      method: 'GET'
    });
    
    console.log(`   ✅ Endpoint responde: ${testResponse.status}`);
    
    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log(`   📊 Respuesta:`, data);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // 2. Test enviando datos GPS simulados
  console.log('\n2️⃣ TEST ENVÍO GPS SIMULADO:');
  try {
    const testData = {
      lat: 19.432608,  // Centro CDMX
      lon: -99.133209,
      timestamp: Math.floor(Date.now() / 1000),
      speed: 0,
      bearing: 0,
      accuracy: 5,
      battery: 85
    };
    
    console.log(`   📡 Enviando datos GPS simulados...`);
    console.log(`   📍 Ubicación: ${testData.lat}, ${testData.lon}`);
    
    const postResponse = await fetch(`${baseUrl}/api/traccar?id=ROBERTO01`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`   📊 Status: ${postResponse.status}`);
    
    if (postResponse.ok) {
      const responseText = await postResponse.text();
      console.log(`   ✅ Respuesta: ${responseText}`);
      console.log(`   🎉 ¡ENDPOINT FUNCIONA!`);
      
      // Verificar que se guardó en BD
      console.log(`\n3️⃣ VERIFICANDO EN BASE DE DATOS...`);
      setTimeout(async () => {
        // Ejecutar verificación después de 2 segundos
        const { spawn } = require('child_process');
        const check = spawn('node', ['simple-check-roberto.js']);
        
        check.stdout.on('data', (data) => {
          console.log(data.toString());
        });
      }, 2000);
      
    } else {
      const errorText = await postResponse.text();
      console.log(`   ❌ Error: ${errorText}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error enviando: ${error.message}`);
  }
  
  console.log('\n🎯 DIAGNÓSTICO:');
  console.log('Si el test simulado funciona pero tu iPhone no envía datos:');
  console.log('1. Verifica que Traccar Client tenga la URL EXACTA');
  console.log('2. Asegúrate que el Device ID sea exactamente: ROBERTO01');
  console.log('3. Revisa que iOS tenga permisos de ubicación para Traccar Client');
  console.log('4. Intenta cerrar y abrir la app Traccar Client');
  
  return true;
}

testTraccarEndpoint().catch(console.error);