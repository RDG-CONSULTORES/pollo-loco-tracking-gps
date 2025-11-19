require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para corregir coordenadas de sucursales usando datos validados
 * Basado en ESTRUCTURA-EXACTA-DASHBOARD-IOS.md
 */

// COORDENADAS VALIDADAS del dashboard iOS
const COORDENADAS_VALIDADAS = {
  // TEPEYAC - 10 SUCURSALES
  "2247000": { name: "Pino Suarez", lat: 25.6722, lng: -100.3089 },
  "2247001": { name: "Madero", lat: 25.6758, lng: -100.3125 },
  "2247002": { name: "Matamoros", lat: 25.6800, lng: -100.3150 },
  "2247003": { name: "Santa Catarina", lat: 25.6733, lng: -100.4581 },
  "2247004": { name: "Felix U. Gomez", lat: 25.6900, lng: -100.3200 },
  "2247005": { name: "Garcia", lat: 25.8094, lng: -100.5917 },
  "2247006": { name: "La Huasteca", lat: 25.6920, lng: -100.2580 },

  // OGAS - 8 SUCURSALES
  "2247007": { name: "Gonzalitos", lat: 25.6694, lng: -100.3394 },
  "2247008": { name: "Anahuac", lat: 25.6789, lng: -100.3286 },
  "2247009": { name: "Barragan", lat: 25.6547, lng: -100.2897 },
  "2247010": { name: "Lincoln", lat: 25.6689, lng: -100.3089 },
  "2247011": { name: "Concordia", lat: 25.6642, lng: -100.2517 },
  "2247012": { name: "Escobedo", lat: 25.7997, lng: -100.3211 },
  "2247013": { name: "Aztlan", lat: 25.7317, lng: -100.2644 },
  "2247014": { name: "Ruiz Cortinez", lat: 25.6750, lng: -100.2881 },

  // EPL SO - 1 SUCURSAL
  "2247015": { name: "Solidaridad", lat: 25.7242, lng: -100.1967 },

  // EFM - 3 SUCURSALES
  "2247016": { name: "Romulo Garza", lat: 25.6581, lng: -100.3814 },
  "2247017": { name: "Linda Vista", lat: 25.6522, lng: -100.3975 },
  "2247018": { name: "Valle Soleado", lat: 25.7281, lng: -100.3117 },

  // TEC - 4 SUCURSALES
  "2247019": { name: "Tecnológico", lat: 25.6514, lng: -100.2897 },
  "2247020": { name: "Chapultepec", lat: 25.6678, lng: -100.2850 },
  "2247021": { name: "Satelite", lat: 25.6439, lng: -100.2744 },
  "2247022": { name: "Guasave", lat: 25.5678, lng: -108.4697 }, // Foránea - Sinaloa

  // EXPO - 11 SUCURSALES
  "2247023": { name: "Exposicion", lat: 25.6833, lng: -100.3097 },
  "2247024": { name: "Juarez", lat: 25.8722, lng: -100.1878 },
  "2247025": { name: "Cadereyta", lat: 25.5831, lng: -100.0000 },
  "2247026": { name: "Santiago", lat: 25.4267, lng: -100.1475 },
  "2247027": { name: "Guerrero", lat: 26.0797, lng: -98.2869 }, // Foránea - Tamaulipas
  "2247028": { name: "Pablo Livas", lat: 25.7422, lng: -100.2619 },
  "2247029": { name: "Carrizo", lat: 26.3617, lng: -98.8425 }, // Foránea - Tamaulipas
  "2247030": { name: "Las Quintas", lat: 25.6269, lng: -100.3103 },
  "2247031": { name: "Allende", lat: 25.2803, lng: -100.0231 },
  "2247032": { name: "Eloy Cavazos", lat: 25.5142, lng: -99.9053 },
  "2247033": { name: "Montemorelos", lat: 25.1869, lng: -99.8331 },

  // PLOG NUEVO LEON - 6 SUCURSALES
  "2247035": { name: "Apodaca Centro", lat: 25.7817, lng: -100.1875 },
  "2247036": { name: "Stiva", lat: 25.6858, lng: -100.2419 },
  "2247037": { name: "Gomez Morin", lat: 25.6544, lng: -100.3597 },
  "2247038": { name: "Lazaro Cardenas", lat: 25.6983, lng: -100.2744 },
  "2247039": { name: "Plaza 1500", lat: 25.6908, lng: -100.3333 },
  "2247040": { name: "Vasconcelos", lat: 25.6511, lng: -100.3364 },

  // PLOG LAGUNA - 6 SUCURSALES (FORÁNEAS)
  "2247041": { name: "Independencia", lat: 25.5397, lng: -103.4472 },
  "2247042": { name: "Revolucion", lat: 25.5233, lng: -103.4128 },
  "2247043": { name: "Senderos", lat: 25.5706, lng: -103.5008 },
  "2247044": { name: "Triana", lat: 25.5475, lng: -103.4036 },
  "2247045": { name: "Campestre", lat: 25.5619, lng: -103.3747 },
  "2247046": { name: "San Antonio", lat: 25.5564, lng: -103.3533 },

  // PLOG QUERETARO - 4 SUCURSALES (FORÁNEAS)
  "2247047": { name: "Refugio", lat: 20.5881, lng: -100.3892 },
  "2247048": { name: "Pueblito", lat: 20.5344, lng: -100.4406 },
  "2247049": { name: "Patio", lat: 20.5936, lng: -100.4125 },
  "2247050": { name: "Constituyentes", lat: 20.6097, lng: -100.3756 },

  // GRUPO SALTILLO - 6 SUCURSALES
  "2247051": { name: "Venustiano Carranza", lat: 25.4292, lng: -101.0000 },
  "2247052": { name: "Lienzo Charro", lat: 25.3953, lng: -100.9896 },
  "2247053": { name: "Ramos Arizpe", lat: 25.5406, lng: -100.9475 },
  "2247054": { name: "Eulalio Gutierrez", lat: 25.4465, lng: -100.9588 },
  "2247055": { name: "Luis Echeverria", lat: 25.4551, lng: -101.0096 },
  "2247056": { name: "Harold R. Pape", lat: 25.4169, lng: -100.9922 },

  // OCHTER TAMPICO - 4 SUCURSALES (FORÁNEAS)
  "2247057": { name: "Universidad (Tampico)", lat: 22.2597, lng: -97.8650 },
  "2247058": { name: "Plaza 3601", lat: 22.2450, lng: -97.8689 },
  "2247059": { name: "Centro (Tampico)", lat: 22.2156, lng: -97.8583 },
  "2247060": { name: "Aeropuerto (Tampico)", lat: 22.2961, lng: -97.8656 },

  // GRUPO CANTERA ROSA (MORELIA) - 3 SUCURSALES
  "2247061": { name: "Lazaro Cardenas (Morelia)", lat: 19.7028, lng: -101.1944 },
  "2247062": { name: "Madero (Morelia)", lat: 19.7039, lng: -101.1956 },
  "2247063": { name: "Huerta", lat: 19.6994, lng: -101.2069 },

  // GRUPO MATAMOROS - 5 SUCURSALES
  "2247064": { name: "Pedro Cardenas", lat: 25.8797, lng: -97.5039 },
  "2247065": { name: "Lauro Villar", lat: 25.8669, lng: -97.4914 },
  "2247066": { name: "Centro (Matamoros)", lat: 25.8694, lng: -97.5028 },
  "2247067": { name: "Avenida del Niño", lat: 25.8531, lng: -97.4889 },
  "2247068": { name: "Puerto Rico", lat: 25.8528, lng: -97.5092 },

  // OTROS GRUPOS
  "2247069": { name: "Coahuila Comidas", lat: 28.7000, lng: -100.5244 },
  "2247070": { name: "Centrito Valle", lat: 25.6756, lng: -100.3111 },
  "2247071": { name: "Sabinas Hidalgo", lat: 26.5069, lng: -100.1764 },

  // CRR - 3 SUCURSALES
  "2247072": { name: "Anzalduas", lat: 26.0733, lng: -98.3261 },
  "2247073": { name: "Hidalgo (Reynosa)", lat: 26.1006, lng: -98.2631 },
  "2247074": { name: "Libramiento (Reynosa)", lat: 26.0347, lng: -98.3147 },

  // RAP - 3 SUCURSALES
  "2247075": { name: "Aeropuerto (Reynosa)", lat: 26.0083, lng: -98.2283 },
  "2247076": { name: "Boulevard Morelos", lat: 26.0892, lng: -98.2778 },
  "2247077": { name: "Alcala", lat: 26.0464, lng: -98.2969 },

  // OTROS
  "2247078": { name: "Rio Bravo", lat: 25.9906, lng: -98.0931 },
  "2247079": { name: "Guerrero 2 (Ruelas)", lat: 27.4772, lng: -99.5072 },
  "2247080": { name: "Reforma (Ruelas)", lat: 27.4858, lng: -99.5031 }
};

async function analizarYCorregirCoordenadas() {
  console.log('🔍 ANÁLISIS DE COORDENADAS DE SUCURSALES');
  console.log('Comparando BD actual vs coordenadas validadas del dashboard iOS');
  console.log('='.repeat(70));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // Obtener todas las sucursales actuales
    const sucursalesActuales = await client.query(`
      SELECT 
        location_code,
        name,
        group_name,
        latitude,
        longitude,
        active
      FROM tracking_locations_cache 
      ORDER BY CAST(location_code AS INTEGER)
    `);
    
    console.log(`📊 Total de sucursales en BD: ${sucursalesActuales.rows.length}`);
    console.log(`📍 Coordenadas validadas disponibles: ${Object.keys(COORDENADAS_VALIDADAS).length}`);
    console.log('');
    
    const discrepancias = [];
    const coincidencias = [];
    const faltantes = [];
    
    // Analizar cada sucursal
    sucursalesActuales.rows.forEach(sucursal => {
      const codigo = sucursal.location_code;
      const validada = COORDENADAS_VALIDADAS[codigo];
      
      if (validada) {
        const latBD = parseFloat(sucursal.latitude);
        const lngBD = parseFloat(sucursal.longitude);
        
        // Calcular diferencia (tolerancia de 0.001 grados ≈ 100 metros)
        const diferenciaLat = Math.abs(latBD - validada.lat);
        const diferenciaLng = Math.abs(lngBD - validada.lng);
        
        if (diferenciaLat > 0.001 || diferenciaLng > 0.001) {
          discrepancias.push({
            codigo,
            nombre: sucursal.name,
            grupo: sucursal.group_name,
            actual: { lat: latBD, lng: lngBD },
            validada: { lat: validada.lat, lng: validada.lng, name: validada.name },
            diferencia: { lat: diferenciaLat, lng: diferenciaLng }
          });
        } else {
          coincidencias.push({
            codigo,
            nombre: sucursal.name
          });
        }
      } else {
        faltantes.push({
          codigo,
          nombre: sucursal.name,
          grupo: sucursal.group_name,
          coordenadas: { lat: parseFloat(sucursal.latitude), lng: parseFloat(sucursal.longitude) }
        });
      }
    });
    
    // REPORTE DE RESULTADOS
    console.log('📊 RESULTADOS DEL ANÁLISIS:');
    console.log('='.repeat(40));
    console.log(`✅ Coincidencias (coordenadas correctas): ${coincidencias.length}`);
    console.log(`⚠️  Discrepancias (coordenadas diferentes): ${discrepancias.length}`);
    console.log(`❓ Faltantes (no hay coordenadas validadas): ${faltantes.length}`);
    console.log('');
    
    if (discrepancias.length > 0) {
      console.log('🔴 SUCURSALES CON COORDENADAS INCORRECTAS:');
      console.log('='.repeat(50));
      
      discrepancias.forEach((disc, index) => {
        console.log(`${index + 1}. [${disc.codigo}] ${disc.nombre}`);
        console.log(`   Grupo: ${disc.grupo}`);
        console.log(`   ❌ Actual BD: ${disc.actual.lat}, ${disc.actual.lng}`);
        console.log(`   ✅ Validada:   ${disc.validada.lat}, ${disc.validada.lng}`);
        console.log(`   📏 Diferencia: lat=${disc.diferencia.lat.toFixed(4)}, lng=${disc.diferencia.lng.toFixed(4)}`);
        console.log('');
      });
    }
    
    if (faltantes.length > 0) {
      console.log('🟡 SUCURSALES SIN COORDENADAS VALIDADAS:');
      console.log('='.repeat(45));
      
      faltantes.forEach((falt, index) => {
        console.log(`${index + 1}. [${falt.codigo}] ${falt.nombre}`);
        console.log(`   Grupo: ${falt.grupo}`);
        console.log(`   📍 Coordenadas actuales: ${falt.coordenadas.lat}, ${falt.coordenadas.lng}`);
        console.log('');
      });
    }
    
    // PROPUESTA DE CORRECCIÓN
    if (discrepancias.length > 0) {
      console.log('🔧 PROPUESTA DE CORRECCIÓN:');
      console.log('='.repeat(35));
      console.log(`Se pueden corregir ${discrepancias.length} sucursales con coordenadas validadas.`);
      console.log('');
      
      console.log('¿Quieres continuar con la corrección? (y/n)');
      console.log('Nota: Esto actualizará las coordenadas en la base de datos.');
      console.log('');
      
      // Por ahora solo mostrar el reporte
      console.log('📋 SCRIPT DE CORRECCIÓN GENERADO');
      console.log('Para aplicar las correcciones, ejecuta el método corregirCoordenadas()');
    }
    
  } catch (error) {
    console.error('❌ Error durante el análisis:', error.message);
  } finally {
    await client.end();
  }
}

async function corregirCoordenadas() {
  console.log('🔧 APLICANDO CORRECCIONES DE COORDENADAS');
  console.log('='.repeat(45));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    let corregidas = 0;
    
    for (const [codigo, coordenada] of Object.entries(COORDENADAS_VALIDADAS)) {
      try {
        const result = await client.query(`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
          AND (
            ABS(CAST(latitude AS DECIMAL) - $1) > 0.001 
            OR ABS(CAST(longitude AS DECIMAL) - $2) > 0.001
          )
        `, [coordenada.lat, coordenada.lng, codigo]);
        
        if (result.rowCount > 0) {
          console.log(`✅ [${codigo}] ${coordenada.name} - Coordenadas actualizadas`);
          corregidas++;
        }
      } catch (updateError) {
        console.log(`❌ [${codigo}] Error: ${updateError.message}`);
      }
    }
    
    console.log('');
    console.log(`🎯 RESUMEN DE CORRECCIÓN:`);
    console.log(`   ✅ Sucursales corregidas: ${corregidas}`);
    console.log(`   📍 Total de coordenadas validadas: ${Object.keys(COORDENADAS_VALIDADAS).length}`);
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error.message);
  } finally {
    await client.end();
  }
}

// Ejecutar análisis
if (require.main === module) {
  if (process.argv[2] === '--fix') {
    corregirCoordenadas()
      .then(() => {
        console.log('\n✅ Corrección completada');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Error crítico:', error);
        process.exit(1);
      });
  } else {
    analizarYCorregirCoordenadas()
      .then(() => {
        console.log('\n✅ Análisis completado');
        console.log('💡 Para aplicar correcciones, ejecuta: node fix-sucursales-coordenadas.js --fix');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Error crítico:', error);
        process.exit(1);
      });
  }
}

module.exports = { analizarYCorregirCoordenadas, corregirCoordenadas };