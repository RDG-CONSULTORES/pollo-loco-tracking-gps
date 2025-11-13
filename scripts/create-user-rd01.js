require('dotenv').config();
const { Client } = require('pg');

/**
 * Crear usuario RD01 para testing
 */
async function createUserRD01() {
  console.log('👤 Creando usuario RD01...');
  
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    // Verificar si RD01 ya existe
    const existingUser = await client.query(`
      SELECT * FROM tracking_users WHERE tracker_id = 'RD01'
    `);
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Usuario RD01 ya existe');
      console.log('   ID:', existingUser.rows[0].id);
      console.log('   Tracker ID:', existingUser.rows[0].tracker_id);
      console.log('   Display Name:', existingUser.rows[0].display_name);
      console.log('   Email:', existingUser.rows[0].zenput_email);
      console.log('   Activo:', existingUser.rows[0].active);
    } else {
      // Crear usuario RD01
      console.log('📝 Creando nuevo usuario RD01...');
      
      const result = await client.query(`
        INSERT INTO tracking_users 
        (tracker_id, display_name, zenput_email, active)
        VALUES ('RD01', 'Roberto Davila', 'roberto@pollocas.com', true)
        RETURNING *
      `);
      
      const newUser = result.rows[0];
      console.log('✅ Usuario RD01 creado exitosamente');
      console.log('   ID:', newUser.id);
      console.log('   Tracker ID:', newUser.tracker_id);
      console.log('   Display Name:', newUser.display_name);
      console.log('   Email:', newUser.zenput_email);
      console.log('   Activo:', newUser.active);
    }
    
    await client.end();
    console.log('🎯 Usuario RD01 listo para OwnTracks');
    
  } catch (error) {
    console.error('❌ Error creando usuario RD01:', error.message);
    throw error;
  }
}

if (require.main === module) {
  createUserRD01()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createUserRD01;