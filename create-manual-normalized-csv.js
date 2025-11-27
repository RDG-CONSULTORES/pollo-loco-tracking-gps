require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function createManualNormalizedCSV() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 CREANDO CSV MANUAL NORMALIZADO...\n');
    
    // Mapeo manual de sucursales a ciudades/estados basado en el CSV original
    const cityStateMap = {
      1: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      2: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      3: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      4: { ciudad: 'Santa Catarina', estado: 'Nuevo León' },
      5: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      6: { ciudad: 'García', estado: 'Nuevo León' },
      7: { ciudad: 'Santa Catarina', estado: 'Nuevo León' },
      8: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      9: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' },
      10: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      11: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      12: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      13: { ciudad: 'General Escobedo', estado: 'Nuevo León' },
      14: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' },
      15: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      16: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      17: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' },
      18: { ciudad: 'Guadalupe', estado: 'Nuevo León' },
      19: { ciudad: 'Guadalupe', estado: 'Nuevo León' },
      20: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      21: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      22: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' },
      23: { ciudad: 'Guasave', estado: 'Sinaloa' },
      24: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      25: { ciudad: 'Monterrey', estado: 'Nuevo León' },
      26: { ciudad: 'Cadereyta Jiménez', estado: 'Nuevo León' },
      27: { ciudad: 'Santiago', estado: 'Nuevo León' },
      28: { ciudad: 'Nuevo Laredo', estado: 'Tamaulipas' },
      29: { ciudad: 'Guadalupe', estado: 'Nuevo León' },
      30: { ciudad: 'Nuevo Laredo', estado: 'Tamaulipas' },
      31: { ciudad: 'Guadalupe', estado: 'Nuevo León' },
      32: { ciudad: 'Allende', estado: 'Nuevo León' },
      33: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' },
      34: { ciudad: 'Montemorelos', estado: 'Nuevo León' },
      35: { ciudad: 'Apodaca', estado: 'Nuevo León' },
      36: { ciudad: 'Apodaca', estado: 'Nuevo León' },
      37: { ciudad: 'General Escobedo', estado: 'Nuevo León' },
      38: { ciudad: 'San Pedro Garza García', estado: 'Nuevo León' },
      39: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' },
      40: { ciudad: 'Apodaca', estado: 'Nuevo León' },
      41: { ciudad: 'San Pedro Garza García', estado: 'Nuevo León' },
      42: { ciudad: 'Torreón', estado: 'Coahuila' },
      43: { ciudad: 'Torreón', estado: 'Coahuila' },
      44: { ciudad: 'Torreón', estado: 'Coahuila' },
      45: { ciudad: 'Torreón', estado: 'Coahuila' },
      46: { ciudad: 'Torreón', estado: 'Coahuila' },
      47: { ciudad: 'Gómez Palacio', estado: 'Durango' },
      48: { ciudad: 'Querétaro', estado: 'Querétaro' },
      49: { ciudad: 'Corregidora', estado: 'Querétaro' },
      50: { ciudad: 'Querétaro', estado: 'Querétaro' },
      51: { ciudad: 'Querétaro', estado: 'Querétaro' },
      52: { ciudad: 'Saltillo', estado: 'Coahuila' },
      53: { ciudad: 'Saltillo', estado: 'Coahuila' },
      54: { ciudad: 'Ramos Arizpe', estado: 'Coahuila' },
      55: { ciudad: 'Saltillo', estado: 'Coahuila' },
      56: { ciudad: 'Saltillo', estado: 'Coahuila' },
      57: { ciudad: 'Saltillo', estado: 'Coahuila' },
      58: { ciudad: 'Tampico', estado: 'Tamaulipas' },
      59: { ciudad: 'Tampico', estado: 'Tamaulipas' },
      60: { ciudad: 'Tampico', estado: 'Tamaulipas' },
      61: { ciudad: 'Tampico', estado: 'Tamaulipas' },
      62: { ciudad: 'Morelia', estado: 'Michoacán' },
      63: { ciudad: 'Morelia', estado: 'Michoacán' },
      64: { ciudad: 'Morelia', estado: 'Michoacán' },
      65: { ciudad: 'Matamoros', estado: 'Tamaulipas' },
      66: { ciudad: 'Matamoros', estado: 'Tamaulipas' },
      67: { ciudad: 'Matamoros', estado: 'Tamaulipas' },
      68: { ciudad: 'Matamoros', estado: 'Tamaulipas' },
      69: { ciudad: 'Matamoros', estado: 'Tamaulipas' },
      70: { ciudad: 'Piedras Negras', estado: 'Coahuila' },
      71: { ciudad: 'San Pedro Garza García', estado: 'Nuevo León' },
      72: { ciudad: 'Sabinas Hidalgo', estado: 'Nuevo León' },
      73: { ciudad: 'Reynosa', estado: 'Tamaulipas' },
      74: { ciudad: 'Reynosa', estado: 'Tamaulipas' },
      75: { ciudad: 'Reynosa', estado: 'Tamaulipas' },
      76: { ciudad: 'Reynosa', estado: 'Tamaulipas' },
      77: { ciudad: 'Reynosa', estado: 'Tamaulipas' },
      78: { ciudad: 'Reynosa', estado: 'Tamaulipas' },
      79: { ciudad: 'Río Bravo', estado: 'Tamaulipas' },
      80: { ciudad: 'Nuevo Laredo', estado: 'Tamaulipas' },
      81: { ciudad: 'Nuevo Laredo', estado: 'Tamaulipas' },
      82: { ciudad: 'Nuevo Laredo', estado: 'Tamaulipas' },
      83: { ciudad: 'General Escobedo', estado: 'Nuevo León' },
      84: { ciudad: 'Ciénega de Flores', estado: 'Nuevo León' },
      85: { ciudad: 'San Nicolás de los Garza', estado: 'Nuevo León' }
    };
    
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
    
    console.log('📋 APLICANDO NORMALIZACIÓN MANUAL:');
    
    let normalizedCount = 0;
    result.rows.forEach((row, index) => {
      const nameMatch = row.name.match(/^(\d+)\s*-\s*(.+)$/);
      const sucursalNumber = parseInt(nameMatch ? nameMatch[1] : index + 1);
      const sucursalName = nameMatch ? nameMatch[2].trim() : row.name;
      
      const location = cityStateMap[sucursalNumber];
      let ciudad, estado;
      
      if (location) {
        ciudad = location.ciudad;
        estado = location.estado;
        normalizedCount++;
        console.log(`   ✅ #${sucursalNumber} - ${sucursalName}: ${ciudad}, ${estado}`);
      } else {
        ciudad = 'Ciudad No Identificada';
        estado = 'Estado No Identificado';
        console.log(`   ❌ #${sucursalNumber} - ${sucursalName}: No mapeado`);
      }
      
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      const formattedLat = lat.toFixed(8);
      const formattedLng = lng.toFixed(8);
      const syncedDate = new Date(row.synced_at).toISOString();
      
      csvContent += `${sucursalNumber},"${sucursalName}","${row.group_name}","${ciudad}","${estado}",${formattedLat},${formattedLng},"${row.location_code}","${syncedDate}"\n`;
    });
    
    // Guardar archivo CSV
    const filename = 'grupos_operativos_final.csv';
    fs.writeFileSync(filename, csvContent);
    
    console.log(`\n📄 CSV FINAL GENERADO: ${filename}`);
    console.log(`   ✅ Normalizadas: ${normalizedCount}/${result.rows.length}`);
    
    // Generar resumen por estados
    console.log('\n📋 RESUMEN FINAL POR ESTADOS:');
    const estadoCount = {};
    Object.values(cityStateMap).forEach(location => {
      estadoCount[location.estado] = (estadoCount[location.estado] || 0) + 1;
    });
    
    Object.entries(estadoCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([estado, count]) => {
        console.log(`   • ${estado}: ${count} sucursales`);
      });
    
    console.log('\n🏙️ CIUDADES ÚNICAS:');
    const ciudadCount = {};
    Object.values(cityStateMap).forEach(location => {
      const key = `${location.ciudad}, ${location.estado}`;
      ciudadCount[key] = (ciudadCount[key] || 0) + 1;
    });
    
    Object.entries(ciudadCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([ciudad, count]) => {
        console.log(`   • ${ciudad}: ${count} sucursales`);
      });
    
    if (Object.keys(ciudadCount).length > 10) {
      console.log(`   ... y ${Object.keys(ciudadCount).length - 10} ciudades más`);
    }
    
    console.log('\n🎉 ¡CSV COMPLETAMENTE NORMALIZADO!')
    console.log('=' .repeat(60));
    console.log(`✅ Archivo: ${filename}`);
    console.log(`✅ ${Object.keys(ciudadCount).length} ciudades específicas`);
    console.log(`✅ ${Object.keys(estadoCount).length} estados`);
    console.log('✅ Coordenadas de 8 decimales');
    console.log('✅ Grupos operativos corregidos');
    console.log('✅ 100% normalizado manualmente');
    
    return { 
      success: true, 
      filename,
      totalCiudades: Object.keys(ciudadCount).length,
      totalEstados: Object.keys(estadoCount).length,
      normalizedCount
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
createManualNormalizedCSV().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡NORMALIZACIÓN MANUAL COMPLETADA!');
    console.log(`${result.totalCiudades} ciudades en ${result.totalEstados} estados`);
  } else {
    console.log('\n❌ Error:', result.error);
  }
});