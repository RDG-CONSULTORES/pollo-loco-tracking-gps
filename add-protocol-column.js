require('dotenv').config();
const { Pool } = require('pg');

async function addProtocolColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔄 AGREGANDO COLUMNA PROTOCOL A gps_locations\n');
    
    // Verificar si la columna ya existe
    const columnExists = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'gps_locations' 
      AND column_name = 'protocol'
    `);
    
    if (columnExists.rows.length > 0) {
      console.log('✅ La columna "protocol" ya existe en gps_locations');
      return { success: true, existed: true };
    }
    
    console.log('📝 Agregando columna protocol...');
    
    // Agregar columna protocol
    await pool.query(`
      ALTER TABLE gps_locations 
      ADD COLUMN protocol VARCHAR(20) DEFAULT 'owntracks'
    `);
    
    console.log('✅ Columna protocol agregada exitosamente');
    
    // Actualizar registros existentes
    const updateResult = await pool.query(`
      UPDATE gps_locations 
      SET protocol = 'owntracks' 
      WHERE protocol IS NULL
    `);
    
    console.log(`✅ ${updateResult.rowCount} registros actualizados con protocol='owntracks'`);
    
    // Crear índice para mejor performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gps_locations_protocol 
      ON gps_locations(protocol)
    `);
    
    console.log('✅ Índice para protocol creado');
    
    // Verificar estructura final
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'gps_locations' 
      AND column_name IN ('protocol', 'tracker_id', 'user_id')
      ORDER BY column_name
    `);
    
    console.log('\n📋 ESTRUCTURA ACTUALIZADA:');
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
    });
    
    return { success: true, existed: false };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
addProtocolColumn().then(result => {
  if (result.success) {
    console.log('\n🎉 COLUMNA PROTOCOL CONFIGURADA');
    console.log('✅ Sistema listo para soporte dual OwnTracks + Traccar');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});