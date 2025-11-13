require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Importar sucursales con estructura REAL del dashboard
 * Usa grupo-operativo-sucursales-mapping.json como fuente de verdad
 */
async function importSucursalesReal() {
  let railwayClient, neonClient;
  
  try {
    console.log('🏢 Importando sucursales con estructura REAL del dashboard...');
    
    // Leer mapping real del dashboard
    const mappingPath = '/Users/robertodavila/pollo-loco-supervision/telegram-bot/grupo-operativo-sucursales-mapping.json';
    
    if (!fs.existsSync(mappingPath)) {
      throw new Error(`❌ No se encontró el mapping: ${mappingPath}`);
    }
    
    const gruposReales = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    console.log('✅ Mapping real cargado');
    
    // Conectar a Railway (destino)
    const databaseUrl = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('❌ No DATABASE_URL found');
    }
    
    railwayClient = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    // Conectar a Neon (para obtener coordenadas)
    neonClient = new Client({
      connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    
    await railwayClient.connect();
    await neonClient.connect();
    console.log('✅ Conectado a Railway y Neon');
    
    // Obtener coordenadas desde Neon para todas las sucursales
    console.log('\\n📍 Obteniendo coordenadas desde Neon...');
    const coordenadasResult = await neonClient.query(`
      SELECT DISTINCT
        location_name,
        sucursal_clean,
        latitud,
        longitud,
        estado_normalizado,
        municipio
      FROM supervision_operativa_clean
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL
        AND location_name IS NOT NULL
      ORDER BY location_name
    `);
    
    // Crear índice de coordenadas por nombre de sucursal
    const coordenadas = new Map();
    coordenadasResult.rows.forEach(row => {
      // Buscar por nombre completo y por número de sucursal
      const nombreCompleto = row.location_name;
      const numeroMatch = nombreCompleto.match(/^(\\d+)\\s*-?\\s*(.+)$/);
      
      coordenadas.set(nombreCompleto, row);
      
      if (numeroMatch) {
        const numero = numeroMatch[1];
        const nombreSolo = numeroMatch[2].trim();
        coordenadas.set(`${numero} ${nombreSolo}`, row);
      }
    });
    
    console.log(`📊 ${coordenadas.size} coordenadas disponibles`);
    
    // Limpiar tabla de sucursales
    console.log('\\n🧹 Limpiando tracking_locations_cache...');
    await railwayClient.query('DELETE FROM tracking_locations_cache');
    
    // Importar sucursales por grupo
    console.log('\\n📥 Importando sucursales por grupo operativo...');
    
    let totalImportadas = 0;
    let sinCoordenadas = [];
    
    for (const [grupoKey, grupoData] of Object.entries(gruposReales)) {
      // Saltear categorías especiales
      if (['NO_ENCONTRADO', 'SIN_MAPEO'].includes(grupoKey)) {
        console.log(`⏭️  Saltando: ${grupoKey}`);
        continue;
      }
      
      console.log(`\\n📋 Procesando: ${grupoData.name} (${grupoData.sucursales.length} sucursales)`);
      
      for (const sucursalNombre of grupoData.sucursales) {
        try {
          // Buscar coordenadas para esta sucursal
          let coordData = coordenadas.get(sucursalNombre);
          
          // Si no encuentra exacta, buscar variaciones
          if (!coordData) {
            for (const [key, value] of coordenadas.entries()) {
              if (key.includes(sucursalNombre.split(' ')[0]) || 
                  sucursalNombre.includes(key.split(' ')[0])) {
                coordData = value;
                break;
              }
            }
          }
          
          if (!coordData) {
            sinCoordenadas.push(`${grupoData.name}: ${sucursalNombre}`);
            console.log(`  ⚠️  Sin coordenadas: ${sucursalNombre}`);
            continue;
          }
          
          // Extraer código de sucursal
          const codigoMatch = sucursalNombre.match(/^(\\d+)/);
          const locationCode = codigoMatch ? codigoMatch[1] : `AUTO_${totalImportadas + 1}`;
          
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
              synced_at = NOW()
          `, [
            locationCode,
            sucursalNombre,
            `${coordData.municipio}, ${coordData.estado_normalizado}`,
            parseFloat(coordData.latitud),
            parseFloat(coordData.longitud),
            grupoData.name,
            'Director TBD',
            true,
            150
          ]);
          
          totalImportadas++;
          console.log(`  ✅ ${sucursalNombre} (${locationCode})`);
          
        } catch (error) {
          console.error(`  ❌ Error con ${sucursalNombre}: ${error.message}`);
        }
      }
    }
    
    console.log(`\\n🎉 Importación completada: ${totalImportadas} sucursales importadas`);
    
    if (sinCoordenadas.length > 0) {
      console.log(`\\n⚠️  Sucursales sin coordenadas (${sinCoordenadas.length}):`);
      sinCoordenadas.forEach(s => console.log(`  - ${s}`));
    }
    
    // Verificar importación final
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
    
    console.log('\\n📊 Verificación final - Sucursales por grupo:');
    verificacion.rows.forEach(grupo => {
      console.log(`  ✅ ${grupo.group_name}: ${grupo.total} sucursales`);
    });
    
    console.log('\\n✅ ¡Estructura real del dashboard importada correctamente!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (railwayClient) await railwayClient.end();
    if (neonClient) await neonClient.end();
  }
}

if (require.main === module) {
  importSucursalesReal()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = importSucursalesReal;