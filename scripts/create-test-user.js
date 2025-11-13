require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para crear usuario de prueba
 */
async function createTestUser() {
  let client;
  
  try {
    console.log('👤 Creando usuario de prueba...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // Verificar que la tabla existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tracking_users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabla tracking_users no existe');
      return;
    }
    
    // Verificar usuarios existentes
    const existingUsers = await client.query('SELECT tracker_id FROM tracking_users');
    console.log(`📊 Usuarios existentes: ${existingUsers.rows.length}`);
    
    // Crear usuario de prueba si no existe
    const testUser = {
      tracker_id: 'TEST01',
      zenput_email: 'test@pollo-loco.com',
      zenput_user_id: 'test_user_001',
      display_name: 'Usuario de Prueba',
      phone: '+52 555 1234567'
    };
    
    try {
      const result = await client.query(`
        INSERT INTO tracking_users (tracker_id, zenput_email, zenput_user_id, display_name, phone)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tracker_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          phone = EXCLUDED.phone
        RETURNING *
      `, [testUser.tracker_id, testUser.zenput_email, testUser.zenput_user_id, testUser.display_name, testUser.phone]);
      
      console.log('✅ Usuario de prueba creado/actualizado:', result.rows[0]);
      
    } catch (error) {
      console.error('❌ Error creando usuario:', error.message);
    }
    
    // Mostrar todos los usuarios
    const allUsers = await client.query('SELECT * FROM tracking_users ORDER BY created_at DESC');
    console.log('\n📋 Todos los usuarios:');
    allUsers.rows.forEach(user => {
      console.log(`  - ${user.tracker_id}: ${user.display_name} (${user.zenput_email})`);
    });
    
    console.log('\n🎉 Setup de usuario completado!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Ejecutar
if (require.main === module) {
  createTestUser()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createTestUser;