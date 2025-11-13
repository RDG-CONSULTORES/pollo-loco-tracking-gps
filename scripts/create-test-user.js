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
    
    // Verificar estructura de tracking_users
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tracking_users'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Columnas en tracking_users:', columns.rows.map(r => r.column_name));
    
    // Crear usuario de prueba con columnas básicas
    const testUser = {
      tracker_id: 'TEST01',
      zenput_email: 'test@pollo-loco.com',
      display_name: 'Usuario de Prueba'
    };
    
    try {
      const result = await client.query(`
        INSERT INTO tracking_users (tracker_id, zenput_email, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (tracker_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          zenput_email = EXCLUDED.zenput_email
        RETURNING *
      `, [testUser.tracker_id, testUser.zenput_email, testUser.display_name]);
      
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