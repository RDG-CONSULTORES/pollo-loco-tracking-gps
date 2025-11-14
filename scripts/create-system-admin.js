require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

/**
 * Crear usuario administrador del sistema de autenticación
 * Para acceso al panel de administración
 */
async function createSystemAdmin() {
  let client;
  
  try {
    console.log('👑 Creando usuario administrador del sistema...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL');
    
    // 1. Verificar si existe la tabla system_users
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('📄 Creando tabla system_users...');
      
      // Crear tabla system_users
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20),
          user_type VARCHAR(20) CHECK (user_type IN ('admin', 'director', 'manager', 'supervisor')) NOT NULL,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      // Crear tabla user_sessions
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          last_activity TIMESTAMP DEFAULT NOW()
        );
      `);
      
      // Crear tabla user_audit_log
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_audit_log (
          id BIGSERIAL PRIMARY KEY,
          user_id INT REFERENCES system_users(id),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id VARCHAR(50),
          details JSONB DEFAULT '{}',
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('✅ Tablas del sistema de autenticación creadas');
    }
    
    // 2. Crear usuario administrador
    const adminCredentials = {
      email: 'admin@polloloco.com',
      password: 'admin123',
      fullName: 'Administrador Sistema',
      phone: '+52 81 1234 5678',
      userType: 'admin'
    };
    
    // Hash del password
    console.log('🔐 Generando hash de password...');
    const passwordHash = await bcrypt.hash(adminCredentials.password, 12);
    
    // Insertar o actualizar usuario admin
    const adminResult = await client.query(`
      INSERT INTO system_users (email, password_hash, full_name, phone, user_type, active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        user_type = EXCLUDED.user_type,
        active = true,
        updated_at = NOW()
      RETURNING id, email, full_name, user_type, active, created_at
    `, [
      adminCredentials.email,
      passwordHash,
      adminCredentials.fullName,
      adminCredentials.phone,
      adminCredentials.userType
    ]);
    
    const adminUser = adminResult.rows[0];
    
    console.log('✅ Usuario administrador creado/actualizado:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${adminUser.email}`);
    console.log(`🔑 Password: ${adminCredentials.password}`);
    console.log(`👤 Nombre: ${adminUser.full_name}`);
    console.log(`📱 Teléfono: ${adminCredentials.phone}`);
    console.log(`🛡️ Tipo: ${adminUser.user_type}`);
    console.log(`✅ Activo: ${adminUser.active}`);
    console.log(`📅 Creado: ${adminUser.created_at}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 3. Verificar estado de la tabla
    const userCount = await client.query('SELECT COUNT(*) as total FROM system_users');
    console.log(`👥 Total usuarios en sistema: ${userCount.rows[0].total}`);
    
    // 4. Crear usuario de tracking vinculado (opcional)
    console.log('\n📱 Creando usuario de tracking vinculado...');
    
    try {
      await client.query(`
        INSERT INTO tracking_users (tracker_id, zenput_email, display_name, active, rol, grupo)
        VALUES ($1, $2, $3, true, 'auditor', 'ADMINISTRACION')
        ON CONFLICT (tracker_id) DO UPDATE SET
          zenput_email = EXCLUDED.zenput_email,
          display_name = EXCLUDED.display_name,
          rol = EXCLUDED.rol,
          grupo = EXCLUDED.grupo,
          active = true,
          updated_at = NOW()
      `, ['ADMIN01', adminCredentials.email, 'Administrador Sistema']);
      
      console.log('✅ Usuario de tracking vinculado creado');
      
    } catch (trackingError) {
      console.log('⚠️ Usuario de tracking no creado (tabla puede no existir)');
    }
    
    console.log('\n🚀 INSTRUCCIONES DE USO:');
    console.log('1. Ve a: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/login.html');
    console.log(`2. Usa email: ${adminCredentials.email}`);
    console.log(`3. Usa password: ${adminCredentials.password}`);
    console.log('4. Accede al panel de admin después del login exitoso');
    
    console.log('\n🎉 ¡Usuario administrador configurado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (client) {
      await client.end();
      console.log('📋 Conexión cerrada');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createSystemAdmin()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createSystemAdmin;