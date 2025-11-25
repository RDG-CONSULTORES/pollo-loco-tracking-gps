require('dotenv').config();
const https = require('https');

/**
 * PRUEBA DE PAGINACIÓN ZENPUT API
 * Verificar si existen más páginas de locations
 */

class ZenputPaginationTester {
  constructor() {
    this.apiToken = process.env.ZENPUT_API_KEY;
    this.baseUrl = 'https://www.zenput.com/api/v3/locations';
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Testing: ${url}`);
      
      const options = {
        method: 'GET',
        headers: {
          'X-API-TOKEN': this.apiToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          console.log(`📡 Status: ${res.statusCode} | Length: ${data.length}`);
          
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              
              console.log(`✅ JSON válido`);
              console.log(`📊 Data items: ${parsed.data ? parsed.data.length : 0}`);
              
              if (parsed.meta) {
                console.log(`📋 Meta info:`, JSON.stringify(parsed.meta, null, 2));
              }
              
              resolve(parsed);
            } catch (error) {
              console.log(`❌ JSON Error: ${error.message}`);
              reject(error);
            }
          } else {
            console.log(`❌ HTTP ${res.statusCode}: ${data.substring(0, 200)}`);
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async testPagination() {
    console.log('🔍 PROBANDO PAGINACIÓN ZENPUT API\n');
    
    const testUrls = [
      `${this.baseUrl}/`,                          // Base endpoint
      `${this.baseUrl}/?page=1`,                   // Página 1 explícita
      `${this.baseUrl}/?page=2`,                   // Página 2
      `${this.baseUrl}/?page=3`,                   // Página 3
      `${this.baseUrl}/?page=4`,                   // Página 4
      `${this.baseUrl}/?page=5`,                   // Página 5
      `${this.baseUrl}/?limit=50`,                 // Limit más grande
      `${this.baseUrl}/?limit=100`,                // Limit máximo
      `${this.baseUrl}/?per_page=50`,              // per_page parameter
      `${this.baseUrl}/?size=50`,                  // size parameter
      `${this.baseUrl}/?count=100`,                // count parameter
      `${this.baseUrl}/?offset=20`,                // offset parameter
      `${this.baseUrl}/?page=1&limit=100`,         // Combinado
      `${this.baseUrl}/?include_inactive=true`,    // Incluir inactivos
      `${this.baseUrl}/?status=active`,            // Solo activos
      `${this.baseUrl}/?status=all`                // Todos los status
    ];

    let allResults = [];

    for (const url of testUrls) {
      try {
        const result = await this.makeRequest(url);
        
        if (result && result.data) {
          allResults.push({
            url,
            count: result.data.length,
            meta: result.meta,
            first_item: result.data[0]?.name,
            last_item: result.data[result.data.length - 1]?.name
          });
          
          console.log(`   First: ${result.data[0]?.name}`);
          console.log(`   Last: ${result.data[result.data.length - 1]?.name}`);
        }
        
        console.log('');
        
        // Pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        console.log('');
      }
    }

    return allResults;
  }

  async testAlternativeEndpoints() {
    console.log('\n🔍 PROBANDO ENDPOINTS ALTERNATIVOS...\n');
    
    const alternativeUrls = [
      'https://www.zenput.com/api/v3/sites/',
      'https://www.zenput.com/api/v3/stores/',
      'https://www.zenput.com/api/v3/companies/',
      'https://www.zenput.com/api/v3/branches/',
      'https://www.zenput.com/api/v2/locations/',
      'https://www.zenput.com/api/v1/locations/',
      'https://www.zenput.com/api/locations/',
      'https://staging.zenput.com/api/v3/locations/?limit=100'
    ];

    let alternativeResults = [];

    for (const url of alternativeUrls) {
      try {
        const result = await this.makeRequest(url);
        
        if (result && (result.data || result.results)) {
          const items = result.data || result.results || [];
          alternativeResults.push({
            url,
            count: items.length,
            items
          });
          
          if (items.length > 0) {
            console.log(`   🎯 First item: ${items[0]?.name || 'N/A'}`);
          }
        }
        
        console.log('');
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        console.log('');
      }
    }

    return alternativeResults;
  }
}

async function main() {
  const tester = new ZenputPaginationTester();
  
  // 1. Probar paginación
  console.log('📄 PROBANDO PAGINACIÓN:');
  console.log('━'.repeat(50));
  const paginationResults = await tester.testPagination();
  
  // 2. Probar endpoints alternativos
  const alternativeResults = await tester.testAlternativeEndpoints();
  
  // 3. Análisis de resultados
  console.log('\n📊 ANÁLISIS DE RESULTADOS:');
  console.log('━'.repeat(50));
  
  if (paginationResults.length > 0) {
    console.log('📄 PAGINACIÓN:');
    paginationResults.forEach(result => {
      console.log(`   ${result.count} items: ${result.url}`);
      if (result.meta) {
        console.log(`   Meta: ${JSON.stringify(result.meta)}`);
      }
    });
    
    // Buscar el resultado con más items
    const maxResult = paginationResults.reduce((max, current) => 
      current.count > max.count ? current : max
    );
    
    console.log(`\n🎯 MÁXIMO ENCONTRADO: ${maxResult.count} items en:`);
    console.log(`   ${maxResult.url}`);
  }
  
  if (alternativeResults.length > 0) {
    console.log('\n🔄 ENDPOINTS ALTERNATIVOS:');
    alternativeResults.forEach(result => {
      console.log(`   ${result.count} items: ${result.url}`);
    });
  }
  
  // 4. Conclusiones
  console.log('\n🎯 CONCLUSIONES:');
  console.log('━'.repeat(50));
  
  const totalUnique = Math.max(...paginationResults.map(r => r.count), 0);
  
  if (totalUnique > 20) {
    console.log(`✅ SE ENCONTRARON MÁS LOCATIONS: ${totalUnique} total`);
    console.log('🚀 Usar el endpoint con más resultados para buscar las 3 nuevas');
  } else {
    console.log('⚠️ Solo 20 locations encontradas en todos los casos');
    console.log('💭 Posibles explicaciones:');
    console.log('   • Las 3 nuevas aún no están en Zenput');
    console.log('   • Están en estado inactivo');
    console.log('   • Están en otro sistema/endpoint');
    console.log('   • Se agregaron después del último sync');
  }
  
  process.exit(0);
}

main();