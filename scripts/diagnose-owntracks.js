require('dotenv').config();
const { Client } = require('pg');

/**
 * Diagnóstico completo de OwnTracks
 */
async function diagnoseOwnTracks() {
  console.log('🔍 Diagnóstico completo de OwnTracks...\n');
  
  try {
    // 1. Verificar conexión a base de datos
    console.log('1️⃣ Verificando conexión a base de datos...');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('  ✅ Conectado a la base de datos\n');
    
    // 2. Verificar usuario RD01
    console.log('2️⃣ Verificando usuario RD01...');
    const userCheck = await client.query(`
      SELECT 
        id,
        tracker_id, 
        display_name, 
        active, 
        created_at,
        zenput_email
      FROM tracking_users 
      WHERE tracker_id = 'RD01'
    `);
    
    if (userCheck.rows.length === 0) {
      console.log('  ❌ Usuario RD01 NO ENCONTRADO');
      console.log('  📝 Creando usuario RD01...');
      
      await client.query(`
        INSERT INTO tracking_users (tracker_id, display_name, zenput_email, active)
        VALUES ('RD01', 'Roberto Davila', 'roberto@example.com', true)
        ON CONFLICT (tracker_id) DO NOTHING
      `);
      
      console.log('  ✅ Usuario RD01 creado');
    } else {
      const user = userCheck.rows[0];
      console.log(`  ✅ Usuario encontrado: ${user.display_name}`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Tracker ID: ${user.tracker_id}`);
      console.log(`      Email: ${user.zenput_email}`);
      console.log(`      Activo: ${user.active}`);
      console.log(`      Creado: ${user.created_at}`);
    }
    console.log('');
    
    // 3. Verificar ubicaciones recientes
    console.log('3️⃣ Verificando ubicaciones en base de datos...');
    const locationsCheck = await client.query(`
      SELECT 
        COUNT(*) as total_locations,
        COUNT(*) FILTER (WHERE DATE(gps_timestamp) = CURRENT_DATE) as today_locations,
        COUNT(*) FILTER (WHERE tracker_id = 'RD01') as rd01_locations,
        MAX(gps_timestamp) as last_location
      FROM tracking_locations
    `);
    
    const locationStats = locationsCheck.rows[0];
    console.log(`  📊 Total ubicaciones: ${locationStats.total_locations}`);
    console.log(`  📅 Ubicaciones hoy: ${locationStats.today_locations}`);
    console.log(`  👤 Ubicaciones RD01: ${locationStats.rd01_locations}`);
    console.log(`  🕒 Última ubicación: ${locationStats.last_location || 'Ninguna'}`);
    
    if (locationStats.rd01_locations > 0) {
      // Mostrar últimas ubicaciones de RD01
      const recentLocations = await client.query(`
        SELECT 
          gps_timestamp,
          latitude,
          longitude,
          accuracy
        FROM tracking_locations
        WHERE tracker_id = 'RD01'
        ORDER BY gps_timestamp DESC
        LIMIT 3
      `);
      
      console.log('  📍 Últimas ubicaciones RD01:');
      recentLocations.rows.forEach((loc, index) => {
        console.log(`     ${index + 1}. ${loc.gps_timestamp} | ${loc.latitude}, ${loc.longitude} (±${loc.accuracy}m)`);
      });
    }
    console.log('');
    
    // 4. Simular payload de OwnTracks
    console.log('4️⃣ Simulando recepción de datos OwnTracks...');
    const testPayload = {
      _type: 'location',
      tid: 'RD01',
      lat: 25.6866,
      lon: -100.3161,
      tst: Math.floor(Date.now() / 1000),
      acc: 5,
      batt: 85,
      vel: 0
    };
    
    console.log('  📱 Payload de prueba:');
    console.log('    ', JSON.stringify(testPayload, null, 4));
    
    // Verificar si el procesador de ubicaciones está disponible
    try {
      const locationProcessor = require('../src/services/location-processor');
      console.log('  ✅ Procesador de ubicaciones cargado');
      
      // Simular procesamiento
      console.log('  🔄 Procesando ubicación de prueba...');
      const processResult = await locationProcessor.processLocation(testPayload);
      
      console.log('  📊 Resultado del procesamiento:');
      console.log('    ', JSON.stringify(processResult, null, 4));
      
    } catch (error) {
      console.log('  ❌ Error cargando procesador:', error.message);
    }
    console.log('');
    
    // 5. Verificar estructura de tabla
    console.log('5️⃣ Verificando estructura de tabla tracking_users...');
    const tableStruct = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tracking_users'
      ORDER BY ordinal_position
    `);
    
    console.log('  📋 Columnas de tracking_users:');
    tableStruct.rows.forEach(col => {
      console.log(`     ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('');
    
    // 6. Verificar configuración del sistema
    console.log('6️⃣ Verificando configuración del sistema...');
    const configCheck = await client.query(`
      SELECT key, value
      FROM system_config
      WHERE key IN ('system_active', 'work_hours_start', 'work_hours_end')
    `);
    
    if (configCheck.rows.length > 0) {
      console.log('  ⚙️ Configuración encontrada:');
      configCheck.rows.forEach(config => {
        console.log(`     ${config.key}: ${config.value}`);
      });
    } else {
      console.log('  📝 Creando configuración por defecto...');
      await client.query(`
        INSERT INTO system_config (key, value) VALUES 
        ('system_active', 'true'),
        ('work_hours_start', '07:00'),
        ('work_hours_end', '21:00')
        ON CONFLICT (key) DO NOTHING
      `);
      console.log('  ✅ Configuración creada');
    }
    console.log('');
    
    // 7. Verificar endpoint URL
    console.log('7️⃣ Verificando URL de endpoint...');
    const expectedUrl = 'https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks/location';
    console.log(`  📡 URL esperada: ${expectedUrl}`);
    console.log('  📱 Configuración OwnTracks recomendada:');
    console.log('     URL: ' + expectedUrl);
    console.log('     Device ID: RD01');
    console.log('     User ID: RD01');
    console.log('     Mode: HTTP POST');
    console.log('     Authentication: None');
    console.log('');
    
    // 8. Test de conectividad HTTP (simulado)
    console.log('8️⃣ Recomendaciones para debugging...');
    console.log('  🔧 Pasos para verificar OwnTracks en iPhone:');
    console.log('     1. Abrir OwnTracks app');
    console.log('     2. Ir a Settings → Connection');
    console.log('     3. Verificar Mode = HTTP');
    console.log('     4. Verificar URL correcta');
    console.log('     5. Verificar Device ID = RD01');
    console.log('     6. Tap "Publish" para enviar ubicación manual');
    console.log('');
    console.log('  📱 Verificar permisos iPhone:');
    console.log('     1. Settings → Privacy & Security → Location Services');
    console.log('     2. Verificar Location Services = ON');
    console.log('     3. Buscar OwnTracks en la lista');
    console.log('     4. Verificar = "Always" o "While Using App"');
    console.log('     5. Settings → General → Background App Refresh');
    console.log('     6. Verificar OwnTracks = ON');
    console.log('');
    
    await client.end();
    
    console.log('🎯 DIAGNÓSTICO COMPLETADO');
    console.log('');
    console.log('✅ Próximos pasos:');
    console.log('   1. Verificar configuración OwnTracks en iPhone');
    console.log('   2. Intentar "Publish" manual desde OwnTracks');
    console.log('   3. Revisar logs del servidor en Railway');
    console.log('   4. Usar /api/owntracks/status para verificar estado');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  diagnoseOwnTracks()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = diagnoseOwnTracks;