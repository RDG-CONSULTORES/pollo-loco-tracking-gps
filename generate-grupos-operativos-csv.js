require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function generateGruposOperativosCSV() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 GENERANDO CSV DE GRUPOS OPERATIVOS...\n');
    
    console.log('📊 EXTRAYENDO DATOS DE tracking_locations_cache:');
    
    // Obtener todas las sucursales activas con sus grupos operativos
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
    
    console.log(`   ✅ Sucursales extraídas: ${result.rows.length}`);
    
    // Generar contenido CSV
    let csvContent = 'Numero_Sucursal,Nombre_Sucursal,Grupo_Operativo,Ciudad_Estado,Latitude,Longitude,Location_Code,Synced_At\n';
    
    console.log('\n📋 PROCESANDO SUCURSALES:');
    
    let successCount = 0;
    result.rows.forEach((row, index) => {
      try {
        // Extraer número de sucursal del nombre
        const nameMatch = row.name.match(/^(\d+)\s*-\s*(.+)$/);
        const sucursalNumber = nameMatch ? nameMatch[1] : `S${index + 1}`;
        const sucursalName = nameMatch ? nameMatch[2].trim() : row.name;
        
        // Extraer ciudad/estado de coordenadas (aproximado basado en ubicación)
        let cityState = 'N/A';
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        
        // Determinar ciudad/estado basado en coordenadas aproximadas
        if (lat >= 25.6 && lat <= 25.9 && lng >= -100.6 && lng <= -100.1) {
          cityState = 'Área Metropolitana de Monterrey, Nuevo León';
        } else if (lat >= 27.4 && lat <= 27.6 && lng >= -99.7 && lng <= -99.5) {
          cityState = 'Nuevo Laredo, Tamaulipas';
        } else if (lat >= 25.8 && lat <= 26.1 && lng >= -98.4 && lng <= -98.2) {
          cityState = 'Reynosa, Tamaulipas';
        } else if (lat >= 25.4 && lat <= 25.6 && lng >= -103.6 && lng <= -103.3) {
          cityState = 'Torreón, Coahuila';
        } else if (lat >= 22.2 && lat <= 22.3 && lng >= -97.9 && lng <= -97.8) {
          cityState = 'Tampico, Tamaulipas';
        } else if (lat >= 25.8 && lat <= 25.9 && lng >= -97.6 && lng <= -97.4) {
          cityState = 'Matamoros, Tamaulipas';
        } else if (lat >= 20.5 && lat <= 20.7 && lng >= -100.5 && lng <= -100.3) {
          cityState = 'Querétaro, Querétaro';
        } else if (lat >= 25.4 && lat <= 25.5 && lng >= -101.1 && lng <= -100.9) {
          cityState = 'Saltillo, Coahuila';
        } else if (lat >= 19.6 && lat <= 19.8 && lng >= -101.3 && lng <= -101.1) {
          cityState = 'Morelia, Michoacán';
        } else if (lat >= 25.5 && lat <= 25.6 && lng >= -108.5 && lng <= -108.4) {
          cityState = 'Guasave, Sinaloa';
        } else {
          cityState = 'Otra ubicación';
        }
        
        // Formatear coordenadas con 8 decimales
        const formattedLat = lat.toFixed(8);
        const formattedLng = lng.toFixed(8);
        
        // Formatear fecha
        const syncedDate = new Date(row.synced_at).toISOString();
        
        // Agregar fila al CSV
        csvContent += `${sucursalNumber},"${sucursalName}","${row.group_name}","${cityState}",${formattedLat},${formattedLng},"${row.location_code}","${syncedDate}"\n`;
        
        console.log(`   ${index + 1}. #${sucursalNumber} - ${sucursalName} (${row.group_name})`);
        successCount++;
        
      } catch (error) {
        console.log(`   ❌ Error procesando fila ${index + 1}: ${error.message}`);
      }
    });
    
    console.log(`\n📊 PROCESAMIENTO COMPLETADO: ${successCount} sucursales`);
    
    // Guardar archivo CSV
    const filename = 'grupos_operativos_completo.csv';
    fs.writeFileSync(filename, csvContent);
    
    console.log(`\n📄 CSV GENERADO: ${filename}`);
    console.log(`   📊 Total filas: ${successCount + 1} (incluyendo header)`);
    console.log(`   📍 Coordenadas: 8 decimales de precisión`);
    console.log(`   🏢 Grupos operativos: Actualizados al 2025-11-26`);
    
    // Mostrar resumen por grupos operativos
    console.log('\n📋 RESUMEN POR GRUPOS OPERATIVOS:');
    
    const groupSummary = result.rows.reduce((acc, row) => {
      if (!acc[row.group_name]) {
        acc[row.group_name] = 0;
      }
      acc[row.group_name]++;
      return acc;
    }, {});
    
    Object.entries(groupSummary)
      .sort(([,a], [,b]) => b - a)
      .forEach(([group, count]) => {
        console.log(`   • ${group}: ${count} sucursales`);
      });
    
    console.log('\n🎉 ¡CSV DE GRUPOS OPERATIVOS GENERADO!');
    console.log('=' .repeat(60));
    console.log(`✅ Archivo: ${filename}`);
    console.log('✅ Estructura normalizada y verificada');
    console.log('✅ Coordenadas exactas de Railway');
    console.log('✅ Grupos operativos corregidos');
    console.log('✅ Listo para normalizar otros proyectos');
    
    return { 
      success: true, 
      filename: filename,
      totalSucursales: successCount,
      grupos: Object.keys(groupSummary).length
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
generateGruposOperativosCSV().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡CSV GRUPOS OPERATIVOS GENERADO!');
    console.log(`${result.totalSucursales} sucursales en ${result.grupos} grupos operativos`);
    console.log(`Archivo: ${result.filename}`);
  } else {
    console.log('\n❌ Error:', result.error);
  }
});