require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para investigar la discrepancia de sucursales: 98 vs 87
 */
async function investigateDiscrepancy() {
  console.log('🔍 INVESTIGACIÓN: Discrepancia de Sucursales (98 vs 87)\n');
  
  // Usar la URL pública para conexión remota
  const databaseUrl = process.env.DATABASE_URL || 
    'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@yamabiko.proxy.rlwy.net:42861/railway';
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // 1. Verificar total de sucursales en tracking_locations_cache
    console.log('📊 1. ANÁLISIS DE tracking_locations_cache:');
    
    const totalSucursales = await client.query(`
      SELECT COUNT(*) as total FROM tracking_locations_cache
    `);
    
    const sucursalesActivas = await client.query(`
      SELECT COUNT(*) as total FROM tracking_locations_cache WHERE active = true
    `);
    
    const sucursalesInactivas = await client.query(`
      SELECT COUNT(*) as total FROM tracking_locations_cache WHERE active = false OR active IS NULL
    `);
    
    console.log(`   📍 Total de sucursales: ${totalSucursales.rows[0].total}`);
    console.log(`   ✅ Sucursales activas: ${sucursalesActivas.rows[0].total}`);
    console.log(`   ❌ Sucursales inactivas: ${sucursalesInactivas.rows[0].total}`);
    
    // 2. Análisis por grupos operativos
    console.log('\n📊 2. ANÁLISIS POR GRUPOS OPERATIVOS:');
    
    const gruposOperativos = await client.query(`
      SELECT 
        group_name, 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as activas,
        COUNT(*) FILTER (WHERE active = false OR active IS NULL) as inactivas
      FROM tracking_locations_cache 
      GROUP BY group_name 
      ORDER BY group_name
    `);
    
    console.log(`   🏢 Total de grupos operativos: ${gruposOperativos.rows.length}`);
    console.log('\n   Desglose por grupo:');
    
    let totalActivasSum = 0;
    gruposOperativos.rows.forEach(grupo => {
      totalActivasSum += parseInt(grupo.activas);
      console.log(`   - ${grupo.group_name}:`);
      console.log(`     Total: ${grupo.total} | Activas: ${grupo.activas} | Inactivas: ${grupo.inactivas}`);
    });
    
    console.log(`\n   ✅ Suma de activas por grupo: ${totalActivasSum}`);
    
    // 3. Verificar duplicados por location_code
    console.log('\n📊 3. VERIFICAR DUPLICADOS:');
    
    const duplicados = await client.query(`
      SELECT 
        location_code, 
        COUNT(*) as cantidad
      FROM tracking_locations_cache 
      GROUP BY location_code 
      HAVING COUNT(*) > 1
      ORDER BY cantidad DESC
    `);
    
    if (duplicados.rows.length === 0) {
      console.log('   ✅ No hay duplicados por location_code');
    } else {
      console.log(`   ❌ Se encontraron ${duplicados.rows.length} location_codes duplicados:`);
      duplicados.rows.forEach(dup => {
        console.log(`     - ${dup.location_code}: ${dup.cantidad} veces`);
      });
    }
    
    // 4. Verificar sucursales sin coordenadas
    console.log('\n📊 4. SUCURSALES SIN COORDENADAS:');
    
    const sinCoordenadas = await client.query(`
      SELECT COUNT(*) as total
      FROM tracking_locations_cache 
      WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0
    `);
    
    console.log(`   📍 Sucursales sin coordenadas válidas: ${sinCoordenadas.rows[0].total}`);
    
    if (parseInt(sinCoordenadas.rows[0].total) > 0) {
      const ejemplosSinCoordenadas = await client.query(`
        SELECT location_code, name, group_name, latitude, longitude
        FROM tracking_locations_cache 
        WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0
        LIMIT 5
      `);
      
      console.log('   Ejemplos:');
      ejemplosSinCoordenadas.rows.forEach(suc => {
        console.log(`     - ${suc.location_code} (${suc.name}) - Lat: ${suc.latitude}, Lon: ${suc.longitude}`);
      });
    }
    
    // 5. Verificar endpoint de grupos (simulación de la consulta)
    console.log('\n📊 5. SIMULACIÓN ENDPOINT /api/admin/groups:');
    
    const gruposEndpoint = await client.query(`
      SELECT 
        group_name,
        director_name,
        COUNT(*) as total_sucursales,
        COUNT(CASE WHEN active THEN 1 END) as sucursales_activas,
        COUNT(CASE WHEN geofence_enabled THEN 1 END) as geofences_activos,
        AVG(geofence_radius) as radio_promedio,
        MIN(created_at) as fecha_creacion
      FROM tracking_locations_cache
      GROUP BY group_name, director_name
      ORDER BY group_name
    `);
    
    console.log(`   🏢 Grupos que aparecerían en el combo: ${gruposEndpoint.rows.length}`);
    
    // 6. Comparar con supervision_operativa_clean (si existe)
    console.log('\n📊 6. VERIFICAR TABLA ORIGINAL:');
    
    try {
      const tablaOriginal = await client.query(`
        SELECT COUNT(*) as total FROM supervision_operativa_clean
      `);
      console.log(`   📋 supervision_operativa_clean: ${tablaOriginal.rows[0].total} registros`);
      
      const gruposOriginal = await client.query(`
        SELECT DISTINCT grupo_operativo, COUNT(*) as total
        FROM supervision_operativa_clean 
        GROUP BY grupo_operativo 
        ORDER BY grupo_operativo
      `);
      
      console.log(`   🏢 Grupos operativos en original: ${gruposOriginal.rows.length}`);
      
    } catch (error) {
      console.log('   ❌ Tabla supervision_operativa_clean no existe o no es accesible');
    }
    
    // 7. Verificar registros recientes de importación
    console.log('\n📊 7. ÚLTIMAS IMPORTACIONES:');
    
    const ultimasImportaciones = await client.query(`
      SELECT 
        DATE_TRUNC('day', synced_at) as fecha,
        COUNT(*) as registros_sincronizados
      FROM tracking_locations_cache 
      WHERE synced_at IS NOT NULL
      GROUP BY DATE_TRUNC('day', synced_at)
      ORDER BY fecha DESC
      LIMIT 5
    `);
    
    if (ultimasImportaciones.rows.length > 0) {
      console.log('   📅 Historial de sincronizaciones:');
      ultimasImportaciones.rows.forEach(imp => {
        console.log(`     - ${imp.fecha.toISOString().split('T')[0]}: ${imp.registros_sincronizados} sucursales`);
      });
    } else {
      console.log('   ❌ No se encontraron registros de sincronización');
    }
    
    // 8. RESUMEN Y CONCLUSIONES
    console.log('\n🎯 RESUMEN DE HALLAZGOS:');
    console.log('================================');
    console.log(`1. Total real en base de datos: ${totalSucursales.rows[0].total} sucursales`);
    console.log(`2. Sucursales activas: ${sucursalesActivas.rows[0].total} sucursales`);
    console.log(`3. Grupos operativos únicos: ${gruposOperativos.rows.length} grupos`);
    console.log(`4. Duplicados encontrados: ${duplicados.rows.length} casos`);
    console.log(`5. Sucursales sin coordenadas: ${sinCoordenadas.rows[0].total} casos`);
    
    const diferencia = 98 - parseInt(sucursalesActivas.rows[0].total);
    if (diferencia !== 0) {
      console.log(`\n⚠️  DISCREPANCIA DETECTADA:`);
      console.log(`   Reportado en importación: 98 sucursales`);
      console.log(`   Encontrado en base de datos: ${sucursalesActivas.rows[0].total} sucursales activas`);
      console.log(`   Diferencia: ${diferencia} sucursales`);
      
      if (diferencia > 0) {
        console.log(`\n🔍 POSIBLES CAUSAS:`);
        console.log(`   - Sucursales marcadas como inactivas: ${sucursalesInactivas.rows[0].total}`);
        console.log(`   - Sucursales sin coordenadas válidas: ${sinCoordenadas.rows[0].total}`);
        console.log(`   - Filtros aplicados en el endpoint del panel`);
        console.log(`   - Diferencias en la lógica de conteo`);
      }
    } else {
      console.log(`\n✅ No se detectó discrepancia en el conteo`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la investigación:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
    console.log('\n✅ Investigación completada');
  }
}

// Ejecutar
if (require.main === module) {
  investigateDiscrepancy()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { investigateDiscrepancy };