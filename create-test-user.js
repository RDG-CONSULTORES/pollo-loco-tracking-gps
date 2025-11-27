require('dotenv').config();
const { Pool } = require('pg');

async function createTestUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🧪 CREANDO USUARIO DE TESTING\n');
    
    // Datos del usuario de testing
    const testUser = {
      tracker_id: 'DEMO01',
      display_name: 'Usuario Demo Testing',
      role: 'employee',
      active: true
    };
    
    console.log('📋 DATOS DEL USUARIO:');
    console.log(`   Tracker ID: ${testUser.tracker_id}`);
    console.log(`   Display Name: ${testUser.display_name}`);
    console.log(`   Role: ${testUser.role}`);
    console.log('');
    
    // Verificar si ya existe
    const existing = await pool.query(`
      SELECT id, tracker_id, display_name, role 
      FROM tracking_users 
      WHERE tracker_id = $1
    `, [testUser.tracker_id]);
    
    if (existing.rows.length > 0) {
      console.log('⚠️  YA EXISTE:');
      const user = existing.rows[0];
      console.log(`   ID: ${user.id}`);
      console.log(`   Tracker ID: ${user.tracker_id}`);
      console.log(`   Display Name: ${user.display_name}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
      console.log(`✅ URL de configuración: https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks-remote/config/${user.id}`);
      return { success: true, existed: true, user };
    }
    
    console.log('🔄 CREANDO USUARIO...');
    
    // Crear usuario en tracking_users
    const result = await pool.query(`
      INSERT INTO tracking_users (
        tracker_id, display_name, role, active, created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [
      testUser.tracker_id,
      testUser.display_name, 
      testUser.role,
      testUser.active
    ]);
    
    const newUser = result.rows[0];
    console.log(`   ✅ Usuario creado: ID ${newUser.id}`);
    
    console.log('\n🎉 ¡USUARIO TESTING CREADO!');
    console.log('=' .repeat(60));
    console.log(`✅ ID: ${newUser.id}`);
    console.log(`✅ Tracker ID: ${newUser.tracker_id}`);
    console.log(`✅ Display Name: ${newUser.display_name}`);
    console.log(`✅ Role: ${newUser.role}`);
    console.log('');
    console.log('🔗 URLS PARA TESTING:');
    console.log(`   OwnTracks Config: https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks-remote/config/${newUser.id}`);
    console.log(`   QR Generator: https://pollo-loco-tracking-gps-production.up.railway.app/api/qr/qr/${newUser.id}`);
    
    return { 
      success: true, 
      existed: false, 
      user: newUser
    };
    
  } catch (error) {
    console.error('❌ Error creando usuario testing:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
createTestUser().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡LISTO PARA TESTING!');
    if (!result.existed) {
      console.log('Usuario creado exitosamente');
    }
  } else {
    console.log('\n❌ Error:', result.error);
  }
});