require('dotenv').config();
const { Pool } = require('pg');

async function checkMissingTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO TABLAS FALTANTES\n');
    
    // Lista de tablas que necesitamos verificar
    const requiredTables = [
      'user_group_permissions',
      'geofence_events', 
      'user_credentials',
      'director_alerts_config'
    ];
    
    console.log('📋 VERIFICANDO EXISTENCIA DE TABLAS:');
    
    for (const tableName of requiredTables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      const exists = result.rows[0].exists;
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}: ${exists ? 'EXISTS' : 'MISSING'}`);
      
      if (exists) {
        // Si existe, mostrar estructura básica
        const structure = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        console.log(`      Columnas (${structure.rows.length}):`);
        structure.rows.slice(0, 5).forEach(col => {
          console.log(`        • ${col.column_name} (${col.data_type})`);
        });
        if (structure.rows.length > 5) {
          console.log(`        ... y ${structure.rows.length - 5} más`);
        }
      }
      console.log('');
    }
    
    // Verificar referencias en el código que necesitan estas tablas
    console.log('🔗 REFERENCIAS EN EL CÓDIGO:');
    
    console.log('   📊 user_group_permissions:');
    console.log('      Referenciado en: unified-user-management.routes.js');
    console.log('      Propósito: Asignar usuarios a grupos operativos específicos');
    console.log('');
    
    console.log('   🚨 geofence_events:');
    console.log('      Referenciado en: geofence-alerts.js, varios archivos');
    console.log('      Propósito: Log de entradas/salidas de geofences');
    console.log('');
    
    console.log('   🔑 user_credentials:');
    console.log('      Referenciado en: gps-wizard.routes.js');
    console.log('      Propósito: Credenciales para configuración OwnTracks');
    console.log('');
    
    console.log('   📢 director_alerts_config:');
    console.log('      Referenciado en: alerts-config.routes.js');
    console.log('      Propósito: Configuración de alertas por director');
    console.log('');
    
    return { success: true, tables: requiredTables };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar verificación
checkMissingTables().then(result => {
  if (result.success) {
    console.log('🎯 VERIFICACIÓN COMPLETADA');
    console.log('Siguiente paso: Crear tablas faltantes con create-missing-tables.js');
  } else {
    console.log('❌ Error en verificación:', result.error);
  }
});