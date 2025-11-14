const { Client } = require('pg');
require('dotenv').config();

/**
 * Script para importar geofences de las 84 sucursales existentes
 * Usa las coordenadas de tracking_locations_cache para crear geofences circulares
 */
async function importGeofences() {
  console.log('📍 Importando geofences de sucursales...');
  
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // 1. Verificar que existen las tablas necesarias
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('tracking_locations_cache', 'sucursal_geofences')
      ORDER BY table_name
    `);
    
    if (tablesCheck.rows.length !== 2) {
      throw new Error('Faltan tablas requeridas. Ejecutar setup de geofencing primero.');
    }
    
    console.log('✅ Tablas verificadas');
    
    // 2. Obtener sucursales existentes
    const sucursalesResult = await client.query(`
      SELECT 
        location_code,
        name as store_name,
        group_name,
        latitude,
        longitude,
        active,
        created_at
      FROM tracking_locations_cache
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude != 0 
        AND longitude != 0
      ORDER BY group_name, name
    `);
    
    console.log(`📋 Sucursales encontradas: ${sucursalesResult.rows.length}`);
    
    if (sucursalesResult.rows.length === 0) {
      throw new Error('No se encontraron sucursales con coordenadas válidas');
    }
    
    // 3. Limpiar geofences existentes (por si se ejecuta múltiples veces)
    const deleteResult = await client.query(`DELETE FROM sucursal_geofences`);
    console.log(`🧹 Geofences anteriores eliminados: ${deleteResult.rowCount}`);
    
    // 4. Obtener radio por defecto de configuración
    const configResult = await client.query(`
      SELECT value FROM tracking_config WHERE key = 'geofence_default_radius'
    `);
    const defaultRadius = configResult.rows[0]?.value || '150';
    console.log(`📏 Radio por defecto: ${defaultRadius}m`);
    
    // 5. Insertar geofences para cada sucursal
    let imported = 0;
    let skipped = 0;
    
    for (const sucursal of sucursalesResult.rows) {
      try {
        // Validar coordenadas
        const lat = parseFloat(sucursal.latitude);
        const lon = parseFloat(sucursal.longitude);
        
        if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
          console.log(`⚠️ Coordenadas inválidas para ${sucursal.store_name}: ${lat}, ${lon}`);
          skipped++;
          continue;
        }
        
        // Validar rango de coordenadas (México aproximadamente)
        if (lat < 14 || lat > 33 || lon < -118 || lon > -86) {
          console.log(`⚠️ Coordenadas fuera de México para ${sucursal.store_name}: ${lat}, ${lon}`);
          skipped++;
          continue;
        }
        
        // Insertar geofence
        await client.query(`
          INSERT INTO sucursal_geofences (
            location_code, store_name, group_name, 
            latitude, longitude, radius_meters, active, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          sucursal.location_code,
          sucursal.store_name,
          sucursal.group_name,
          lat,
          lon,
          parseInt(defaultRadius),
          sucursal.active || true
        ]);
        
        imported++;
        
        if (imported % 10 === 0) {
          console.log(`📍 Importados ${imported}/${sucursalesResult.rows.length} geofences...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importando ${sucursal.store_name}:`, error.message);
        skipped++;
      }
    }
    
    // 6. Verificar resultados
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active,
        COUNT(DISTINCT group_name) as groups
      FROM sucursal_geofences
    `);
    
    const stats = verifyResult.rows[0];
    
    console.log('\n🎉 IMPORTACIÓN COMPLETADA');
    console.log('================================');
    console.log(`✅ Geofences importados: ${imported}`);
    console.log(`⚠️ Sucursales omitidas: ${skipped}`);
    console.log(`📊 Total en BD: ${stats.total}`);
    console.log(`🟢 Activos: ${stats.active}`);
    console.log(`🏢 Grupos: ${stats.groups}`);
    
    // 7. Mostrar resumen por grupo
    const groupSummary = await client.query(`
      SELECT 
        group_name,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM sucursal_geofences
      GROUP BY group_name
      ORDER BY count DESC
    `);
    
    console.log('\n📊 RESUMEN POR GRUPO:');
    groupSummary.rows.forEach(group => {
      console.log(`  ${group.group_name}: ${group.active}/${group.count} activos`);
    });
    
    // 8. Probar función de búsqueda de geofences
    console.log('\n🧪 Probando función de búsqueda...');
    const testResult = await client.query(`
      SELECT * FROM get_nearby_geofences(25.6866, -100.3161, 500) LIMIT 3
    `);
    
    console.log(`🔍 Geofences encontrados cerca de Monterrey: ${testResult.rows.length}`);
    testResult.rows.forEach(gf => {
      console.log(`  - ${gf.store_name}: ${Math.round(gf.distance_meters)}m`);
    });
    
    await client.end();
    console.log('\n✅ Importación finalizada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en importación de geofences:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  importGeofences();
}

module.exports = importGeofences;