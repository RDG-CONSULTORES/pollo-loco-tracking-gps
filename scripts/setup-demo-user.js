const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function setupDemoUser() {
  console.log('📱 Configurando usuario demo para tracking GPS...');
  
  try {
    // 1. Verificar estructura de tracking_users
    console.log('📊 Verificando tabla tracking_users...');
    
    // Verificar si existe la tabla
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tracking_users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ Tabla tracking_users no existe, creándola...');
      await pool.query(`
        CREATE TABLE tracking_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE,
          phone VARCHAR(20),
          employee_id VARCHAR(50),
          role VARCHAR(50) DEFAULT 'supervisor',
          grupo_operativo VARCHAR(100),
          sucursal_asignada VARCHAR(100),
          device_id VARCHAR(100),
          active BOOLEAN DEFAULT true,
          synced_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    }

    // 2. Crear usuario demo para tu celular
    const demoUser = {
      tracker_id: 'rd01', // Este será tu device ID en OwnTracks (corto por límite de campo)
      zenput_email: 'roberto.demo@polloloco.com',
      display_name: 'Roberto Demo',
      phone: '+52-555-9999',
      zenput_user_id: 'DEMO001',
      rol: 'supervisor',
      grupo: 'GRP_SUR_1',
      active: true
    };

    console.log('👤 Creando usuario demo...');
    
    const userResult = await pool.query(`
      INSERT INTO tracking_users (
        tracker_id, zenput_email, display_name, phone, 
        zenput_user_id, rol, grupo, active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tracker_id) DO UPDATE SET
        zenput_email = EXCLUDED.zenput_email,
        display_name = EXCLUDED.display_name,
        phone = EXCLUDED.phone,
        zenput_user_id = EXCLUDED.zenput_user_id,
        rol = EXCLUDED.rol,
        grupo = EXCLUDED.grupo,
        active = EXCLUDED.active,
        updated_at = NOW()
      RETURNING id, display_name, zenput_email, tracker_id
    `, [
      demoUser.tracker_id,
      demoUser.zenput_email,
      demoUser.display_name,
      demoUser.phone,
      demoUser.zenput_user_id,
      demoUser.rol,
      demoUser.grupo,
      demoUser.active
    ]);

    const user = userResult.rows[0];
    console.log(`✅ Usuario demo creado: ${user.display_name} (ID: ${user.id})`);

    // 3. Verificar tabla gps_locations (la correcta para ubicaciones GPS)
    console.log('📍 Verificando tabla gps_locations...');
    
    const locationTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gps_locations'
      )
    `);
    
    if (!locationTableCheck.rows[0].exists) {
      console.log('⚠️ Tabla gps_locations no existe, creándola...');
      await pool.query(`
        CREATE TABLE gps_locations (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES tracking_users(id),
          zenput_email VARCHAR(100),
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          accuracy INTEGER,
          altitude INTEGER,
          battery INTEGER,
          velocity DECIMAL(8, 2),
          heading INTEGER,
          gps_timestamp TIMESTAMP NOT NULL,
          received_at TIMESTAMP DEFAULT NOW(),
          raw_payload JSONB
        );
        
        CREATE INDEX idx_gps_locations_user_id ON gps_locations(user_id);
        CREATE INDEX idx_gps_locations_email ON gps_locations(zenput_email);
        CREATE INDEX idx_gps_locations_timestamp ON gps_locations(gps_timestamp);
      `);
    }

    // 4. Insertar algunas ubicaciones demo (simuladas)
    console.log('📍 Creando ubicaciones demo...');
    
    const demoLocations = [
      {
        latitude: 19.4326,  // Ciudad de México
        longitude: -99.1332,
        accuracy: 10.0,
        speed: 0.0,
        address: 'Ciudad de México, CDMX'
      },
      {
        latitude: 19.4285,  
        longitude: -99.1277,
        accuracy: 15.0,
        speed: 5.2,
        address: 'Centro Histórico, CDMX'
      },
      {
        latitude: 19.4204,
        longitude: -99.1353,
        accuracy: 8.0,
        speed: 0.0,
        address: 'Zona Rosa, CDMX'
      }
    ];

    for (let i = 0; i < demoLocations.length; i++) {
      const loc = demoLocations[i];
      const timestampDevice = new Date(Date.now() - (i * 300000)); // Cada 5 minutos hacia atrás
      
      await pool.query(`
        INSERT INTO gps_locations (
          user_id, zenput_email, latitude, longitude, accuracy, 
          velocity, heading, altitude, battery, gps_timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        user.id,
        user.zenput_email,
        loc.latitude,
        loc.longitude,
        Math.floor(loc.accuracy), // accuracy como integer
        loc.speed,
        Math.floor(Math.random() * 360), // heading random
        Math.floor(Math.random() * 100 + 2200), // altitude random (2200-2300m CDMX)
        Math.floor(Math.random() * 40) + 60, // battery 60-100%
        timestampDevice
      ]);
    }

    // 5. Mostrar información para configuración de OwnTracks
    console.log('\n📱 CONFIGURACIÓN PARA TU CELULAR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📲 Descarga OwnTracks desde:');
    console.log('   📱 iOS: App Store');
    console.log('   🤖 Android: Google Play Store');
    console.log('');
    console.log('⚙️ Configuración en OwnTracks:');
    console.log(`   🌐 URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks/location`);
    console.log(`   👤 Username: ${user.tracker_id}`);
    console.log('   🔐 Password: (cualquier contraseña)');
    console.log(`   📍 Device ID: ${user.tracker_id}`);
    console.log('   📊 Mode: HTTP POST');
    console.log('');
    console.log('✅ Después de configurar OwnTracks, verás las ubicaciones en:');
    console.log('   🌐 https://pollo-loco-tracking-gps-production.up.railway.app/webapp/admin.html');
    console.log('   📊 Sección "Usuarios" para ver el tracking en tiempo real');

    // 6. Verificar datos creados
    const statsResult = await pool.query(`
      SELECT 
        u.display_name,
        u.tracker_id,
        COUNT(l.id) as location_count,
        MAX(l.received_at) as last_location
      FROM tracking_users u
      LEFT JOIN gps_locations l ON u.id = l.user_id
      WHERE u.zenput_email = $1
      GROUP BY u.id, u.display_name, u.tracker_id
    `, [demoUser.zenput_email]);

    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      console.log('\n📊 Resumen usuario demo:');
      console.log(`   👤 Nombre: ${stats.display_name}`);
      console.log(`   📱 Device ID: ${stats.tracker_id}`);
      console.log(`   📍 Ubicaciones: ${stats.location_count}`);
      console.log(`   🕐 Última ubicación: ${stats.last_location}`);
    }

    console.log('\n✅ Usuario demo configurado exitosamente');
    
  } catch (error) {
    console.error('❌ Error configurando usuario demo:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupDemoUser()
    .then(() => {
      console.log('🎉 Usuario demo listo para tracking');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { setupDemoUser };