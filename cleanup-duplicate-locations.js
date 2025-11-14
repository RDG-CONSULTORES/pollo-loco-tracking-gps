require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para identificar y limpiar duplicados en tracking_locations_cache
 */
async function cleanupDuplicates() {
  console.log('🧹 LIMPIEZA DE DUPLICADOS: tracking_locations_cache\n');
  
  const databaseUrl = process.env.DATABASE_URL || 
    'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@yamabiko.proxy.rlwy.net:42861/railway';
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // 1. Identificar duplicados por location_code
    console.log('📊 1. IDENTIFICAR DUPLICADOS POR LOCATION_CODE:');
    
    const duplicadosCodigo = await client.query(`
      SELECT 
        location_code,
        COUNT(*) as cantidad,
        STRING_AGG(id::text, ', ') as ids,
        STRING_AGG(name, ' | ') as nombres
      FROM tracking_locations_cache 
      GROUP BY location_code 
      HAVING COUNT(*) > 1
      ORDER BY cantidad DESC
    `);
    
    if (duplicadosCodigo.rows.length === 0) {
      console.log('   ✅ No hay duplicados por location_code');
    } else {
      console.log(`   ❌ ${duplicadosCodigo.rows.length} location_codes duplicados:`);
      duplicadosCodigo.rows.forEach(dup => {
        console.log(`   - ${dup.location_code}: ${dup.cantidad} veces`);
        console.log(`     IDs: ${dup.ids}`);
        console.log(`     Nombres: ${dup.nombres.substring(0, 80)}...`);
      });
    }
    
    // 2. Identificar duplicados por nombre y ubicación
    console.log('\n📊 2. IDENTIFICAR DUPLICADOS POR NOMBRE Y COORDENADAS:');
    
    const duplicadosNombre = await client.query(`
      SELECT 
        name,
        latitude,
        longitude,
        group_name,
        COUNT(*) as cantidad,
        STRING_AGG(location_code, ', ') as codigos,
        STRING_AGG(id::text, ', ') as ids
      FROM tracking_locations_cache 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY name, latitude, longitude, group_name
      HAVING COUNT(*) > 1
      ORDER BY cantidad DESC
    `);
    
    if (duplicadosNombre.rows.length === 0) {
      console.log('   ✅ No hay duplicados por nombre y coordenadas');
    } else {
      console.log(`   ⚠️  ${duplicadosNombre.rows.length} posibles duplicados por ubicación:`);
      duplicadosNombre.rows.forEach(dup => {
        console.log(`   - "${dup.name}" (${dup.group_name}): ${dup.cantidad} veces`);
        console.log(`     Códigos: ${dup.codigos}`);
        console.log(`     Coordenadas: ${dup.latitude}, ${dup.longitude}`);
      });
    }
    
    // 3. Identificar registros problemáticos
    console.log('\n📊 3. REGISTROS PROBLEMÁTICOS:');
    
    // 3.1 Sin coordenadas
    const sinCoordenadas = await client.query(`
      SELECT COUNT(*) as total
      FROM tracking_locations_cache 
      WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0
    `);
    console.log(`   📍 Sin coordenadas válidas: ${sinCoordenadas.rows[0].total}`);
    
    // 3.2 Inactivos
    const inactivos = await client.query(`
      SELECT COUNT(*) as total
      FROM tracking_locations_cache 
      WHERE active = false OR active IS NULL
    `);
    console.log(`   ❌ Marcados como inactivos: ${inactivos.rows[0].total}`);
    
    // 3.3 Sin grupo
    const sinGrupo = await client.query(`
      SELECT COUNT(*) as total
      FROM tracking_locations_cache 
      WHERE group_name IS NULL OR group_name = ''
    `);
    console.log(`   🏢 Sin grupo operativo: ${sinGrupo.rows[0].total}`);
    
    // 4. Análisis de patrones sospechosos
    console.log('\n📊 4. ANÁLISIS DE PATRONES SOSPECHOSOS:');
    
    // 4.1 Location codes que no siguen el patrón numérico
    const codigosRaros = await client.query(`
      SELECT location_code, name, group_name
      FROM tracking_locations_cache 
      WHERE location_code !~ '^[0-9]+$'
      ORDER BY location_code
    `);
    
    if (codigosRaros.rows.length > 0) {
      console.log(`   🔍 Códigos no numéricos (${codigosRaros.rows.length}):`);
      codigosRaros.rows.forEach(row => {
        console.log(`   - ${row.location_code}: "${row.name}" (${row.group_name})`);
      });
    } else {
      console.log('   ✅ Todos los códigos siguen el patrón numérico');
    }
    
    // 5. Estadísticas finales
    console.log('\n📊 5. RESUMEN ESTADÍSTICO:');
    
    const resumen = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN active = true THEN 1 END) as activas,
        COUNT(CASE WHEN active = false OR active IS NULL THEN 1 END) as inactivas,
        COUNT(DISTINCT group_name) as grupos_unicos,
        COUNT(DISTINCT location_code) as codigos_unicos,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 AND longitude != 0 THEN 1 END) as con_coordenadas
      FROM tracking_locations_cache
    `);
    
    const stats = resumen.rows[0];
    console.log(`   📊 Total de registros: ${stats.total}`);
    console.log(`   ✅ Sucursales activas: ${stats.activas}`);
    console.log(`   ❌ Sucursales inactivas: ${stats.inactivas}`);
    console.log(`   🏢 Grupos únicos: ${stats.grupos_unicos}`);
    console.log(`   🔢 Códigos únicos: ${stats.codigos_unicos}`);
    console.log(`   📍 Con coordenadas: ${stats.con_coordenadas}`);
    
    // 6. Recomendaciones de limpieza (NO EJECUTAR AUTOMÁTICAMENTE)
    console.log('\n🎯 RECOMENDACIONES DE LIMPIEZA:');
    console.log('=====================================');
    
    if (duplicadosCodigo.rows.length > 0) {
      console.log('1. 🧹 Eliminar duplicados por location_code:');
      console.log('   - Mantener el registro más reciente (created_at más nuevo)');
      console.log('   - Verificar que no se pierda información importante');
    }
    
    if (parseInt(sinCoordenadas.rows[0].total) > 0) {
      console.log('2. 📍 Sucursales sin coordenadas:');
      console.log('   - Investigar si son sucursales reales');
      console.log('   - Obtener coordenadas de fuente externa si es necesario');
      console.log('   - Considerar marcar como inactivas si no son válidas');
    }
    
    if (parseInt(inactivos.rows[0].total) > 0) {
      console.log('3. ❌ Sucursales inactivas:');
      console.log('   - Verificar si realmente están cerradas');
      console.log('   - Considerar eliminar si son datos obsoletos');
    }
    
    if (codigosRaros.rows.length > 0) {
      console.log('4. 🔍 Códigos no numéricos:');
      console.log('   - Revisar si son códigos temporales o de prueba');
      console.log('   - Asignar códigos numéricos apropiados');
    }
    
    console.log('\n⚠️  IMPORTANTE: No ejecutar limpieza automática sin revisar datos');
    console.log('⚠️  Hacer backup antes de cualquier operación de limpieza');
    
    // Diferencia con datos esperados
    const expectedOriginal = 84; // De supervision_operativa_clean
    const expectedReported = 98;  // Reportado en importación
    const actualActive = parseInt(stats.activas);
    
    console.log('\n📈 ANÁLISIS DE DISCREPANCIA:');
    console.log(`   🎯 Esperado (original): ${expectedOriginal} sucursales`);
    console.log(`   📊 Reportado (importación): ${expectedReported} sucursales`);
    console.log(`   ✅ Actual (activas): ${actualActive} sucursales`);
    console.log(`   📋 Total en base: ${stats.total} registros`);
    
    const diffOriginal = actualActive - expectedOriginal;
    const diffReported = actualActive - expectedReported;
    
    if (diffOriginal !== 0) {
      console.log(`   📊 Diferencia vs original: ${diffOriginal > 0 ? '+' : ''}${diffOriginal}`);
    }
    if (diffReported !== 0) {
      console.log(`   📊 Diferencia vs reportado: ${diffReported > 0 ? '+' : ''}${diffReported}`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Análisis de limpieza completado');
  }
}

// Ejecutar
if (require.main === module) {
  cleanupDuplicates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { cleanupDuplicates };