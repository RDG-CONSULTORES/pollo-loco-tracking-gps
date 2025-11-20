const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupRobertoOffice() {
  try {
    console.log('🏢 Configurando oficina de Roberto para alertas GPS...\n');
    
    await pool.query('BEGIN');
    
    // 1. Verificar tablas existentes
    console.log('📋 Verificando estructura de tablas...');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%geofence%' OR table_name LIKE '%location%')
      ORDER BY table_name
    `);
    
    console.log('📊 Tablas encontradas:');
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    // 2. Verificar estructura tracking_locations_cache (que usa geofence-alerts.js)
    const cacheStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_locations_cache' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estructura tracking_locations_cache:');
    cacheStructure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });
    
    // 3. Agregar oficina de Roberto a tracking_locations_cache
    console.log('\n📍 Agregando oficina Roberto...');
    
    const insertResult = await pool.query(`
      INSERT INTO tracking_locations_cache (
        location_code,
        name,
        address,
        latitude,
        longitude,
        geofence_radius,
        active,
        synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (location_code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geofence_radius = EXCLUDED.geofence_radius,
        active = EXCLUDED.active,
        synced_at = NOW()
      RETURNING id, location_code, name
    `, [
      'ROBERTO_OFFICE',
      'Oficina Roberto - Testing',
      'Oficina Roberto - 25.650648, -100.373529',
      25.650648,
      -100.373529,
      150, // Radio 150 metros
      true
    ]);
    
    console.log(`✅ Oficina agregada: ID=${insertResult.rows[0].id}, Code=${insertResult.rows[0].location_code}`);
    
    // 4. También agregar a tracking_locations si existe
    try {
      await pool.query(`
        INSERT INTO tracking_locations (
          location_code,
          name,
          address,
          latitude,
          longitude,
          geofence_radius,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (location_code) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          geofence_radius = EXCLUDED.geofence_radius,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `, [
        'ROBERTO_OFFICE',
        'Oficina Roberto - Testing',
        'Oficina Roberto - 25.650648, -100.373529',
        25.650648,
        -100.373529,
        150,
        true
      ]);
      
      console.log('✅ También agregado a tracking_locations');
      
    } catch (error) {
      console.log('ℹ️ tracking_locations no existe o no es necesario');
    }
    
    // 5. Verificar que se agregó correctamente
    const verificationResult = await pool.query(`
      SELECT 
        id,
        location_code,
        name,
        latitude,
        longitude,
        geofence_radius,
        active
      FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    if (verificationResult.rows.length > 0) {
      const office = verificationResult.rows[0];
      console.log('\n📍 Oficina configurada exitosamente:');
      console.log(`   ID: ${office.id}`);
      console.log(`   Código: ${office.location_code}`);
      console.log(`   Nombre: ${office.name}`);
      console.log(`   Coordenadas: ${office.latitude}, ${office.longitude}`);
      console.log(`   Radio: ${office.geofence_radius}m`);
      console.log(`   Activa: ${office.active ? 'SÍ' : 'NO'}`);
      
      // Calcular algunas referencias cercanas
      console.log('\n📍 Referencias de ubicación:');
      console.log(`   Latitud: ${office.latitude}°`);
      console.log(`   Longitud: ${office.longitude}°`);
      console.log(`   Radio detección: ${office.geofence_radius} metros`);
      
    } else {
      throw new Error('No se pudo verificar la inserción');
    }
    
    // 6. Verificar usuario Roberto en tracking_users
    console.log('\n👤 Verificando usuario Roberto...');
    
    const userResult = await pool.query(`
      SELECT 
        id,
        tracker_id,
        display_name,
        zenput_email,
        active
      FROM tracking_users 
      WHERE tracker_id ILIKE '%roberto%' OR display_name ILIKE '%roberto%'
      ORDER BY id DESC
      LIMIT 5
    `);
    
    if (userResult.rows.length > 0) {
      console.log('👤 Usuarios encontrados:');
      userResult.rows.forEach(user => {
        console.log(`   ID: ${user.id} | ${user.tracker_id} | ${user.display_name} | ${user.active ? 'ACTIVO' : 'PAUSADO'}`);
      });
    } else {
      console.log('⚠️ No se encontró usuario Roberto. Necesitarás crear uno con GPS Wizard.');
    }
    
    await pool.query('COMMIT');
    
    console.log('\n🎉 Setup completado exitosamente!');
    console.log('\n📱 Próximos pasos:');
    console.log('1. Verificar que tu bot Telegram esté configurado');
    console.log('2. Asegurar que tienes un usuario GPS activo');
    console.log('3. Caminar hacia tu oficina para probar alertas');
    console.log('4. Verificar que recibes notificación en Telegram');
    
    console.log('\n🤖 Tu Telegram Admin ID configurado: 6932484342');
    console.log('🔗 Bot Token configurado: 8221962488:AAH...');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error configurando oficina:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

setupRobertoOffice();