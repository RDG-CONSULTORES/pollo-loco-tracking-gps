require('dotenv').config();
const https = require('https');

/**
 * EXPLORAR ENDPOINTS DISPONIBLES CON EL API KEY
 * Probar diferentes endpoints y métodos de autenticación
 */

const API_KEY = process.env.ZENPUT_API_KEY;

async function testEndpoint(url, authMethod = 'Bearer', extraHeaders = {}) {
  return new Promise((resolve) => {
    console.log(`\n🌐 Testing: ${url}`);
    console.log(`🔑 Auth: ${authMethod}`);
    
    let authHeader;
    if (authMethod === 'Bearer') {
      authHeader = { 'Authorization': `Bearer ${API_KEY}` };
    } else if (authMethod === 'Token') {
      authHeader = { 'Authorization': `Token ${API_KEY}` };
    } else if (authMethod === 'X-API-Key') {
      authHeader = { 'X-API-Key': API_KEY };
    } else if (authMethod === 'ApiKey') {
      authHeader = { 'ApiKey': API_KEY };
    } else if (authMethod === 'Basic') {
      const encoded = Buffer.from(`api:${API_KEY}`).toString('base64');
      authHeader = { 'Authorization': `Basic ${encoded}` };
    }
    
    const options = {
      method: 'GET',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'EPL-CAS-Explorer/1.0',
        ...extraHeaders
      },
      timeout: 8000
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      
      console.log(`📡 Status: ${res.statusCode}`);
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        console.log(`📦 Length: ${data.length} chars`);
        console.log(`📝 Preview:`, data.substring(0, 200));
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            console.log(`✅ SUCCESS - JSON válido`);
            console.log(`📋 Keys:`, Object.keys(parsed));
            
            if (parsed.data) console.log(`📊 Data items: ${Array.isArray(parsed.data) ? parsed.data.length : 'not array'}`);
            if (Array.isArray(parsed)) console.log(`📊 Direct array: ${parsed.length} items`);
            
          } catch (e) {
            console.log(`✅ SUCCESS - Not JSON`);
          }
          
          resolve({ success: true, status: res.statusCode, data });
        } else {
          console.log(`❌ HTTP Error: ${res.statusCode}`);
          resolve({ success: false, status: res.statusCode, data });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request Error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(`⏰ Timeout`);
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function exploreZenputAPI() {
  console.log('🔍 EXPLORANDO ZENPUT API - BÚSQUEDA DE ENDPOINTS DISPONIBLES\n');
  console.log(`🔑 API Key: ${API_KEY.substring(0, 12)}...\n`);
  
  const endpoints = [
    // Diferentes bases URL
    'https://www.zenput.com/api/v3/locations',
    'https://www.zenput.com/api/v2/locations', 
    'https://www.zenput.com/api/v1/locations',
    'https://api.zenput.com/v3/locations',
    'https://api.zenput.com/v2/locations',
    'https://api.zenput.com/v1/locations',
    'https://app.zenput.com/api/v3/locations',
    'https://app.zenput.com/api/v2/locations',
    'https://app.zenput.com/api/v1/locations',
    
    // Otros endpoints que podrían estar disponibles
    'https://www.zenput.com/api/v3/stores',
    'https://www.zenput.com/api/v3/sites',
    'https://www.zenput.com/api/v3/organizations',
    'https://www.zenput.com/api/v3/companies',
    
    // Endpoints de usuario/info
    'https://www.zenput.com/api/v3/user',
    'https://www.zenput.com/api/v3/me',
    'https://www.zenput.com/api/v3/account',
    
    // Staging environment
    'https://staging.zenput.com/api/v3/locations'
  ];
  
  const authMethods = ['Bearer', 'Token', 'X-API-Key'];
  
  let foundEndpoint = null;
  
  // Probar cada endpoint con método Bearer primero
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint, 'Bearer');
    
    if (result.success) {
      console.log(`\n🎉 ENDPOINT EXITOSO ENCONTRADO!`);
      console.log(`URL: ${endpoint}`);
      foundEndpoint = endpoint;
      break;
    }
    
    // Si el endpoint existe pero auth falla (401), probar otros métodos
    if (result.status === 401) {
      console.log(`🔄 Endpoint existe, probando otros métodos de auth...`);
      
      for (const authMethod of authMethods.slice(1)) {
        const authResult = await testEndpoint(endpoint, authMethod);
        if (authResult.success) {
          console.log(`\n🎉 ENDPOINT Y AUTH EXITOSOS!`);
          console.log(`URL: ${endpoint}`);
          console.log(`Auth: ${authMethod}`);
          foundEndpoint = { url: endpoint, auth: authMethod };
          break;
        }
      }
      
      if (foundEndpoint) break;
    }
    
    // Pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!foundEndpoint) {
    console.log('\n🔍 PROBANDO ENDPOINTS SIN AUTENTICACIÓN (para ver estructura)...');
    
    const testUrls = [
      'https://www.zenput.com/api/v3/locations',
      'https://api.zenput.com/v1/locations'
    ];
    
    for (const url of testUrls) {
      console.log(`\n🌐 Test sin auth: ${url}`);
      const result = await testEndpoint(url.replace('Bearer', ''), 'None');
      if (result.status === 401 || result.status === 403) {
        console.log(`✅ Endpoint válido (${result.status}) - solo falta auth correcta`);
      }
    }
  }
  
  return foundEndpoint;
}

exploreZenputAPI().then((result) => {
  if (result) {
    console.log('\n🎯 SIGUIENTE PASO: Usar endpoint encontrado para obtener locations');
    console.log('📋 Roberto: Tenemos conexión exitosa, proceder con búsqueda de sucursales');
  } else {
    console.log('\n❌ NO SE ENCONTRÓ ENDPOINT DISPONIBLE');
    console.log('🔧 Posibles soluciones:');
    console.log('   1. Verificar permisos del API key en Zenput dashboard');
    console.log('   2. Solicitar API key con permisos de locations');
    console.log('   3. Contactar soporte de Zenput para documentación actualizada');
  }
  
  process.exit(0);
});