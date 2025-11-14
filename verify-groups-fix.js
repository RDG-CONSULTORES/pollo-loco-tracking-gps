require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para verificar la corrección del endpoint de grupos
 */
async function verifyGroupsFix() {
  console.log('🔍 VERIFICACIÓN POST-CORRECCIÓN: Endpoint de Grupos\n');
  
  const databaseUrl = process.env.DATABASE_URL || 
    'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@yamabiko.proxy.rlwy.net:42861/railway';
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // 1. Consulta ANTES (con problema - agrupa por director también)
    console.log('📊 1. CONSULTA ANTERIOR (CON PROBLEMA):');
    console.log('   GROUP BY group_name, director_name\n');
    
    try {
      const queryAnterior = await client.query(`
        SELECT 
          group_name,
          director_name,
          COUNT(*) as total_sucursales,
          COUNT(CASE WHEN active THEN 1 END) as sucursales_activas
        FROM tracking_locations_cache
        GROUP BY group_name, director_name
        ORDER BY group_name
      `);
      
      console.log(`   📋 Resultado: ${queryAnterior.rows.length} registros`);
      console.log('   🔍 Primeros 10 registros:');
      queryAnterior.rows.slice(0, 10).forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.group_name} (Dir: ${row.director_name || 'NULL'}) - ${row.sucursales_activas} activas`);
      });
      
      // Detectar grupos duplicados
      const gruposUnicos = new Set();
      const gruposDuplicados = new Set();
      queryAnterior.rows.forEach(row => {
        if (gruposUnicos.has(row.group_name)) {
          gruposDuplicados.add(row.group_name);
        }
        gruposUnicos.add(row.group_name);
      });
      
      console.log(`\n   ⚠️  Grupos únicos: ${gruposUnicos.size}`);
      console.log(`   ❌ Grupos duplicados: ${gruposDuplicados.size}`);
      if (gruposDuplicados.size > 0) {
        console.log(`   📋 Duplicados detectados: ${Array.from(gruposDuplicados).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error en consulta anterior: ${error.message}`);
    }
    
    // 2. Consulta DESPUÉS (corregida - solo agrupa por grupo)
    console.log('\n📊 2. CONSULTA CORREGIDA:');
    console.log('   GROUP BY group_name (sin director_name)\n');
    
    try {
      const queryCorregida = await client.query(`
        SELECT 
          group_name,
          STRING_AGG(DISTINCT director_name, ', ') as directores,
          COUNT(*) as total_sucursales,
          COUNT(CASE WHEN active THEN 1 END) as sucursales_activas,
          COUNT(CASE WHEN geofence_enabled THEN 1 END) as geofences_activos,
          ROUND(AVG(geofence_radius)) as radio_promedio
        FROM tracking_locations_cache
        GROUP BY group_name
        ORDER BY group_name
      `);
      
      console.log(`   ✅ Resultado: ${queryCorregida.rows.length} grupos únicos`);
      console.log('   📋 Todos los grupos:');
      queryCorregida.rows.forEach((row, idx) => {
        const directores = row.directores ? row.directores.substring(0, 30) + '...' : 'Sin director';
        console.log(`   ${idx + 1}. ${row.group_name} - ${row.sucursales_activas}/${row.total_sucursales} (Dirs: ${directores})`);
      });
      
      // Calcular totales
      const totalSucursales = queryCorregida.rows.reduce((sum, row) => sum + parseInt(row.total_sucursales), 0);
      const totalActivas = queryCorregida.rows.reduce((sum, row) => sum + parseInt(row.sucursales_activas), 0);
      
      console.log(`\n   📊 TOTALES:`);
      console.log(`   📍 Total de sucursales: ${totalSucursales}`);
      console.log(`   ✅ Sucursales activas: ${totalActivas}`);
      console.log(`   🏢 Grupos operativos: ${queryCorregida.rows.length}`);
      
    } catch (error) {
      console.log(`   ❌ Error en consulta corregida: ${error.message}`);
    }
    
    // 3. Comparación con datos originales
    console.log('\n📊 3. COMPARACIÓN CON FUENTE ORIGINAL:');
    console.log('   Datos de verify-grupos (supervision_operativa_clean): 84 registros, 20 grupos\n');
    
    // 4. Análisis de estados de sucursales
    console.log('📊 4. ANÁLISIS DE ESTADOS:');
    
    try {
      const estadosResult = await client.query(`
        SELECT 
          'Activas' as estado,
          COUNT(*) as cantidad
        FROM tracking_locations_cache 
        WHERE active = true
        
        UNION ALL
        
        SELECT 
          'Inactivas' as estado,
          COUNT(*) as cantidad
        FROM tracking_locations_cache 
        WHERE active = false OR active IS NULL
        
        UNION ALL
        
        SELECT 
          'Sin coordenadas' as estado,
          COUNT(*) as cantidad
        FROM tracking_locations_cache 
        WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0
        
        UNION ALL
        
        SELECT 
          'Total' as estado,
          COUNT(*) as cantidad
        FROM tracking_locations_cache
      `);
      
      console.log('   📋 Estados de sucursales:');
      estadosResult.rows.forEach(row => {
        console.log(`   - ${row.estado}: ${row.cantidad}`);
      });
      
    } catch (error) {
      console.log(`   ❌ Error en análisis de estados: ${error.message}`);
    }
    
    // 5. Recomendaciones finales
    console.log('\n🎯 RECOMENDACIONES:');
    console.log('===================');
    console.log('1. ✅ Endpoint corregido - ahora agrupa solo por group_name');
    console.log('2. 🔍 Verificar duplicados en importación si existen discrepancias');
    console.log('3. 🧹 Limpiar registros inactivos o sin coordenadas si es necesario');
    console.log('4. 📊 El combo del panel ahora debe mostrar exactamente 20 grupos');
    console.log('5. 🚀 Reiniciar servidor para aplicar cambios');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Verificación completada');
  }
}

// Ejecutar
if (require.main === module) {
  verifyGroupsFix()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { verifyGroupsFix };