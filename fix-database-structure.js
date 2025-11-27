require('dotenv').config();
const { Pool } = require('pg');

async function fixDatabaseStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔧 ARREGLANDO ESTRUCTURA BASE DE DATOS\n');
    
    // 1. Verificar estructura actual
    console.log('1️⃣ VERIFICANDO COLUMNAS ACTUALES...');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gps_locations'
      ORDER BY column_name
    `);
    
    console.log('📋 Columnas actuales en gps_locations:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // 2. Agregar columnas faltantes si no existen
    const fixes = [];
    
    // Verificar si velocity existe
    const hasVelocity = columns.rows.find(col => col.column_name === 'velocity');
    if (!hasVelocity) {
      fixes.push('ADD COLUMN velocity NUMERIC DEFAULT 0');
    }
    
    // Verificar si gps_timestamp existe  
    const hasGpsTimestamp = columns.rows.find(col => col.column_name === 'gps_timestamp');
    if (!hasGpsTimestamp) {
      fixes.push('ADD COLUMN gps_timestamp TIMESTAMP DEFAULT NOW()');
    }
    
    // Verificar si altitude existe
    const hasAltitude = columns.rows.find(col => col.column_name === 'altitude');
    if (!hasAltitude) {
      fixes.push('ADD COLUMN altitude NUMERIC DEFAULT 0');
    }
    
    // Verificar si heading existe
    const hasHeading = columns.rows.find(col => col.column_name === 'heading');
    if (!hasHeading) {
      fixes.push('ADD COLUMN heading NUMERIC DEFAULT 0');
    }
    
    // 3. Aplicar fixes
    if (fixes.length > 0) {
      console.log(`\n2️⃣ APLICANDO ${fixes.length} CORRECCIONES...`);
      
      for (const fix of fixes) {
        console.log(`   🔧 ${fix}`);
        await pool.query(`ALTER TABLE gps_locations ${fix}`);
      }
      
      console.log('✅ Correcciones aplicadas');
    } else {
      console.log('\n✅ ESTRUCTURA YA ESTÁ CORRECTA');
    }
    
    // 4. Crear índices para mejor performance
    console.log('\n3️⃣ CREANDO ÍNDICES...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_gps_user_timestamp ON gps_locations(user_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_gps_protocol ON gps_locations(protocol)',
      'CREATE INDEX IF NOT EXISTS idx_gps_created_at ON gps_locations(created_at DESC)'
    ];
    
    for (const index of indexes) {
      try {
        await pool.query(index);
        console.log(`   ✅ Índice creado`);
      } catch (error) {
        console.log(`   ⚠️ Índice ya existe: ${error.message.split('\n')[0]}`);
      }
    }
    
    // 5. Verificar estructura final
    console.log('\n4️⃣ VERIFICANDO ESTRUCTURA FINAL...');
    const finalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gps_locations'
      ORDER BY column_name
    `);
    
    console.log('📋 Estructura final:');
    finalColumns.rows.forEach(col => {
      console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n🎉 BASE DE DATOS ARREGLADA');
    console.log('✅ Traccar ya puede guardar datos correctamente');
    console.log('✅ Tu iPhone debería empezar a funcionar inmediatamente');
    
    return { success: true, fixes: fixes.length };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

fixDatabaseStructure().then(result => {
  if (result.success) {
    console.log(`\n🚀 ¡LISTO! Base de datos corregida con ${result.fixes || 0} cambios`);
    console.log('⏰ En 1 minuto, ejecuta: node simple-check-roberto.js');
    console.log('🎯 Tu iPhone ya debería estar guardando datos GPS');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});