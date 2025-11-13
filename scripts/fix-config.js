require('dotenv').config();
const db = require('../src/config/database');

/**
 * Script para arreglar la configuración inicial del sistema
 */
async function fixConfig() {
  try {
    console.log('🔧 Arreglando configuración del sistema...');
    
    // Configuraciones por defecto
    const defaultConfigs = [
      { key: 'system_active', value: 'true', description: 'Estado del sistema de tracking' },
      { key: 'work_hours_start', value: '07:00', description: 'Hora de inicio laboral' },
      { key: 'work_hours_end', value: '21:00', description: 'Hora de fin laboral' },
      { key: 'geofence_radius_meters', value: '100', description: 'Radio de geofence en metros' },
      { key: 'min_visit_duration_minutes', value: '5', description: 'Duración mínima de visita' },
      { key: 'max_accuracy_meters', value: '100', description: 'Precisión máxima GPS aceptada' },
      { key: 'timezone', value: 'America/Mexico_City', description: 'Zona horaria del sistema' }
    ];
    
    // Insertar configuraciones por defecto
    for (const config of defaultConfigs) {
      await db.query(
        `INSERT INTO tracking_config (key, value, description, updated_by, updated_at)
         VALUES ($1, $2, $3, 'system', NOW())
         ON CONFLICT (key) DO NOTHING`,
        [config.key, config.value, config.description]
      );
      console.log(`✅ Config: ${config.key} = ${config.value}`);
    }
    
    // Verificar configuración
    const result = await db.query('SELECT key, value FROM tracking_config ORDER BY key');
    console.log('\n📊 Configuración actual:');
    result.rows.forEach(row => {
      console.log(`  ${row.key}: ${row.value}`);
    });
    
    console.log('\n✅ Configuración arreglada exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar
fixConfig();