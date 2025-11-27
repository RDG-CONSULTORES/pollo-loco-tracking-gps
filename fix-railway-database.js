/**
 * Script para arreglar estructura de base de datos directamente en Railway
 * Corrige columnas faltantes que causan errores en logs
 */

require('dotenv').config();
const { Pool } = require('pg');

async function fixRailwayDatabase() {
  console.log('🚄 ARREGLANDO BASE DE DATOS RAILWAY\n');
  
  // Usar exactamente la misma configuración que el sistema
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📡 Conectando a Railway PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión Railway establecida');
    
    // 1. Verificar estructura actual de gps_locations
    console.log('\n1️⃣ VERIFICANDO ESTRUCTURA gps_locations...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'gps_locations'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Columnas encontradas:');
    const columnNames = columns.rows.map(col => col.column_name);
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // 2. Verificar columnas críticas faltantes
    const requiredColumns = [
      { name: 'velocity', type: 'NUMERIC', default: '0' },
      { name: 'gps_timestamp', type: 'TIMESTAMP', default: 'NOW()' }
    ];
    
    const fixes = [];
    console.log('\n2️⃣ VERIFICANDO COLUMNAS CRÍTICAS...');
    
    requiredColumns.forEach(required => {
      if (!columnNames.includes(required.name)) {
        console.log(`   ❌ Falta columna: ${required.name}`);
        fixes.push(`ADD COLUMN ${required.name} ${required.type} DEFAULT ${required.default}`);
      } else {
        console.log(`   ✅ Columna OK: ${required.name}`);
      }
    });
    
    // 3. Aplicar correcciones si es necesario
    if (fixes.length > 0) {
      console.log(`\n3️⃣ APLICANDO ${fixes.length} CORRECCIONES...`);
      
      for (const fix of fixes) {
        console.log(`   🔧 ${fix}`);
        try {
          await pool.query(`ALTER TABLE gps_locations ${fix}`);
          console.log(`   ✅ Aplicado correctamente`);
        } catch (error) {
          console.log(`   ⚠️ Error: ${error.message}`);
        }
      }
    } else {
      console.log('\n✅ TODAS LAS COLUMNAS ESTÁN PRESENTES');
    }
    
    // 4. Verificar problemas específicos de los logs
    console.log('\n4️⃣ VERIFICANDO PROBLEMAS DE LOGS...');
    
    // Problema 1: column "gps_timestamp" does not exist en traccar.routes.js
    console.log('🔍 Testing consulta problemática de traccar.routes.js...');
    try {
      await pool.query(`
        SELECT latitude, longitude, gps_timestamp, battery_level, accuracy
        FROM gps_locations 
        WHERE user_id = 1
        ORDER BY gps_timestamp DESC 
        LIMIT 1
      `);
      console.log('   ✅ Consulta traccar.routes.js: OK');
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      if (error.message.includes('gps_timestamp')) {
        console.log('   🔧 Agregando columna gps_timestamp...');
        await pool.query(`ALTER TABLE gps_locations ADD COLUMN gps_timestamp TIMESTAMP DEFAULT NOW()`);
        console.log('   ✅ Columna gps_timestamp agregada');
      }
    }
    
    // Problema 2: column "velocity" of relation "gps_locations" does not exist
    console.log('\n🔍 Testing insert problemático de traccar.routes.js...');
    try {
      await pool.query(`
        INSERT INTO gps_locations (
          user_id, latitude, longitude, accuracy, 
          battery_level, timestamp, protocol, velocity, gps_timestamp
        ) VALUES (1, 19.4, -99.1, 5, 100, NOW(), 'test', 0, NOW())
        RETURNING id
      `);
      console.log('   ✅ Insert con velocity y gps_timestamp: OK');
      
      // Eliminar el registro de prueba
      await pool.query(`DELETE FROM gps_locations WHERE protocol = 'test' AND latitude = 19.4`);
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      
      if (error.message.includes('velocity')) {
        console.log('   🔧 Agregando columna velocity...');
        await pool.query(`ALTER TABLE gps_locations ADD COLUMN velocity NUMERIC DEFAULT 0`);
        console.log('   ✅ Columna velocity agregada');
      }
      
      if (error.message.includes('gps_timestamp')) {
        console.log('   🔧 Agregando columna gps_timestamp...');
        await pool.query(`ALTER TABLE gps_locations ADD COLUMN gps_timestamp TIMESTAMP DEFAULT NOW()`);
        console.log('   ✅ Columna gps_timestamp agregada');
      }
    }
    
    // 5. Crear índices para performance
    console.log('\n5️⃣ VERIFICANDO ÍNDICES...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_gps_user_gps_timestamp ON gps_locations(user_id, gps_timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_gps_protocol_timestamp ON gps_locations(protocol, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_gps_created_at ON gps_locations(created_at DESC)'
    ];
    
    for (const index of indexes) {
      try {
        await pool.query(index);
        console.log(`   ✅ Índice verificado`);
      } catch (error) {
        console.log(`   ⚠️ Índice ya existe o error: ${error.message.split('\n')[0]}`);
      }
    }
    
    // 6. Verificación final
    console.log('\n6️⃣ VERIFICACIÓN FINAL...');
    const finalColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gps_locations'
      ORDER BY column_name
    `);
    
    console.log('📋 Estructura final Railway:');
    finalColumns.rows.forEach(col => {
      console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n🎉 ¡BASE DE DATOS RAILWAY ARREGLADA!');
    console.log('✅ Traccar GPS debería funcionar ahora');
    console.log('✅ Endpoints admin deberían cargar');
    console.log('✅ Logs de error deberían desaparecer');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

// Ejecutar el arreglo
fixRailwayDatabase().then(success => {
  if (success) {
    console.log('\n🚀 ¡LISTO! Base de datos Railway corregida');
    console.log('⏰ Railway se reiniciará automáticamente en ~1 minuto');
    console.log('📱 Prueba tu iPhone en 2 minutos: node simple-check-roberto.js');
    console.log('🌐 Dashboards: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/admin.html');
  } else {
    console.log('\n❌ Error corrigiendo base de datos');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Error ejecutando:', error.message);
  process.exit(1);
});