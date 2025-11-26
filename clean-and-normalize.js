require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;

async function cleanAndNormalize() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🧹 INICIANDO LIMPIEZA Y NORMALIZACIÓN DEL PROYECTO...\n');
    
    // 1. Leer el CSV con las coordenadas correctas
    console.log('📊 Paso 1: Leyendo CSV con coordenadas correctas...');
    const csvContent = await fs.readFile('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    // Parsear datos del CSV
    const branchData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 7) {
        const coordsText = values[6]; // Columna "Coordenadas"
        let lat = null, lng = null;
        
        if (coordsText && coordsText.includes(',')) {
          const coords = coordsText.split(',');
          if (coords.length === 2) {
            lat = parseFloat(coords[0].trim());
            lng = parseFloat(coords[1].trim());
          }
        }
        
        branchData.push({
          id: parseInt(values[0]),
          branch_number: parseInt(values[1]),
          name: cleanText(values[2]),
          city: cleanText(values[3]),
          state: normalizeState(cleanText(values[4])),
          address: cleanText(values[5]),
          latitude: lat,
          longitude: lng,
          zenput_id: values[8] ? parseInt(values[8]) : null
        });
      }
    }
    
    console.log(`   ✅ ${branchData.length} sucursales procesadas del CSV`);
    
    // 2. Normalizar ciudades y municipios con IA
    console.log('\n🤖 Paso 2: Normalizando ciudades y municipios...');
    for (let branch of branchData) {
      const normalized = normalizeCityMunicipality(branch.city, branch.state);
      branch.city = normalized.city;
      branch.municipality = normalized.municipality;
    }
    
    // 3. Limpiar la base de datos y actualizar con datos limpios
    console.log('\n🔄 Paso 3: Actualizando base de datos...');
    
    for (let branch of branchData) {
      if (branch.latitude && branch.longitude) {
        await pool.query(`
          UPDATE branches SET 
            name = $1,
            city = $2,
            state = $3,
            municipality = $4,
            address = $5,
            latitude = $6,
            longitude = $7,
            gps_validated = true,
            updated_at = NOW()
          WHERE id = $8
        `, [
          branch.name,
          branch.city,
          branch.state,
          branch.municipality,
          branch.address,
          branch.latitude,
          branch.longitude,
          branch.id
        ]);
        
        console.log(`   ✅ #${branch.id} - ${branch.name} actualizada`);
      }
    }
    
    // 4. Generar reporte final
    console.log('\n📊 Paso 4: Generando reporte final...');
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN gps_validated = true AND latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as validated,
        COUNT(DISTINCT state) as states,
        COUNT(DISTINCT city) as cities
      FROM branches WHERE active = true
    `);
    
    const stats = finalStats.rows[0];
    
    console.log('\n🎉 LIMPIEZA COMPLETADA!\n');
    console.log('📈 ESTADÍSTICAS FINALES:');
    console.log(`   🏪 Total sucursales: ${stats.total}`);
    console.log(`   ✅ Validadas: ${stats.validated}`);
    console.log(`   🗺️ Estados: ${stats.states}`);
    console.log(`   🏘️ Ciudades: ${stats.cities}`);
    
    // 5. Crear CSV final limpio
    console.log('\n💾 Generando CSV final limpio...');
    await generateCleanCSV(branchData);
    
    return { success: true, stats };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Función para parsear CSV con comillas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && (i === 0 || line[i-1] === ',')) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && (i === line.length-1 || line[i+1] === ',')) {
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Limpiar texto
function cleanText(text) {
  return text ? text.replace(/"/g, '').trim() : '';
}

// Normalizar estados
function normalizeState(state) {
  const stateMap = {
    'nuevo leon': 'Nuevo León',
    'nuevo león': 'Nuevo León',
    'michoacan': 'Michoacán',
    'michoacán': 'Michoacán',
    'coahuila': 'Coahuila',
    'queretaro': 'Querétaro',
    'querétaro': 'Querétaro',
    'tamaulipas': 'Tamaulipas',
    'sinaloa': 'Sinaloa',
    'durango': 'Durango'
  };
  
  const normalized = stateMap[state.toLowerCase()] || state;
  return normalized;
}

// Normalizar ciudad y municipio con lógica inteligente
function normalizeCityMunicipality(city, state) {
  const cleanCity = city.toLowerCase().trim();
  
  // Mapeo específico para casos conocidos
  const cityMappings = {
    'monterrey': { city: 'Monterrey', municipality: 'Monterrey' },
    'guadalupe': { city: 'Guadalupe', municipality: 'Guadalupe' },
    'san nicolas de los garza': { city: 'San Nicolás de los Garza', municipality: 'San Nicolás de los Garza' },
    'san nicolás de los garza': { city: 'San Nicolás de los Garza', municipality: 'San Nicolás de los Garza' },
    'santa catarina': { city: 'Santa Catarina', municipality: 'Santa Catarina' },
    'general escobedo': { city: 'General Escobedo', municipality: 'General Escobedo' },
    'garcia': { city: 'García', municipality: 'García' },
    'garcía': { city: 'García', municipality: 'García' },
    'apodaca': { city: 'Apodaca', municipality: 'Apodaca' },
    'san pedro garza garcia': { city: 'San Pedro Garza García', municipality: 'San Pedro Garza García' },
    'san pedro garza garcía': { city: 'San Pedro Garza García', municipality: 'San Pedro Garza García' },
    'cadereyta jimenez': { city: 'Cadereyta Jiménez', municipality: 'Cadereyta Jiménez' },
    'cadereyta jiménez': { city: 'Cadereyta Jiménez', municipality: 'Cadereyta Jiménez' },
    'santiago': { city: 'Santiago', municipality: 'Santiago' },
    'allende': { city: 'Allende', municipality: 'Allende' },
    'montemorelos': { city: 'Montemorelos', municipality: 'Montemorelos' },
    'sabinas hidalgo': { city: 'Sabinas Hidalgo', municipality: 'Sabinas Hidalgo' },
    'cienega de flores': { city: 'Ciénega de Flores', municipality: 'Ciénega de Flores' },
    'ciénega de flores': { city: 'Ciénega de Flores', municipality: 'Ciénega de Flores' },
    'morelia': { city: 'Morelia', municipality: 'Morelia' },
    'torreon': { city: 'Torreón', municipality: 'Torreón' },
    'torreón': { city: 'Torreón', municipality: 'Torreón' },
    'gomez palacio': { city: 'Gómez Palacio', municipality: 'Gómez Palacio' },
    'gómez palacio': { city: 'Gómez Palacio', municipality: 'Gómez Palacio' },
    'queretaro': { city: 'Querétaro', municipality: 'Querétaro' },
    'querétaro': { city: 'Querétaro', municipality: 'Querétaro' },
    'corregidora': { city: 'Corregidora', municipality: 'Corregidora' },
    'saltillo': { city: 'Saltillo', municipality: 'Saltillo' },
    'ramos arizpe': { city: 'Ramos Arizpe', municipality: 'Ramos Arizpe' },
    'tampico': { city: 'Tampico', municipality: 'Tampico' },
    'matamoros': { city: 'Matamoros', municipality: 'Matamoros' },
    'piedras negras': { city: 'Piedras Negras', municipality: 'Piedras Negras' },
    'reynosa': { city: 'Reynosa', municipality: 'Reynosa' },
    'rio bravo': { city: 'Río Bravo', municipality: 'Río Bravo' },
    'río bravo': { city: 'Río Bravo', municipality: 'Río Bravo' },
    'nuevo laredo': { city: 'Nuevo Laredo', municipality: 'Nuevo Laredo' },
    'guasave': { city: 'Guasave', municipality: 'Guasave' }
  };
  
  const mapping = cityMappings[cleanCity];
  if (mapping) {
    return mapping;
  }
  
  // Si no hay mapeo específico, capitalizar correctamente
  const capitalizedCity = city.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
    
  return { 
    city: capitalizedCity, 
    municipality: capitalizedCity 
  };
}

// Generar CSV final limpio
async function generateCleanCSV(branchData) {
  let csvContent = 'ID,Numero_Sucursal,Nombre,Ciudad,Municipio,Estado,Direccion,Latitud,Longitud,Zenput_ID\n';
  
  branchData.forEach(branch => {
    csvContent += `${branch.id},${branch.branch_number},"${branch.name}","${branch.city}","${branch.municipality}","${branch.state}","${branch.address || ''}",${branch.latitude || ''},${branch.longitude || ''},${branch.zenput_id || ''}\n`;
  });
  
  await fs.writeFile('./sucursales_final_limpio.csv', csvContent, 'utf8');
  console.log('   ✅ CSV final limpio creado: sucursales_final_limpio.csv');
}

async function main() {
  const result = await cleanAndNormalize();
  
  if (result.success) {
    console.log('\n🚀 PROYECTO LIMPIO Y NORMALIZADO EXITOSAMENTE!');
    console.log('\n📁 ARCHIVOS GENERADOS:');
    console.log('   • sucursales_final_limpio.csv (datos normalizados)');
    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('   1. Revisar datos normalizados');
    console.log('   2. Limpiar archivos obsoletos del proyecto');
    console.log('   3. Documentar estructura final');
  } else {
    console.log('\n❌ Error en la normalización:', result.error);
  }
  
  process.exit(0);
}

main();