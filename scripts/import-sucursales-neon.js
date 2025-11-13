require('dotenv').config();
const { Client } = require('pg');

/**
 * Importar sucursales desde base de datos Neon
 * Conecta a Neon, extrae sucursales y las importa a Railway
 */
async function importSucursalesFromNeon() {
  let neonClient, railwayClient;
  
  try {
    console.log('🏢 Importando sucursales desde Neon...');
    
    // Conectar a Neon (origen)
    neonClient = new Client({
      connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    
    // Conectar a Railway (destino)
    railwayClient = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await neonClient.connect();
    console.log('✅ Conectado a Neon');
    
    await railwayClient.connect();
    console.log('✅ Conectado a Railway');
    
    // Extraer sucursales únicas desde Neon
    console.log('\n📊 Extrayendo sucursales desde supervision_operativa_clean...');
    
    const sucursalesResult = await neonClient.query(`
      SELECT DISTINCT
        location_name,
        sucursal_clean,
        estado_normalizado as estado,
        municipio,
        latitud,
        longitud,
        grupo_operativo_limpio as grupo_operativo,
        COUNT(*) as total_supervisiones
      FROM supervision_operativa_clean
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL
        AND location_name IS NOT NULL
        AND grupo_operativo_limpio IS NOT NULL
        AND grupo_operativo_limpio != 'REQUIERE_MAPEO_MANUAL'
      GROUP BY location_name, sucursal_clean, estado_normalizado, municipio, 
               latitud, longitud, grupo_operativo_limpio
      ORDER BY grupo_operativo_limpio, location_name
    `);
    
    console.log(`📋 Encontradas ${sucursalesResult.rows.length} sucursales únicas`);
    
    // Mostrar resumen por grupo
    const grupoStats = {};
    sucursalesResult.rows.forEach(sucursal => {
      const grupo = sucursal.grupo_operativo;
      if (!grupoStats[grupo]) grupoStats[grupo] = 0;
      grupoStats[grupo]++;
    });
    
    console.log('\n📊 Resumen por grupo operativo:');
    Object.entries(grupoStats).forEach(([grupo, cantidad]) => {
      console.log(`  - ${grupo}: ${cantidad} sucursales`);
    });
    
    // Limpiar tabla de sucursales en Railway
    console.log('\n🧹 Limpiando tabla tracking_locations_cache...');
    await railwayClient.query('DELETE FROM tracking_locations_cache');
    
    // Importar sucursales a Railway
    console.log('\n📥 Importando sucursales a Railway...');
    
    let importedCount = 0;
    for (const sucursal of sucursalesResult.rows) {
      try {
        // Extraer número de sucursal del location_name si existe
        const locationCodeMatch = sucursal.location_name.match(/^(\d+)\s*-/);
        const locationCode = locationCodeMatch ? locationCodeMatch[1] : `AUTO_${importedCount + 1}`;
        
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
        `, [
          locationCode,
          sucursal.location_name,
          `${sucursal.municipio}, ${sucursal.estado}`,
          parseFloat(sucursal.latitud),
          parseFloat(sucursal.longitud),
          sucursal.grupo_operativo,
          'Director TBD', // Se puede mapear después
          true,
          150 // Radio por defecto de 150 metros
        ]);
        
        importedCount++;
        
        if (importedCount % 10 === 0) {
          console.log(`  ✅ Importadas ${importedCount}/${sucursalesResult.rows.length} sucursales`);
        }
        
      } catch (error) {
        console.error(`❌ Error importando ${sucursal.location_name}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Importación completada: ${importedCount} sucursales importadas`);
    
    // Verificar importación
    const verifyResult = await railwayClient.query(`
      SELECT 
        group_name,
        COUNT(*) as total,
        MIN(name) as primera_sucursal,
        MAX(name) as ultima_sucursal
      FROM tracking_locations_cache 
      WHERE active = true
      GROUP BY group_name
      ORDER BY group_name
    `);
    
    console.log('\n📊 Verificación - Sucursales por grupo:');
    verifyResult.rows.forEach(grupo => {
      console.log(`  - ${grupo.group_name}: ${grupo.total} sucursales`);
      console.log(`    → Primera: ${grupo.primera_sucursal}`);
      console.log(`    → Última: ${grupo.ultima_sucursal}`);
    });
    
    console.log('\n✅ Importación exitosa! El dashboard ahora tendrá datos reales.');
    
  } catch (error) {
    console.error('💥 Error en importación:', error);
  } finally {
    if (neonClient) await neonClient.end();
    if (railwayClient) await railwayClient.end();
  }
}

// Ejecutar
if (require.main === module) {
  importSucursalesFromNeon()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = importSucursalesFromNeon;