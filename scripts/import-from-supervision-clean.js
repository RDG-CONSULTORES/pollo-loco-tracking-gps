require('dotenv').config();
const { Client } = require('pg');

/**
 * Importar sucursales directamente desde supervision_operativa_clean
 * Usa la MISMA tabla que el dashboard-ios-complete.html
 */
async function importFromSupervisionClean() {
  let railwayClient, neonClient;
  
  try {
    console.log('🏢 Importando desde supervision_operativa_clean (fuente del dashboard)...');
    
    // Conectar a Railway (destino)
    const databaseUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('❌ No DATABASE_URL found');
    }
    
    railwayClient = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    // Conectar a Neon (supervision_operativa_clean - MISMA tabla del dashboard)
    neonClient = new Client({
      connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    
    await railwayClient.connect();
    await neonClient.connect();
    console.log('✅ Conectado a Railway y Neon');
    
    // Usar la MISMA consulta que el dashboard para mapData
    console.log('\\n📊 Extrayendo datos con la consulta del dashboard...');
    
    const sucursalesResult = await neonClient.query(`
      SELECT 
        location_id,
        location_name as sucursal,
        grupo_operativo_limpio as grupo_operativo,
        estado_normalizado as estado,
        municipio,
        latitud::float,
        longitud::float,
        ROUND(
          CASE 
            WHEN SUM(CASE WHEN area_evaluacion = '' THEN 1 ELSE 0 END) > 0 
            THEN AVG(CASE WHEN area_evaluacion = '' THEN porcentaje END)
            ELSE AVG(porcentaje) 
          END::numeric, 2
        ) as promedio,
        COUNT(DISTINCT area_evaluacion) as areas_evaluadas,
        COUNT(DISTINCT submission_id) as total_supervisiones,
        CASE 
          WHEN AVG(porcentaje) >= 90 THEN 'success'
          WHEN AVG(porcentaje) >= 70 THEN 'warning'
          ELSE 'danger'
        END as status
      FROM supervision_operativa_clean
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL 
        AND porcentaje IS NOT NULL
        AND grupo_operativo_limpio IS NOT NULL
        AND grupo_operativo_limpio != ''
      GROUP BY location_id, location_name, grupo_operativo_limpio, estado_normalizado, municipio, latitud, longitud
      HAVING COUNT(DISTINCT area_evaluacion) > 5
      ORDER BY grupo_operativo_limpio, location_name
    `);
    
    console.log(`📋 Encontradas ${sucursalesResult.rows.length} sucursales (misma consulta del dashboard)`);
    
    // Mostrar resumen por grupo (estructura exacta del dashboard)
    const gruposCount = {};
    sucursalesResult.rows.forEach(row => {
      const grupo = row.grupo_operativo;
      if (!gruposCount[grupo]) gruposCount[grupo] = 0;
      gruposCount[grupo]++;
    });
    
    console.log('\\n📊 Estructura exacta del dashboard:');
    Object.entries(gruposCount).sort().forEach(([grupo, count]) => {
      console.log(`  ✅ ${grupo}: ${count} sucursales`);
    });
    
    // Verificar TEPEYAC específicamente
    const tepeyacSucursales = sucursalesResult.rows.filter(r => r.grupo_operativo === 'TEPEYAC');
    console.log(`\\n🎯 TEPEYAC verificación:`);
    console.log(`  📍 Total: ${tepeyacSucursales.length} sucursales`);
    tepeyacSucursales.forEach(s => {
      console.log(`    - ${s.sucursal} (${s.municipio})`);
    });
    
    // Limpiar tabla de sucursales
    console.log('\\n🧹 Limpiando tracking_locations_cache...');
    await railwayClient.query('DELETE FROM tracking_locations_cache');
    
    // Importar sucursales
    console.log('\\n📥 Importando sucursales...');
    
    let importedCount = 0;
    for (const sucursal of sucursalesResult.rows) {
      try {
        // Extraer código de sucursal del nombre
        const codigoMatch = sucursal.sucursal.match(/^(\\d+)\\s*-?\\s*/);
        const locationCode = codigoMatch ? codigoMatch[1] : sucursal.location_id || `AUTO_${importedCount + 1}`;
        
        await railwayClient.query(`
          INSERT INTO tracking_locations_cache (
            location_code,
            name,
            address,
            latitude,
            longitude,
            group_name,
            director_name,
            active,
            geofence_radius,
            synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (location_code) DO UPDATE SET
            name = EXCLUDED.name,
            group_name = EXCLUDED.group_name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            address = EXCLUDED.address,
            synced_at = NOW()
        `, [
          locationCode,
          sucursal.sucursal,
          `${sucursal.municipio}, ${sucursal.estado}`,
          sucursal.latitud,
          sucursal.longitud,
          sucursal.grupo_operativo,
          'Director TBD',
          true,
          150 // Radio por defecto
        ]);
        
        importedCount++;
        
        if (importedCount % 10 === 0) {
          console.log(`  ✅ Importadas ${importedCount}/${sucursalesResult.rows.length} sucursales`);
        }
        
      } catch (error) {
        console.error(`❌ Error importando ${sucursal.sucursal}: ${error.message}`);
      }
    }
    
    console.log(`\\n🎉 Importación completada: ${importedCount} sucursales`);
    
    // Verificación final usando la misma consulta del dashboard
    const verificacion = await railwayClient.query(`
      SELECT 
        group_name,
        COUNT(*) as total,
        MIN(name) as primera,
        MAX(name) as ultima
      FROM tracking_locations_cache 
      WHERE active = true
      GROUP BY group_name
      ORDER BY group_name
    `);
    
    console.log('\\n📊 Verificación final - Estructura idéntica al dashboard:');
    verificacion.rows.forEach(grupo => {
      console.log(`  ✅ ${grupo.group_name}: ${grupo.total} sucursales`);
    });
    
    // Verificación específica TEPEYAC
    const tepeyacFinal = await railwayClient.query(`
      SELECT name, address 
      FROM tracking_locations_cache 
      WHERE group_name = 'TEPEYAC' 
      ORDER BY name
    `);
    
    console.log(`\\n🎯 TEPEYAC final (${tepeyacFinal.rows.length} sucursales):`);
    tepeyacFinal.rows.forEach(s => {
      console.log(`  - ${s.name} (${s.address})`);
    });
    
    console.log('\\n✅ ¡Estructura EXACTA del dashboard importada!');
    console.log('🔗 Fuente: supervision_operativa_clean (misma tabla del dashboard)');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (railwayClient) await railwayClient.end();
    if (neonClient) await neonClient.end();
  }
}

if (require.main === module) {
  importFromSupervisionClean()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = importFromSupervisionClean;