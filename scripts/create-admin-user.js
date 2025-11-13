require('dotenv').config();
const { Client } = require('pg');

/**
 * Crear usuario administrador real
 */
async function createAdminUser() {
  let client;
  
  try {
    console.log('👑 Creando usuario administrador...');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });
    
    await client.connect();
    console.log('✅ Conectado a base de datos');
    
    // Usuario administrador real
    const adminUser = {
      tracker_id: 'RD01',  // Roberto Davila 01
      zenput_email: 'roberto.davila@rdg-consultores.com',
      zenput_user_id: 'admin_roberto_001',
      display_name: 'Roberto Davila (Admin)',
      phone: null // Se puede agregar después
    };
    
    // Crear/actualizar usuario admin
    const result = await client.query(`
      INSERT INTO tracking_users (tracker_id, zenput_email, zenput_user_id, display_name, phone, active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (tracker_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        zenput_email = EXCLUDED.zenput_email,
        zenput_user_id = EXCLUDED.zenput_user_id,
        active = true,
        updated_at = NOW()
      RETURNING *
    `, [adminUser.tracker_id, adminUser.zenput_email, adminUser.zenput_user_id, adminUser.display_name, adminUser.phone]);
    
    const createdUser = result.rows[0];
    console.log('✅ Usuario administrador creado:', createdUser);
    
    // Actualizar variable TELEGRAM_ADMIN_IDS
    console.log('\n🔧 Para completar la configuración:');
    console.log('1. Ve a Railway → Variables');
    console.log('2. Actualiza TELEGRAM_ADMIN_IDS de "0" a "6932484342"');
    console.log('3. Redeploy la aplicación');
    
    console.log('\n📋 Datos del usuario administrador:');
    console.log(`  - Telegram ID: 6932484342`);
    console.log(`  - Tracker ID: ${createdUser.tracker_id}`);
    console.log(`  - Email: ${createdUser.zenput_email}`);
    console.log(`  - Nombre: ${createdUser.display_name}`);
    
    // Mostrar todos los usuarios
    const allUsers = await client.query('SELECT * FROM tracking_users ORDER BY created_at DESC');
    console.log('\n👥 Todos los usuarios:');
    allUsers.rows.forEach(user => {
      console.log(`  - ${user.tracker_id}: ${user.display_name} (${user.zenput_email})`);
    });
    
    console.log('\n🎉 Usuario administrador configurado exitosamente!');
    
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
  createAdminUser()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createAdminUser;