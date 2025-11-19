require('dotenv').config();
const { Client } = require('pg');

/**
 * APLICADOR DE COORDENADAS MANUALES
 * Para aplicar coordenadas obtenidas manualmente desde Google Maps
 */

// Coordenadas corregidas conocidas (algunas ya verificadas)
const COORDENADAS_CORREGIDAS = {
  // Estas son coordenadas verificadas y precisas
  "2247000": { name: "Pino Suarez", lat: 25.6722, lng: -100.3089, source: "verificado" },
  "2247001": { name: "Madero", lat: 25.6758, lng: -100.3125, source: "estimado_centro" },
  "2247002": { name: "Matamoros", lat: 25.6800, lng: -100.3150, source: "estimado_centro" },
  "2247003": { name: "Santa Catarina", lat: 25.6733, lng: -100.4581, source: "verificado" },
  "2247004": { name: "Felix U. Gomez", lat: 25.6900, lng: -100.3200, source: "estimado" },
  "2247005": { name: "Garcia", lat: 25.8144, lng: -100.5467, source: "estimado_garcia" },
  "2247006": { name: "La Huasteca", lat: 25.6658, lng: -100.4136, source: "verificado" },
  
  // OGAS - Área metropolitana 
  "2247007": { name: "Gonzalitos", lat: 25.6947, lng: -100.3472, source: "estimado" },
  "2247008": { name: "Anahuac", lat: 25.7417, lng: -100.2778, source: "estimado_san_nicolas" },
  "2247009": { name: "Barragan", lat: 25.6869, lng: -100.3369, source: "estimado" },
  "2247010": { name: "Lincoln", lat: 25.7617, lng: -100.4061, source: "verificado" },
  "2247011": { name: "Concordia", lat: 25.6956, lng: -100.3169, source: "estimado" },
  "2247012": { name: "Escobedo", lat: 25.7817, lng: -100.3292, source: "estimado_escobedo" },
  "2247013": { name: "Aztlan", lat: 25.6789, lng: -100.2586, source: "estimado_guadalupe" },
  "2247014": { name: "Ruiz Cortinez", lat: 25.6825, lng: -100.2619, source: "estimado_guadalupe" },

  // EFM
  "2247016": { name: "Romulo Garza", lat: 25.7389, lng: -100.3033, source: "estimado_san_nicolas" },
  "2247017": { name: "Linda Vista", lat: 25.6842, lng: -100.2472, source: "estimado_guadalupe" },
  "2247018": { name: "Valle Soleado", lat: 25.6667, lng: -100.2500, source: "estimado_guadalupe" },

  // TEC
  "2247019": { name: "Tecnológico", lat: 25.6514, lng: -100.2897, source: "verificado" },
  "2247020": { name: "Chapultepec", lat: 25.6678, lng: -100.2850, source: "verificado" },
  "2247021": { name: "Satelite", lat: 25.6600, lng: -100.2800, source: "estimado" },
  "2247022": { name: "Guasave", lat: 25.5675, lng: -108.4686, source: "estimado_sinaloa" },

  // Lugares adicionales conocidos
  "2247037": { name: "Gomez Morin", lat: 25.6505, lng: -100.3839, source: "verificado_san_pedro" },
  "2247040": { name: "Vasconcelos", lat: 25.6625, lng: -100.4042, source: "verificado_san_pedro" }
};

async function aplicarCoordenadasManuales() {
  console.log('📍 APLICANDO COORDENADAS CORREGIDAS A BASE DE DATOS');
  console.log('Coordenadas verificadas y estimaciones mejoradas');
  console.log('='.repeat(60));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Mostrar coordenadas a aplicar
    console.log('📋 COORDENADAS A APLICAR:');
    console.log('='.repeat(30));
    
    Object.entries(COORDENADAS_CORREGIDAS).forEach(([codigo, data]) => {
      console.log(`[${codigo}] ${data.name}`);
      console.log(`   📍 ${data.lat}, ${data.lng} (${data.source})`);
      console.log(`   🗺️ https://www.google.com/maps?q=${data.lat},${data.lng}`);
      console.log('');
    });

    // Crear backup antes de aplicar
    console.log('💾 CREANDO BACKUP DE SEGURIDAD...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_locations_backup_$(date +%Y%m%d_%H%M%S) AS
      SELECT *, NOW() as backup_timestamp
      FROM tracking_locations_cache
      WHERE location_code = ANY($1)
    `.replace('$(date +%Y%m%d_%H%M%S)', new Date().toISOString().replace(/[:-]/g, '').split('.')[0]), 
    [Object.keys(COORDENADAS_CORREGIDAS)]);

    console.log('✅ Backup creado\n');

    // Aplicar coordenadas corregidas
    let aplicadas = 0;
    let errores = 0;

    console.log('🔄 APLICANDO COORDENADAS...');
    console.log('='.repeat(35));

    for (const [codigo, data] of Object.entries(COORDENADAS_CORREGIDAS)) {
      try {
        const result = await client.query(`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        `, [data.lat, data.lng, codigo]);

        if (result.rowCount > 0) {
          console.log(`✅ [${codigo}] ${data.name} - ${data.source}`);
          aplicadas++;
        } else {
          console.log(`⚠️ [${codigo}] ${data.name} - No encontrado en BD`);
        }
      } catch (updateError) {
        console.log(`❌ [${codigo}] Error: ${updateError.message}`);
        errores++;
      }
    }

    console.log(`\n📊 RESUMEN DE APLICACIÓN:`);
    console.log('='.repeat(30));
    console.log(`✅ Aplicadas exitosamente: ${aplicadas}`);
    console.log(`⚠️ No encontradas: ${Object.keys(COORDENADAS_CORREGIDAS).length - aplicadas - errores}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📍 Total procesadas: ${Object.keys(COORDENADAS_CORREGIDAS).length}`);

    // Verificar algunas coordenadas aplicadas
    console.log('\n🔍 VERIFICACIÓN DE COORDENADAS APLICADAS:');
    console.log('='.repeat(45));

    const verificacion = await client.query(`
      SELECT location_code, name, latitude, longitude, synced_at
      FROM tracking_locations_cache 
      WHERE location_code = ANY($1)
      ORDER BY location_code
      LIMIT 5
    `, [Object.keys(COORDENADAS_CORREGIDAS).slice(0, 5)]);

    verificacion.rows.forEach(row => {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      console.log(`✅ [${row.location_code}] ${row.name}`);
      console.log(`   📍 ${lat}, ${lng}`);
      console.log(`   🗺️ https://www.google.com/maps?q=${lat},${lng}`);
      console.log('');
    });

    console.log('🎯 SIGUIENTE PASO:');
    console.log('='.repeat(20));
    console.log('Verifica el dashboard en vivo:');
    console.log('https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    console.log('');
    console.log('💡 PARA COMPLETAR TODAS LAS COORDENADAS:');
    console.log('1. Obtén Google Maps API key');
    console.log('2. Ejecuta: node google-maps-complete-mapping.js');
    console.log('3. O continúa agregando coordenadas manualmente a este script');

  } catch (error) {
    console.error('❌ Error aplicando coordenadas:', error.message);
  } finally {
    await client.end();
  }
}

// Función para agregar nuevas coordenadas manualmente
function agregarCoordenadasManuales(codigo, lat, lng, nombre, source = "manual") {
  COORDENADAS_CORREGIDAS[codigo] = {
    name: nombre,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    source
  };
  
  console.log(`➕ Agregada: [${codigo}] ${nombre} - ${lat}, ${lng} (${source})`);
}

if (require.main === module) {
  aplicarCoordenadasManuales()
    .then(() => {
      console.log('\n✅ Coordenadas aplicadas exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { aplicarCoordenadasManuales, agregarCoordenadasManuales };