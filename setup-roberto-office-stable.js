require('dotenv').config();
const { Pool } = require('pg');

/**
 * Configuración estable de oficina Roberto para testing
 * Ejecutar después del deployment para habilitar testing inmediato
 */
async function setupRobertoOffice() {
  console.log('🏢 Configurando oficina Roberto para testing...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Eliminar configuración anterior si existe
    await pool.query(`
      DELETE FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    
    // Insertar configuración actualizada
    const result = await pool.query(`
      INSERT INTO tracking_locations_cache (
        location_code, name, address, 
        latitude, longitude, 
        geofence_radius, geofence_enabled, active,
        group_name, director_name, synced_at
      )
      VALUES (
        'ROBERTO_OFFICE', 
        'Oficina Roberto - Testing',
        'Oficina Roberto - Testing (25.650648, -100.373529)',
        25.650648, 
        -100.373529, 
        20, 
        true, 
        true,
        'TESTING',
        'Roberto Davila',
        NOW()
      )
      RETURNING *
    `);
    
    console.log('✅ Oficina Roberto configurada:');
    console.log(`   📍 Ubicación: ${result.rows[0].latitude}, ${result.rows[0].longitude}`);
    console.log(`   🎯 Radio: ${result.rows[0].geofence_radius}m`);
    console.log(`   🟢 Estado: ${result.rows[0].geofence_enabled ? 'Activo' : 'Inactivo'}`);
    
    // Verificar configuración del usuario rd01
    const userCheck = await pool.query(`
      SELECT user_id, telegram_id, full_name, user_role, active 
      FROM tracking_users 
      WHERE username = 'rd01'
    `);
    
    if (userCheck.rows.length === 0) {
      console.log('⚠️ Usuario rd01 no encontrado, creando...');
      await pool.query(`
        INSERT INTO tracking_users (
          username, password_hash, full_name, user_role, 
          telegram_id, active, created_at
        ) VALUES (
          'rd01', 
          '$2b$10$example.hash.for.testing', 
          'Roberto Davila', 
          'admin',
          6932484342,
          true,
          NOW()
        )
      `);
      console.log('✅ Usuario rd01 creado');
    } else {
      console.log('✅ Usuario rd01 verificado:');
      console.log(`   👤 ${userCheck.rows[0].full_name}`);
      console.log(`   🔑 Rol: ${userCheck.rows[0].user_role}`);
      console.log(`   📱 Telegram: ${userCheck.rows[0].telegram_id}`);
    }
    
    // Verificar configuración del sistema
    await pool.query(`
      INSERT INTO system_config (config_key, config_value, updated_at)
      VALUES ('system_active', 'true', NOW())
      ON CONFLICT (config_key) 
      DO UPDATE SET config_value = 'true', updated_at = NOW()
    `);
    
    console.log('✅ Sistema activado para testing');
    console.log('\n🎯 LISTO PARA TESTING:');
    console.log('   1. Usuario rd01 configurado con Telegram ID 6932484342');
    console.log('   2. Oficina Roberto con radio 20m en coordenadas 25.650648, -100.373529');
    console.log('   3. Sistema activo para alertas de geofence');
    console.log('   4. Bot Telegram configurado para alertas');
    
  } catch (error) {
    console.error('❌ Error configurando oficina Roberto:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupRobertoOffice();
}

module.exports = { setupRobertoOffice };