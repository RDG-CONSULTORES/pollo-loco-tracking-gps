require('dotenv').config();
const { Client } = require('pg');

/**
 * SCRIPT DE EMERGENCIA - REVERTIR COORDENADAS INCORRECTAS
 * Restaurar coordenadas desde backup o sistema previo
 */

async function revertCoordinatesToOriginal() {
  console.log('🚨 REVIRTIENDO COORDENADAS A ESTADO ANTERIOR');
  console.log('Restaurando ubicaciones correctas originales');
  console.log('='.repeat(55));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // Primero, hacer backup de las coordenadas actuales (incorrectas)
    console.log('📋 Creando backup de coordenadas incorrectas...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_locations_backup_bad AS
      SELECT *, NOW() as backup_timestamp
      FROM tracking_locations_cache
    `);
    
    console.log('✅ Backup creado: tracking_locations_backup_bad\n');
    
    // Buscar si existe un backup anterior con coordenadas correctas
    const backupCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%backup%' 
      AND table_name != 'tracking_locations_backup_bad'
    `);
    
    if (backupCheck.rows.length > 0) {
      console.log('📁 Backups encontrados:');
      backupCheck.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      console.log('');
    }
    
    // Obtener muestra de ubicaciones actuales para ver el problema
    const currentSample = await client.query(`
      SELECT 
        location_code,
        name,
        latitude,
        longitude,
        group_name
      FROM tracking_locations_cache 
      WHERE location_code IN ('2247000', '2247003', '2247006', '2247010', '2247037', '2247040')
      ORDER BY location_code
    `);
    
    console.log('🔍 MUESTRA DE COORDENADAS ACTUALES (INCORRECTAS):');
    console.log('='.repeat(50));
    
    currentSample.rows.forEach(row => {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      console.log(`❌ [${row.location_code}] ${row.name}`);
      console.log(`   📍 ${lat}, ${lng}`);
      console.log(`   🗺️ https://www.google.com/maps?q=${lat},${lng}`);
      console.log('');
    });
    
    console.log('⚠️ ESTAS COORDENADAS SON INCORRECTAS Y NECESITAN SER REVERTIDAS\n');
    
    // Solicitar confirmación para revertir
    console.log('🎯 OPCIONES PARA CORREGIR:');
    console.log('='.repeat(30));
    console.log('1. Restaurar desde backup anterior (si existe)');
    console.log('2. Obtener coordenadas reales desde sistema de supervisión');
    console.log('3. Usar Google Maps API para coordenadas precisas');
    console.log('4. Mapeo manual de sucursales principales');
    console.log('');
    
    console.log('💡 RECOMENDACIÓN INMEDIATA:');
    console.log('Necesitamos acceso a las coordenadas REALES del sistema de supervisión operativa');
    console.log('o usar Google Maps API para obtener ubicaciones precisas.');
    
  } catch (error) {
    console.error('❌ Error durante reversión:', error.message);
  } finally {
    await client.end();
  }
}

// Coordenadas de emergencia conocidas para sucursales principales
const COORDENADAS_EMERGENCIA = {
  // Estas son coordenadas aproximadas del área metropolitana de Monterrey
  // NO son las exactas, pero están en la región correcta
  "2247000": { name: "Pino Suarez", lat: 25.6689, lng: -100.3204 }, // Centro Monterrey
  "2247001": { name: "Madero", lat: 25.6849, lng: -100.3207 }, // Centro Monterrey  
  "2247002": { name: "Matamoros", lat: 25.6695, lng: -100.3151 }, // Centro Monterrey
  "2247003": { name: "Santa Catarina", lat: 25.6746, lng: -100.4446 }, // Santa Catarina
  "2247006": { name: "La Huasteca", lat: 25.6658, lng: -100.4136 }, // Santa Catarina área
  "2247010": { name: "Lincoln", lat: 25.7617, lng: -100.4061 }, // San Nicolás
  "2247037": { name: "Gomez Morin", lat: 25.6505, lng: -100.3839 }, // San Pedro
  "2247040": { name: "Vasconcelos", lat: 25.6625, lng: -100.4042 }, // San Pedro
};

async function applyEmergencyCoordinates() {
  console.log('🆘 APLICANDO COORDENADAS DE EMERGENCIA');
  console.log('Ubicaciones aproximadas para restaurar funcionalidad básica');
  console.log('='.repeat(60));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    let updated = 0;
    
    for (const [codigo, coord] of Object.entries(COORDENADAS_EMERGENCIA)) {
      try {
        const result = await client.query(`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        `, [coord.lat, coord.lng, codigo]);
        
        if (result.rowCount > 0) {
          console.log(`✅ [${codigo}] ${coord.name} - Coordenadas de emergencia aplicadas`);
          console.log(`   📍 ${coord.lat}, ${coord.lng}`);
          updated++;
        }
      } catch (updateError) {
        console.log(`❌ [${codigo}] Error: ${updateError.message}`);
      }
    }
    
    console.log(`\n🎯 Coordenadas de emergencia aplicadas: ${updated}/8 sucursales principales`);
    console.log('\n⚠️ IMPORTANTE: Estas son coordenadas aproximadas del área correcta.');
    console.log('Necesitamos obtener las coordenadas EXACTAS del sistema real.');
    
  } catch (error) {
    console.error('❌ Error aplicando coordenadas de emergencia:', error.message);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const modo = process.argv[2];
  
  if (modo === '--emergency') {
    applyEmergencyCoordinates()
      .then(() => {
        console.log('\n✅ Coordenadas de emergencia aplicadas');
        console.log('💡 Verifica el dashboard y luego obtengamos las coordenadas exactas');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Error crítico:', error);
        process.exit(1);
      });
  } else {
    revertCoordinatesToOriginal()
      .then(() => {
        console.log('\n✅ Análisis de reversión completado');
        console.log('💡 Para aplicar coordenadas de emergencia: node revert-coordinates-emergency.js --emergency');
        process.exit(0);
      })
      .catch(error => {
        console.error('💥 Error crítico:', error);
        process.exit(1);
      });
  }
}

module.exports = { revertCoordinatesToOriginal, applyEmergencyCoordinates };