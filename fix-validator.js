require('dotenv').config();
const fs = require('fs').promises;

/**
 * ARREGLAR EL VALIDADOR FRESCO - PARSER JAVASCRIPT CORREGIDO
 */

async function fixValidator() {
  console.log('🔧 ARREGLANDO VALIDADOR FRESCO\n');
  
  try {
    // Leer el validador actual
    const content = await fs.readFile('./validador-fresco.html', 'utf8');
    
    // El parser correcto sin escape incorrecto
    const fixedParserFunction = `        // Parser de coordenadas mejorado
        function parseCoordinates(input) {
            if (!input) return null;
            
            // Limpiar pero preservar números, puntos, comas, espacios y signos negativos
            const cleaned = input.replace(/[^\\d.,-\\s]/g, '').trim();
            
            // Patrones robustos
            const patterns = [
                /^(-?\\d+\\.\\d+)\\s*,\\s*(-?\\d+\\.\\d+)$/,
                /^(-?\\d+\\.\\d+)\\s+,\\s+(-?\\d+\\.\\d+)$/,
                /^(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)$/,
                /^(-?\\d+)\\s*,\\s*(-?\\d+)$/,
                /^(-?\\d+\\.\\d+)\\s*,\\s*(-?\\d+)$/,
                /^(-?\\d+)\\s*,\\s*(-?\\d+\\.\\d+)$/
            ];
            
            for (const pattern of patterns) {
                const match = cleaned.match(pattern);
                if (match) {
                    const lat = parseFloat(match[1]);
                    const lng = parseFloat(match[2]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                            return { lat, lng };
                        }
                    }
                }
            }
            
            return null;
        }`;

    // Reemplazar la función parseCoordinates problemática
    const oldParserPattern = /\/\/ Parser de coordenadas mejorado[\s\S]*?return null;\s*}/;
    const fixedContent = content.replace(oldParserPattern, fixedParserFunction);
    
    // Guardar el archivo corregido
    await fs.writeFile('./validador-fresco-corregido.html', fixedContent);
    
    console.log('✅ Validador fresco corregido creado: validador-fresco-corregido.html');
    
    // Probar que el parser funciona
    console.log('\n🧪 PROBANDO PARSER CORREGIDO:');
    
    // Simular el parser en Node.js
    function testParser(input) {
      if (!input) return null;
      
      const cleaned = input.replace(/[^\d.,-\s]/g, '').trim();
      
      const patterns = [
          /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/,
          /^(-?\d+\.\d+)\s+,\s+(-?\d+\.\d+)$/,
          /^(-?\d+\.\d+)\s+(-?\d+\.\d+)$/,
          /^(-?\d+)\s*,\s*(-?\d+)$/,
          /^(-?\d+\.\d+)\s*,\s*(-?\d+)$/,
          /^(-?\d+)\s*,\s*(-?\d+\.\d+)$/
      ];
      
      for (const pattern of patterns) {
          const match = cleaned.match(pattern);
          if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              
              if (!isNaN(lat) && !isNaN(lng)) {
                  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                      return { lat, lng };
                  }
              }
          }
      }
      
      return null;
    }
    
    const testFormats = [
      "25.672254063040413, -100.31993472423136",
      "25.123456, -100.123456",
      "25, -100",
      "25.5 -100.5"
    ];
    
    testFormats.forEach(format => {
      const result = testParser(format);
      console.log(`"${format}" → ${result ? `✅ ${result.lat}, ${result.lng}` : '❌ FALLA'}`);
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  await fixValidator();
  process.exit(0);
}

main();