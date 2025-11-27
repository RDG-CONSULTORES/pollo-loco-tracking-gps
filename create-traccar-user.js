require('dotenv').config();
const { Pool } = require('pg');

async function createTraccarUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚀 CREANDO USUARIO TRACCAR RÁPIDO\n');
    
    // Usuario de ejemplo - cambiar por datos reales
    const newUser = {
      tracker_id: 'TRACCAR01',
      display_name: 'Empleado Traccar Test',
      role: 'employee',
      active: true
    };
    
    console.log('📝 DATOS DEL NUEVO USUARIO:');
    console.log(`   Tracker ID: ${newUser.tracker_id}`);
    console.log(`   Nombre: ${newUser.display_name}`);
    console.log(`   Rol: ${newUser.role}`);
    
    // Verificar si ya existe
    const existing = await pool.query(`
      SELECT id, tracker_id, display_name 
      FROM tracking_users 
      WHERE tracker_id = $1
    `, [newUser.tracker_id]);
    
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      console.log('\n⚠️ USUARIO YA EXISTE:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Tracker ID: ${user.tracker_id}`);
      console.log(`   Nombre: ${user.display_name}`);
      
      // Mostrar URLs inmediatamente
      console.log('\n🔗 URLS LISTAS PARA USAR:');
      console.log(`📱 Setup Traccar: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/setup/${user.tracker_id}`);
      console.log(`📋 Config JSON: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/config/${user.tracker_id}`);
      
      return { success: true, existed: true, user };
    }
    
    // Crear nuevo usuario
    console.log('\n🔄 CREANDO USUARIO...');
    const result = await pool.query(`
      INSERT INTO tracking_users (
        tracker_id, display_name, role, active, created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [
      newUser.tracker_id,
      newUser.display_name,
      newUser.role,
      newUser.active
    ]);
    
    const user = result.rows[0];
    
    console.log('\n🎉 ¡USUARIO CREADO EXITOSAMENTE!');
    console.log('=' .repeat(60));
    console.log(`✅ ID: ${user.id}`);
    console.log(`✅ Tracker ID: ${user.tracker_id}`);
    console.log(`✅ Nombre: ${user.display_name}`);
    console.log(`✅ Rol: ${user.role}`);
    
    console.log('\n🔗 URLS PARA CONFIGURACIÓN RÁPIDA:');
    console.log(`📱 Setup Traccar: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/setup/${user.tracker_id}`);
    console.log(`📋 Config JSON: https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/config/${user.tracker_id}`);
    
    console.log('\n📲 PRÓXIMO PASO: Generar QR');
    console.log('   Ejecuta: node generate-traccar-qr.js');
    
    return { success: true, existed: false, user };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
createTraccarUser().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡USUARIO LISTO PARA TRACCAR!');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});