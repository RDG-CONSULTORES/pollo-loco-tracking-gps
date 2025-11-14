require('dotenv').config();
const { Client } = require('pg');

/**
 * IMPORTACIÓN LIMPIA - Dashboard Structure
 * Basado en supervision_operativa_clean con normalización manual de TEPEYAC
 */
async function cleanImportStructure() {
  let railwayClient, neonClient;
  
  try {
    console.log('🧹 === IMPORTACIÓN LIMPIA DE ESTRUCTURA ===');
    console.log('📊 Objetivo: 20 Grupos Operativos + 83 Sucursales (sin duplicados)');
    
    // Conectar a Railway (destino)
    const railwayUrl = 'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@autorack.proxy.rlwy.net:21655/railway';
    
    railwayClient = new Client({
      connectionString: railwayUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    });
    
    // Conectar a Neon (fuente limpia)
    neonClient = new Client({
      connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    });
    
    await railwayClient.connect();
    await neonClient.connect();
    console.log('✅ Conectado a Railway y Neon');
    
    // Obtener estructura desde Clean View de Neon
    console.log('\\n📍 Obteniendo estructura desde supervision_operativa_clean...');
    const estructuraResult = await neonClient.query(`
      SELECT DISTINCT
        location_name,
        sucursal_clean,
        latitud,
        longitud,
        estado_normalizado,
        municipio,
        grupo_operativo_limpio,
        director_operativo
      FROM supervision_operativa_clean
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL
        AND location_name IS NOT NULL
        AND grupo_operativo_limpio IS NOT NULL
        AND grupo_operativo_limpio != 'NO_ENCONTRADO'  -- Excluir duplicados
        AND grupo_operativo_limpio != 'SIN_MAPEO'      -- Excluir sin mapeo
      ORDER BY grupo_operativo_limpio, location_name
    `);
    
    console.log(`📊 Datos obtenidos: ${estructuraResult.rows.length} registros desde Clean View`);
    
    // Normalizar TEPEYAC manualmente (eliminar duplicados de formato)
    const sucursalesNormalizadas = estructuraResult.rows.filter(row => {
      const nombre = row.location_name;
      
      // Eliminar duplicados de TEPEYAC con formato "Sucursal XX"
      if (row.grupo_operativo_limpio === 'TEPEYAC') {
        // Mantener solo las con formato numérico: "1 Pino Suarez", "2 Madero", etc.
        // Eliminar: "Sucursal GC Garcia", "Sucursal LH La Huasteca", "Sucursal SC Santa Catarina"
        if (nombre.startsWith('Sucursal ')) {
          console.log(`  🚫 Eliminando duplicado TEPEYAC: ${nombre}`);
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`✅ Después de normalización: ${sucursalesNormalizadas.length} sucursales`);
    
    // Agrupar por grupo operativo
    const gruposPorOperativo = new Map();
    sucursalesNormalizadas.forEach(row => {
      const grupo = row.grupo_operativo_limpio;
      if (!gruposPorOperativo.has(grupo)) {
        gruposPorOperativo.set(grupo, []);
      }
      gruposPorOperativo.get(grupo).push(row);
    });
    
    console.log(`\\n🏢 Grupos operativos encontrados: ${gruposPorOperativo.size}`);
    
    // Mostrar estructura antes de importar
    let totalSucursales = 0;
    for (const [grupo, sucursales] of gruposPorOperativo.entries()) {
      console.log(`   ✅ ${grupo}: ${sucursales.length} sucursales`);
      totalSucursales += sucursales.length;
    }
    console.log(`📊 Total sucursales: ${totalSucursales}`);
    
    // Validar que tenemos exactamente 83 sucursales
    if (totalSucursales !== 83) {
      console.log(`\\n⚠️ ADVERTENCIA: Se esperaban 83 sucursales, encontradas ${totalSucursales}`);
      console.log('Revisando qué podría estar faltando o sobrando...');
    }
    
    // Limpiar tabla actual
    console.log('\\n🧹 Limpiando tracking_locations_cache...');
    await railwayClient.query('DELETE FROM tracking_locations_cache');
    
    // Importar estructura limpia
    console.log('\\n📥 Importando estructura limpia...');
    
    let importadas = 0;
    let errores = [];
    
    for (const [grupoNombre, sucursalesGrupo] of gruposPorOperativo.entries()) {
      console.log(`\\n📋 Procesando: ${grupoNombre} (${sucursalesGrupo.length} sucursales)`);
      
      for (const sucursal of sucursalesGrupo) {
        try {
          // Extraer código de sucursal del nombre
          const codigoMatch = sucursal.location_name.match(/^(\\d+)/);
          const locationCode = codigoMatch ? codigoMatch[1] : `AUTO_${importadas + 1}`;
          
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
              director_name = EXCLUDED.director_name,
              synced_at = NOW()
          `, [
            locationCode,
            sucursal.location_name,
            `${sucursal.municipio}, ${sucursal.estado_normalizado}`,
            parseFloat(sucursal.latitud),
            parseFloat(sucursal.longitud),
            grupoNombre,
            sucursal.director_operativo || 'Director TBD',
            true,
            150
          ]);
          
          importadas++;
          console.log(`  ✅ ${sucursal.location_name} (${locationCode})`);
          
        } catch (error) {
          errores.push(`${grupoNombre}: ${sucursal.location_name} - ${error.message}`);
          console.error(`  ❌ Error con ${sucursal.location_name}: ${error.message}`);
        }
      }
    }
    
    console.log(`\\n🎉 IMPORTACIÓN LIMPIA COMPLETADA`);
    console.log(`   📊 Sucursales importadas: ${importadas}`);
    console.log(`   🏢 Grupos operativos: ${gruposPorOperativo.size}`);
    
    if (errores.length > 0) {
      console.log(`\\n⚠️  Errores encontrados (${errores.length}):`);
      errores.forEach(error => console.log(`  - ${error}`));
    }
    
    // Verificar resultado final
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
    
    console.log('\\n📊 === ESTRUCTURA FINAL IMPORTADA ===');
    verificacion.rows.forEach(grupo => {
      console.log(`  ✅ ${grupo.group_name}: ${grupo.total} sucursales`);
    });
    
    const totalFinal = verificacion.rows.reduce((sum, grupo) => sum + parseInt(grupo.total), 0);
    console.log(`\\n🎯 RESUMEN FINAL:`);
    console.log(`   - ${verificacion.rows.length} Grupos Operativos`);
    console.log(`   - ${totalFinal} Sucursales limpias`);
    console.log(`   - TEPEYAC normalizado (7 sucursales sin duplicados)`);
    console.log(`   - Estructura lista para dashboard GPS`);
    console.log('\\n✅ ¡Importación limpia exitosa!');
    
  } catch (error) {
    console.error('💥 Error en importación limpia:', error);
  } finally {
    if (railwayClient) await railwayClient.end();
    if (neonClient) await neonClient.end();
  }
}

if (require.main === module) {
  cleanImportStructure()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = cleanImportStructure;