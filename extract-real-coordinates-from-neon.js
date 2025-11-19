require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para extraer coordenadas REALES desde la base de datos Neon
 * Usando el clean view de supervision_operativa_detalle
 */

async function extractRealCoordinatesFromNeon() {
  console.log('🔍 EXTRAYENDO COORDENADAS REALES DESDE BASE NEON');
  console.log('Fuente: supervision_operativa_clean view');
  console.log('='.repeat(60));
  
  // Conexión a base Neon (supervisión operativa)
  const connectionString = process.env.NEON_DATABASE_URL || process.env.ZENPUT_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL o ZENPUT_DATABASE_URL no está configurado');
  }
  
  const neonClient = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    await neonClient.connect();
    console.log('✅ Conectado a Neon PostgreSQL (Supervisión Operativa)\n');
    
    // Extraer coordenadas reales agrupadas por sucursal
    const coordenadasReales = await neonClient.query(`
      SELECT DISTINCT
        location_name,
        grupo_operativo_limpio as grupo,
        estado_normalizado as estado,
        municipio,
        latitud,
        longitud,
        COUNT(*) as total_registros
      FROM supervision_operativa_clean
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL
        AND latitud::numeric BETWEEN -90 AND 90
        AND longitud::numeric BETWEEN -180 AND 180
        AND location_name IS NOT NULL
      GROUP BY location_name, grupo_operativo_limpio, estado_normalizado, municipio, latitud, longitud
      ORDER BY location_name, total_registros DESC
    `);
    
    console.log(`📊 Total de sucursales con coordenadas válidas: ${coordenadasReales.rows.length}`);
    console.log('');

    // Procesar y limpiar coordenadas
    const coordenadasLimpias = {};
    const duplicados = {};

    coordenadasReales.rows.forEach(row => {
      const {
        location_name,
        grupo,
        estado,
        municipio, 
        latitud,
        longitud,
        total_registros
      } = row;

      const lat = parseFloat(latitud);
      const lng = parseFloat(longitud);

      // Validar coordenadas
      if (isNaN(lat) || isNaN(lng)) {
        console.log(`⚠️ Coordenadas inválidas para ${location_name}: ${latitud}, ${longitud}`);
        return;
      }

      const key = location_name;
      
      if (coordenadasLimpias[key]) {
        // Hay duplicados - guardar el que tiene más registros
        if (!duplicados[key]) duplicados[key] = [];
        duplicados[key].push({
          lat, lng, registros: total_registros, grupo, estado, municipio
        });
        
        if (total_registros > coordenadasLimpias[key].registros) {
          coordenadasLimpias[key] = {
            name: location_name,
            lat,
            lng,
            grupo,
            estado,
            municipio,
            registros: total_registros
          };
        }
      } else {
        coordenadasLimpias[key] = {
          name: location_name,
          lat,
          lng,
          grupo,
          estado,
          municipio,
          registros: total_registros
        };
      }
    });

    console.log(`✨ Coordenadas procesadas: ${Object.keys(coordenadasLimpias).length}`);
    
    if (Object.keys(duplicados).length > 0) {
      console.log(`⚠️ Sucursales con múltiples coordenadas: ${Object.keys(duplicados).length}`);
      console.log('(Se seleccionó automáticamente la que tiene más registros)');
      console.log('');
    }

    // Mostrar muestra de coordenadas extraídas
    console.log('📋 MUESTRA DE COORDENADAS EXTRAÍDAS:');
    console.log('='.repeat(50));
    
    const sample = Object.values(coordenadasLimpias).slice(0, 10);
    sample.forEach((coord, index) => {
      console.log(`${index + 1}. ${coord.name}`);
      console.log(`   📍 ${coord.lat}, ${coord.lng}`);
      console.log(`   🏢 ${coord.grupo} | ${coord.estado}, ${coord.municipio}`);
      console.log(`   📊 ${coord.registros} registros`);
      console.log('');
    });

    if (Object.keys(coordenadasLimpias).length > 10) {
      console.log(`... y ${Object.keys(coordenadasLimpias).length - 10} más\n`);
    }

    // Generar mapeo para código del tracking GPS
    console.log('🔄 GENERANDO MAPEO PARA TRACKING GPS...');
    
    const mappingForTracking = {};
    
    Object.entries(coordenadasLimpias).forEach(([locationName, data]) => {
      // Intentar mapear al código usado en tracking GPS
      const cleanName = locationName.replace(/^Sucursal\s+[A-Z]+\s+-\s+/, ''); // Quitar prefijo "Sucursal XX - "
      
      mappingForTracking[cleanName] = {
        name: cleanName,
        lat: data.lat,
        lng: data.lng,
        grupo: data.grupo,
        estado: data.estado,
        municipio: data.municipio,
        original_name: locationName,
        registros: data.registros
      };
    });

    // Guardar resultados
    const fs = require('fs');
    const outputPath = '/Users/robertodavila/pollo-loco-tracking-gps/coordenadas-reales-neon.json';
    
    fs.writeFileSync(outputPath, JSON.stringify({
      metadata: {
        timestamp: new Date().toISOString(),
        total_sucursales: Object.keys(coordenadasLimpias).length,
        source: 'supervision_operativa_clean view - Neon PostgreSQL',
        duplicados_encontrados: Object.keys(duplicados).length
      },
      coordenadas_originales: coordenadasLimpias,
      mapeo_tracking_gps: mappingForTracking,
      duplicados_detectados: duplicados
    }, null, 2));
    
    console.log(`✅ Coordenadas guardadas en: ${outputPath}`);
    console.log('');
    console.log('🎯 SIGUIENTE PASO:');
    console.log('Ejecutar comparación con coordenadas actuales del tracking GPS');

  } catch (error) {
    console.error('❌ Error extrayendo coordenadas:', error.message);
    console.error('💡 Verificar que NEON_DATABASE_URL esté configurado correctamente');
  } finally {
    await neonClient.end();
  }
}

if (require.main === module) {
  extractRealCoordinatesFromNeon()
    .then(() => {
      console.log('\n✅ Extracción completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { extractRealCoordinatesFromNeon };