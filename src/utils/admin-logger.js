const db = require('../config/database');

/**
 * Función simple para log de auditoría administrativa
 */
async function logAdminAction(action, entity_type, entity_id, old_value = null, new_value = null, admin_user = 'system') {
  try {
    // Verificar que la tabla existe
    const tableCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tracking_admin_log'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Tabla tracking_admin_log no existe, saltando log');
      return null;
    }

    const result = await db.query(
      `INSERT INTO tracking_admin_log 
       (admin_user, action, entity_type, entity_id, old_value, new_value, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [admin_user, action, entity_type, entity_id, old_value, new_value]
    );
    
    return result.rows[0].id;
    
  } catch (error) {
    console.error('❌ Error en logAdminAction:', error.message);
    // No lanzar error para evitar romper flujo principal
    return null;
  }
}

module.exports = {
  logAdminAction
};