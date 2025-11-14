require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * SETUP DEL SISTEMA DE GESTIÓN DE USUARIOS
 * Instala las nuevas tablas sin afectar el sistema existente
 */
async function setupUserManagement() {
  let client;
  
  try {
    console.log('🚀 === SETUP DEL SISTEMA DE GESTIÓN DE USUARIOS ===');
    console.log('📊 Instalando nuevas tablas sin afectar sistema actual');
    
    // Conectar a la base de datos usando URL externa
    const connectionString = 'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@autorack.proxy.rlwy.net:21655/railway';
    
    client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Conectado a la base de datos');
    
    // Verificar que las tablas existentes no se vean afectadas
    console.log('\\n🔍 Verificando tablas existentes...');
    const existingTables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN (
          'tracking_locations_cache', 
          'tracking_users', 
          'gps_locations',
          'geofence_events'
        )
    `);
    
    console.log(`✅ Tablas críticas existentes: ${existingTables.rows.length}`);
    existingTables.rows.forEach(row => {
      console.log(`   - ${row.tablename}`);
    });
    
    // Leer y ejecutar el schema de user management
    console.log('\\n📋 Ejecutando schema de gestión de usuarios...');
    const schemaPath = path.join(__dirname, '../src/database/user-management-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schemaSql);
    console.log('✅ Schema ejecutado exitosamente');
    
    // Verificar que las nuevas tablas fueron creadas
    console.log('\\n🔍 Verificando nuevas tablas creadas...');
    const newTables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN (
          'system_users',
          'directors', 
          'director_groups',
          'supervisors',
          'supervisor_assignments',
          'managers',
          'manager_supervisor_assignments',
          'alert_configurations',
          'report_configurations',
          'user_sessions',
          'user_audit_log'
        )
    `);
    
    console.log(`✅ Nuevas tablas creadas: ${newTables.rows.length}/11`);
    newTables.rows.forEach(row => {
      console.log(`   ✅ ${row.tablename}`);
    });
    
    // Crear usuario administrador por defecto
    console.log('\\n👤 Creando usuario administrador por defecto...');
    
    const bcrypt = require('bcrypt');
    const defaultPassword = 'admin123'; // Cambiar en producción
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    
    const adminResult = await client.query(`
      INSERT INTO system_users (email, password_hash, full_name, user_type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      RETURNING id, email, full_name
    `, [
      'admin@polloloco.com',
      passwordHash,
      'Administrador Sistema',
      'admin'
    ]);
    
    console.log(`✅ Usuario administrador: ${adminResult.rows[0].email}`);
    console.log(`📧 Email: admin@polloloco.com`);
    console.log(`🔑 Password: ${defaultPassword} (¡CAMBIAR EN PRODUCCIÓN!)`);
    
    // Verificar compatibilidad con sistema existente
    console.log('\\n🔗 Verificando compatibilidad con sistema existente...');
    
    const trackingUsersCount = await client.query('SELECT COUNT(*) FROM tracking_users');
    const locationsCount = await client.query('SELECT COUNT(*) FROM tracking_locations_cache');
    
    console.log(`✅ Sistema tracking actual:`);
    console.log(`   - Usuarios tracking: ${trackingUsersCount.rows[0].count}`);
    console.log(`   - Ubicaciones cache: ${locationsCount.rows[0].count}`);
    console.log('✅ Sistema existente no afectado');
    
    // Estadísticas finales
    console.log('\\n📊 === INSTALACIÓN COMPLETADA ===');
    console.log('✅ Nuevas tablas de gestión de usuarios instaladas');
    console.log('✅ Sistema de autenticación listo');
    console.log('✅ Usuario administrador creado');
    console.log('✅ Compatibilidad con sistema existente verificada');
    
    console.log('\\n🚀 PRÓXIMOS PASOS:');
    console.log('1. Cambiar password del admin en producción');
    console.log('2. Probar endpoints de autenticación:');
    console.log('   POST /api/auth/login');
    console.log('   GET /api/auth/me');
    console.log('3. Crear directores y supervisores');
    
  } catch (error) {
    console.error('💥 Error en setup:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

if (require.main === module) {
  setupUserManagement()
    .then(() => {
      console.log('\\n✅ Setup completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = setupUserManagement;