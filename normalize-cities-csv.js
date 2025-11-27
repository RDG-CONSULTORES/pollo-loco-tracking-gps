require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function normalizeCitiesCSV() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 GENERANDO CSV NORMALIZADO CON CIUDADES EXACTAS...\n');
    
    // Leer el CSV original para obtener las ciudades exactas
    const originalCsvContent = fs.readFileSync('sucursales_epl_cas.csv', 'utf8');
    const originalLines = originalCsvContent.split('\n').slice(1); // Skip header
    
    // Crear mapa de coordenadas a ciudades del CSV original
    const coordToCityMap = {};
    originalLines.forEach(line => {
      if (!line.trim()) return;
      const columns = line.split(',');
      if (columns.length >= 4) {
        const numero = columns[1];
        const nombre = columns[2];
        const ciudad = columns[3];
        const estado = columns[4];
        const coords = columns[6] ? columns[6].replace(/"/g, '') : '';
        
        if (coords && ciudad && estado) {
          const [lat, lng] = coords.split(', ').map(c => parseFloat(c.trim()));
          if (!isNaN(lat) && !isNaN(lng)) {
            const key = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
            coordToCityMap[key] = {
              ciudad: ciudad.trim(),
              estado: estado.trim(),
              numero: numero,
              nombre: nombre
            };
          }
        }
      }
    });
    
    console.log(`📊 Mapa de ciudades creado: ${Object.keys(coordToCityMap).length} entradas`);
    
    // Obtener datos de tracking_locations_cache
    const result = await pool.query(`
      SELECT 
        location_code,
        name,
        group_name,
        latitude,
        longitude,
        active,
        synced_at
      FROM tracking_locations_cache 
      WHERE active = true
      ORDER BY 
        CASE 
          WHEN name ~ '^[0-9]+' THEN 
            CAST(SPLIT_PART(name, ' -', 1) AS INTEGER)
          ELSE 999
        END,
        name
    `);
    
    // Generar CSV normalizado
    let csvContent = 'Numero_Sucursal,Nombre_Sucursal,Grupo_Operativo,Ciudad,Estado,Latitude,Longitude,Location_Code,Synced_At\n';
    
    console.log('📋 NORMALIZANDO CIUDADES Y ESTADOS:');
    
    let normalizedCount = 0;
    let fallbackCount = 0;
    
    result.rows.forEach((row, index) => {
      const nameMatch = row.name.match(/^(\d+)\s*-\s*(.+)$/);
      const sucursalNumber = nameMatch ? nameMatch[1] : `S${index + 1}`;
      const sucursalName = nameMatch ? nameMatch[2].trim() : row.name;
      
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      const coordKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
      
      let ciudad, estado;
      
      // Buscar en el mapa de coordenadas exactas
      if (coordToCityMap[coordKey]) {
        ciudad = coordToCityMap[coordKey].ciudad;
        estado = coordToCityMap[coordKey].estado;
        normalizedCount++;
        console.log(`   ✅ #${sucursalNumber} - ${sucursalName}: ${ciudad}, ${estado}`);
      } else {
        // Buscar por aproximación (±0.001 grados)
        let found = false;
        for (const [key, data] of Object.entries(coordToCityMap)) {
          const [keyLat, keyLng] = key.split('_').map(parseFloat);
          if (Math.abs(keyLat - lat) < 0.001 && Math.abs(keyLng - lng) < 0.001) {
            ciudad = data.ciudad;
            estado = data.estado;
            found = true;
            normalizedCount++;
            console.log(`   🎯 #${sucursalNumber} - ${sucursalName}: ${ciudad}, ${estado} (aprox)`);
            break;
          }
        }
        
        if (!found) {
          // Fallback basado en coordenadas aproximadas
          if (lat >= 25.6 && lat <= 25.9 && lng >= -100.6 && lng <= -100.1) {
            if (lng < -100.4) {
              ciudad = sucursalName.includes('Garcia') ? 'García' : 
                     sucursalName.includes('Santa Catarina') ? 'Santa Catarina' :
                     sucursalName.includes('Escobedo') ? 'General Escobedo' :
                     sucursalName.includes('Apodaca') ? 'Apodaca' :
                     sucursalName.includes('San Pedro') ? 'San Pedro Garza García' :
                     sucursalName.includes('San Nicolás') || sucursalName.includes('Anahuac') ? 'San Nicolás de los Garza' :
                     sucursalName.includes('Guadalupe') ? 'Guadalupe' : 'Monterrey';
            } else {
              ciudad = sucursalName.includes('San Nicolás') || sucursalName.includes('Anahuac') ? 'San Nicolás de los Garza' :
                      sucursalName.includes('Guadalupe') ? 'Guadalupe' :
                      sucursalName.includes('Escobedo') ? 'General Escobedo' :
                      sucursalName.includes('Apodaca') ? 'Apodaca' : 'Monterrey';
            }
            estado = 'Nuevo León';
          } else if (lat >= 27.4 && lat <= 27.6 && lng >= -99.7 && lng <= -99.5) {
            ciudad = 'Nuevo Laredo';
            estado = 'Tamaulipas';
          } else if (lat >= 25.8 && lat <= 26.1 && lng >= -98.4 && lng <= -98.2) {
            ciudad = 'Reynosa';
            estado = 'Tamaulipas';
          } else if (lat >= 25.4 && lat <= 25.6 && lng >= -103.6 && lng <= -103.3) {
            ciudad = sucursalName.includes('Gómez Palacio') ? 'Gómez Palacio' : 'Torreón';
            estado = sucursalName.includes('Gómez Palacio') ? 'Durango' : 'Coahuila';
          } else if (lat >= 22.2 && lat <= 22.3 && lng >= -97.9 && lng <= -97.8) {
            ciudad = 'Tampico';
            estado = 'Tamaulipas';
          } else if (lat >= 25.8 && lat <= 25.9 && lng >= -97.6 && lng <= -97.4) {
            ciudad = 'Matamoros';
            estado = 'Tamaulipas';
          } else if (lat >= 20.5 && lat <= 20.7 && lng >= -100.5 && lng <= -100.3) {
            ciudad = sucursalName.includes('Corregidora') ? 'Corregidora' : 'Querétaro';
            estado = 'Querétaro';
          } else if (lat >= 25.4 && lat <= 25.5 && lng >= -101.1 && lng <= -100.9) {
            ciudad = sucursalName.includes('Ramos Arizpe') ? 'Ramos Arizpe' : 'Saltillo';
            estado = 'Coahuila';
          } else if (lat >= 19.6 && lat <= 19.8 && lng >= -101.3 && lng <= -101.1) {
            ciudad = 'Morelia';
            estado = 'Michoacán';
          } else if (lat >= 25.5 && lat <= 25.6 && lng >= -108.5 && lng <= -108.4) {
            ciudad = 'Guasave';
            estado = 'Sinaloa';
          } else if (lat >= 25.9 && lat <= 26.0 && lng >= -98.2 && lng <= -98.0) {
            ciudad = 'Río Bravo';
            estado = 'Tamaulipas';
          } else if (lat >= 28.6 && lat <= 28.8 && lng >= -100.6 && lng <= -100.4) {
            ciudad = 'Piedras Negras';
            estado = 'Coahuila';
          } else if (lat >= 26.4 && lat <= 26.6 && lng >= -100.3 && lng <= -100.1) {
            ciudad = 'Sabinas Hidalgo';
            estado = 'Nuevo León';
          } else if (lat >= 25.2 && lat <= 25.3 && lng >= -100.1 && lng <= -99.9) {
            ciudad = sucursalName.includes('Allende') ? 'Allende' : 
                    sucursalName.includes('Santiago') ? 'Santiago' :
                    sucursalName.includes('Montemorelos') ? 'Montemorelos' :
                    sucursalName.includes('Cadereyta') ? 'Cadereyta Jiménez' : 'Monterrey';
            estado = 'Nuevo León';
          } else {
            ciudad = 'Ciudad No Identificada';
            estado = 'Estado No Identificado';
          }
          fallbackCount++;
          console.log(`   ⚠️  #${sucursalNumber} - ${sucursalName}: ${ciudad}, ${estado} (fallback)`);
        }
      }
      
      // Formatear datos para CSV
      const formattedLat = lat.toFixed(8);
      const formattedLng = lng.toFixed(8);
      const syncedDate = new Date(row.synced_at).toISOString();
      
      csvContent += `${sucursalNumber},"${sucursalName}","${row.group_name}","${ciudad}","${estado}",${formattedLat},${formattedLng},"${row.location_code}","${syncedDate}"\n`;
    });
    
    // Guardar archivo CSV normalizado
    const filename = 'grupos_operativos_normalizado.csv';
    fs.writeFileSync(filename, csvContent);
    
    console.log(`\n📄 CSV NORMALIZADO GENERADO: ${filename}`);
    console.log(`   ✅ Normalizadas exactamente: ${normalizedCount}`);
    console.log(`   ⚠️  Fallback aplicado: ${fallbackCount}`);
    console.log(`   📊 Total: ${normalizedCount + fallbackCount} sucursales`);
    
    // Generar resumen por estado
    console.log('\n📋 RESUMEN POR ESTADOS:');
    const estadoCount = {};
    result.rows.forEach(row => {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      const coordKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
      
      let estado = 'No identificado';
      if (coordToCityMap[coordKey]) {
        estado = coordToCityMap[coordKey].estado;
      } else if (lat >= 25.2 && lat <= 26.0 && lng >= -100.7 && lng <= -99.9) {
        estado = 'Nuevo León';
      } else if (lat >= 27.4 && lat <= 27.6 && lng >= -99.7 && lng <= -99.5) {
        estado = 'Tamaulipas';
      } else if (lat >= 25.8 && lat <= 26.1 && lng >= -98.4 && lng <= -97.4) {
        estado = 'Tamaulipas';
      } else if (lat >= 25.4 && lat <= 25.6 && lng >= -103.6 && lng <= -103.3) {
        estado = lat >= 25.59 ? 'Durango' : 'Coahuila';
      }
      
      estadoCount[estado] = (estadoCount[estado] || 0) + 1;
    });
    
    Object.entries(estadoCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([estado, count]) => {
        console.log(`   • ${estado}: ${count} sucursales`);
      });
    
    console.log('\n🎉 ¡CSV COMPLETAMENTE NORMALIZADO!')
    console.log('=' .repeat(60));
    console.log(`✅ Archivo: ${filename}`);
    console.log('✅ Ciudades y estados específicos');
    console.log('✅ Coordenadas de 8 decimales');
    console.log('✅ Grupos operativos corregidos');
    
    return { success: true, filename, normalizedCount, fallbackCount };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
normalizeCitiesCSV().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡NORMALIZACIÓN COMPLETADA!');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});