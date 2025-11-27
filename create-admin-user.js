require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 BOOTSTRAP PRIMER USUARIO ADMIN\n');
    
    // Datos del admin
    const adminData = {
      // System user data
      username: 'admin',
      email: 'admin@polloloco.com', 
      password: 'PolloLoco2025!', // Cambiar después
      role: 'admin',
      
      // Tracking user data
      full_name: 'Administrador Sistema',
      phone: '+52 81 1234 5678',
      tracker_id: 'admin_tracker',
      position: 'Administrador de Sistema',
      
      // Telegram (opcional)
      telegram_user_id: process.env.ADMIN_TELEGRAM_USER_ID || null, // Roberto puede configurar después
      telegram_username: process.env.ADMIN_TELEGRAM_USERNAME || null
    };
    
    console.log('📋 DATOS DEL ADMIN:');
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Password: ${adminData.password} (CAMBIAR DESPUÉS)`);
    console.log(`   Role: ${adminData.role}`);
    console.log(`   Full Name: ${adminData.full_name}`);
    console.log('');
    
    // 1. Verificar si ya existe
    const existingAdmin = await pool.query(`
      SELECT id, email, full_name, user_type 
      FROM system_users 
      WHERE email = $1 AND user_type = 'admin'
    `, [adminData.email]);
    
    if (existingAdmin.rows.length > 0) {
      console.log('⚠️  YA EXISTE UN ADMIN:');
      const admin = existingAdmin.rows[0];
      console.log(`   ID: ${admin.id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   User Type: ${admin.user_type}`);
      console.log(`   Full Name: ${admin.full_name || 'N/A'}`);
      console.log('');
      console.log('✅ Usar credenciales existentes o ejecutar con --force para recrear');
      return { success: true, existed: true, admin };
    }
    
    console.log('🔄 CREANDO NUEVO ADMIN...');
    
    // 2. Hash de la contraseña
    const passwordHash = await bcrypt.hash(adminData.password, 10);
    console.log('   ✅ Password hasheado');
    
    // 3. Crear usuario tracking (users table)
    const trackingUserResult = await pool.query(`
      INSERT INTO users (
        full_name, phone, position, email, tracker_id, telegram_user_id, telegram_username,
        is_director, active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, NOW(), NOW())
      RETURNING *
    `, [
      adminData.full_name, adminData.phone, adminData.position, 
      adminData.email, adminData.tracker_id, adminData.telegram_user_id, 
      adminData.telegram_username
    ]);
    
    const trackingUser = trackingUserResult.rows[0];
    console.log(`   ✅ Usuario tracking creado: ID ${trackingUser.id}`);
    
    // 4. Crear usuario sistema (system_users table)  
    const systemUserResult = await pool.query(`
      INSERT INTO system_users (
        email, password_hash, full_name, phone, user_type, 
        active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'admin', true, NOW(), NOW())
      RETURNING *
    `, [
      adminData.email, passwordHash, adminData.full_name, adminData.phone
    ]);
    
    const systemUser = systemUserResult.rows[0];
    console.log(`   ✅ Usuario sistema creado: ID ${systemUser.id}`);
    
    // 5. Asignar permisos de admin
    console.log('🔐 ASIGNANDO PERMISOS...');
    
    // Obtener todos los grupos operativos disponibles
    const operationalGroups = await pool.query(`
      SELECT DISTINCT group_name 
      FROM tracking_locations_cache 
      WHERE active = true AND group_name IS NOT NULL
    `);
    
    console.log(`   📊 Grupos operativos encontrados: ${operationalGroups.rows.length}`);
    
    // Asignar acceso a TODOS los grupos operativos
    for (const group of operationalGroups.rows) {
      await pool.query(`
        INSERT INTO user_group_permissions (user_id, operational_group_name, granted_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, operational_group_name) DO NOTHING
      `, [trackingUser.id, group.group_name]);
    }
    
    console.log(`   ✅ Asignados ${operationalGroups.rows.length} grupos operativos`);
    
    // 6. Crear credenciales OwnTracks
    console.log('📱 CONFIGURANDO OWNTRACKS...');
    
    await pool.query(`
      INSERT INTO user_credentials (
        user_id, tracker_id, username, password_hash, 
        device_type, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'admin', NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        tracker_id = EXCLUDED.tracker_id,
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `, [trackingUser.id, adminData.tracker_id, adminData.username, passwordHash]);
    
    console.log('   ✅ Credenciales OwnTracks configuradas');
    
    // 7. Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL:');
    
    const verification = await pool.query(`
      SELECT 
        su.id as system_id, su.email, su.user_type, su.full_name as su_full_name,
        u.id as user_id, u.full_name, u.is_director, u.active,
        COUNT(ugp.id) as group_permissions
      FROM system_users su, users u
      LEFT JOIN user_group_permissions ugp ON u.id = ugp.user_id AND ugp.active = true
      WHERE su.email = u.email AND su.id = $1
      GROUP BY su.id, su.email, su.user_type, su.full_name, u.id, u.full_name, u.is_director, u.active
    `, [systemUser.id]);
    
    if (verification.rows.length > 0) {
      const admin = verification.rows[0];
      console.log(`   🆔 System ID: ${admin.system_id}`);
      console.log(`   👤 User ID: ${admin.user_id}`);
      console.log(`   📧 Email: ${admin.email}`);
      console.log(`   🎭 User Type: ${admin.user_type}`);
      console.log(`   👥 Director: ${admin.is_director}`);
      console.log(`   🔐 Permisos grupos: ${admin.group_permissions}`);
      console.log(`   ✅ Activo: ${admin.active}`);
    } else {
      console.log('   ⚠️  No se pudo obtener verificación completa');
      console.log(`   🆔 System ID: ${systemUser.id}`);
      console.log(`   👤 User ID: ${trackingUser.id}`);
    }
    
    console.log('\n🎉 ¡ADMIN CREADO EXITOSAMENTE!');
    console.log('=' .repeat(60));
    console.log('✅ Usuario sistema y tracking configurados');
    console.log('✅ Permisos asignados a todos los grupos operativos');
    console.log('✅ Credenciales OwnTracks preparadas');
    console.log('');
    console.log('🔑 CREDENCIALES DE LOGIN:');
    console.log(`   URL: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/`);
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Password: ${adminData.password}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambiar password después del primer login');
    console.log('⚠️  Configurar telegram_user_id en variables de entorno si se desea');
    
    return { 
      success: true, 
      existed: false, 
      admin: {
        system_id: systemUser.id,
        user_id: trackingUser.id,
        username: adminData.username,
        email: adminData.email,
        password: adminData.password,
        full_name: adminData.full_name
      }
    };
    
  } catch (error) {
    console.error('❌ Error creando admin:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
const force = process.argv.includes('--force');
if (force) {
  console.log('🔥 MODO FORCE: Recreando admin...\n');
}

createAdminUser().then(result => {
  if (result.success) {
    if (result.existed) {
      console.log('\n🎯 ADMIN YA EXISTE');
      console.log('Usar --force para recrear');
    } else {
      console.log('\n🎯 ¡ADMIN CREADO EXITOSAMENTE!');
      console.log('Próximo paso: Re-habilitar autenticación Telegram');
    }
  } else {
    console.log('\n❌ Error:', result.error);
  }
});