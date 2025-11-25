require('dotenv').config();
const https = require('https');

/**
 * TEST DIRECTO AL API DE ZENPUT
 * Probando diferentes endpoints y métodos de autenticación
 */

const API_KEY = process.env.ZENPUT_API_KEY;

async function testZenputEndpoint(url, authMethod = 'Bearer') {
  return new Promise((resolve) => {
    console.log(`\n🌐 Probando: ${url}`);
    console.log(`🔑 Auth: ${authMethod} ${API_KEY.substring(0, 8)}...`);
    
    const authHeader = authMethod === 'Bearer' 
      ? `Bearer ${API_KEY}`
      : authMethod === 'Token' 
        ? `Token ${API_KEY}`
        : authMethod === 'ApiKey'
          ? API_KEY
          : `${authMethod} ${API_KEY}`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'EPL-CAS-GPS/1.0'
      },
      timeout: 8000
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      
      console.log(`📡 Status: ${res.statusCode}`);
      console.log(`📋 Headers:`, JSON.stringify(res.headers, null, 2));
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        console.log(`📦 Response Length: ${data.length} chars`);
        console.log(`📝 Response Preview:`, data.substring(0, 300));
        
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ JSON válido`);
          
          if (parsed.data && Array.isArray(parsed.data)) {
            console.log(`📊 Data array: ${parsed.data.length} items`);
            if (parsed.data.length > 0) {
              console.log(`🎯 Primer item:`, JSON.stringify(parsed.data[0], null, 2).substring(0, 200));
            }
          }
          
        } catch (e) {
          console.log(`❌ No es JSON válido`);
        }
        
        resolve({
          status: res.statusCode,
          data: data,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      resolve({ error: error.message, success: false });
    });

    req.on('timeout', () => {
      console.log(`⏰ Timeout`);
      req.destroy();
      resolve({ error: 'Timeout', success: false });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 TESTING ZENPUT API - BÚSQUEDA DE ENDPOINTS CORRECTOS\n');
  console.log(`🔑 API Key: ${API_KEY.substring(0, 12)}...${API_KEY.substring(-4)}\n`);
  
  const testCases = [
    // Endpoints posibles con diferentes métodos de auth
    { url: 'https://app.zenput.com/api/v1/locations', auth: 'Bearer' },
    { url: 'https://app.zenput.com/api/v2/locations', auth: 'Bearer' },
    { url: 'https://app.zenput.com/api/v3/locations', auth: 'Bearer' },
    { url: 'https://api.zenput.com/v1/locations', auth: 'Bearer' },
    { url: 'https://zenput.com/api/locations', auth: 'Bearer' },
    
    // Diferentes métodos de autenticación
    { url: 'https://app.zenput.com/api/v1/locations', auth: 'Token' },
    { url: 'https://app.zenput.com/api/v1/locations', auth: 'X-API-Key' },
    
    // Endpoints alternativos
    { url: 'https://app.zenput.com/api/v1/stores', auth: 'Bearer' },
    { url: 'https://app.zenput.com/api/v1/sites', auth: 'Bearer' },
    { url: 'https://app.zenput.com/api/v1/organizations', auth: 'Bearer' }
  ];
  
  for (const test of testCases) {
    const result = await testZenputEndpoint(test.url, test.auth);
    
    if (result.success) {
      console.log(`🎉 ¡ENDPOINT EXITOSO ENCONTRADO!`);
      console.log(`   URL: ${test.url}`);
      console.log(`   Auth: ${test.auth}`);
      break;
    }
    
    // Pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🔍 TAMBIÉN PROBANDO SIN AUTENTICACIÓN PARA VER ESTRUCTURA...');
  
  // Test sin auth para ver qué devuelve
  await testZenputEndpoint('https://app.zenput.com/api/v1/locations', 'None');
}

runTests().then(() => {
  console.log('\n✅ Tests completados');
  process.exit(0);
});