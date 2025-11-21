require('dotenv').config();
const { Pool } = require('pg');

/**
 * Test completo del sistema enterprise estabilizado
 * Verifica todos los componentes críticos
 */
async function testSystemComplete() {
  console.log('🧪 TESTING SISTEMA COMPLETO - NIVEL ENTERPRISE\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  let allTests = [];
  
  try {
    // TEST 1: Conexión Database
    console.log('1️⃣ Testing Database Connection...');
    const dbTest = await pool.query('SELECT NOW() as timestamp');
    console.log(`   ✅ Database: Connected (${dbTest.rows[0].timestamp})`);
    allTests.push({ test: 'database', status: 'pass', details: 'Connected successfully' });
    
    // TEST 2: Usuario rd01
    console.log('\n2️⃣ Testing User rd01...');
    const userTest = await pool.query(`
      SELECT tracker_id, display_name, role, active 
      FROM tracking_users 
      WHERE tracker_id = 'rd01'
    `);
    if (userTest.rows.length > 0) {
      const user = userTest.rows[0];
      console.log(`   ✅ Usuario: ${user.display_name} (${user.role})`);
      console.log(`   📱 Tracker: ${user.tracker_id} | Active: ${user.active}`);
      allTests.push({ test: 'user_rd01', status: 'pass', details: user });
    } else {
      console.log('   ❌ Usuario rd01 no encontrado');
      allTests.push({ test: 'user_rd01', status: 'fail', details: 'User not found' });
    }
    
    // TEST 3: Oficina Roberto
    console.log('\n3️⃣ Testing Roberto Office Geofence...');
    const officeTest = await pool.query(`
      SELECT * FROM tracking_locations_cache 
      WHERE location_code = 'ROBERTO_OFFICE'
    `);
    if (officeTest.rows.length > 0) {
      const office = officeTest.rows[0];
      console.log(`   ✅ Oficina: ${office.name}`);
      console.log(`   📍 Ubicación: ${office.latitude}, ${office.longitude}`);
      console.log(`   🎯 Radio: ${office.geofence_radius}m | Enabled: ${office.geofence_enabled}`);
      allTests.push({ test: 'roberto_office', status: 'pass', details: office });
    } else {
      console.log('   ❌ Oficina Roberto no encontrada');
      allTests.push({ test: 'roberto_office', status: 'fail', details: 'Office not found' });
    }
    
    // TEST 4: Sistema Config
    console.log('\n4️⃣ Testing System Configuration...');
    const configTest = await pool.query(`
      SELECT key, value FROM tracking_config 
      WHERE key = 'system_active'
    `);
    if (configTest.rows.length > 0 && configTest.rows[0].value === 'true') {
      console.log('   ✅ Sistema: Activo');
      allTests.push({ test: 'system_config', status: 'pass', details: 'System active' });
    } else {
      console.log('   ⚠️ Sistema: No configurado o inactivo');
      allTests.push({ test: 'system_config', status: 'warning', details: 'System not active' });
    }
    
    // TEST 5: Tables Structure
    console.log('\n5️⃣ Testing Critical Tables...');
    const tables = ['tracking_users', 'tracking_locations_cache', 'geofence_events', 'gps_locations'];
    for (const table of tables) {
      try {
        const tableTest = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${tableTest.rows[0].count} records`);
        allTests.push({ test: `table_${table}`, status: 'pass', details: `${tableTest.rows[0].count} records` });
      } catch (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
        allTests.push({ test: `table_${table}`, status: 'fail', details: error.message });
      }
    }
    
    // TEST 6: Railway Health
    console.log('\n6️⃣ Testing Railway Health Endpoint...');
    try {
      const healthResponse = await fetch('https://pollo-loco-tracking-gps-production.up.railway.app/health');
      const healthData = await healthResponse.json();
      console.log(`   ✅ Health: ${healthData.status} | Version: ${healthData.version}`);
      console.log(`   📊 Memory: ${healthData.memory.used}MB used / ${healthData.memory.total}MB total`);
      console.log(`   ⏱️ Response: ${healthData.response_time_ms}ms`);
      allTests.push({ test: 'railway_health', status: 'pass', details: healthData });
    } catch (error) {
      console.log(`   ❌ Health endpoint: ${error.message}`);
      allTests.push({ test: 'railway_health', status: 'fail', details: error.message });
    }
    
    // SUMMARY
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE TESTING');
    console.log('='.repeat(50));
    
    const passed = allTests.filter(t => t.status === 'pass').length;
    const failed = allTests.filter(t => t.status === 'fail').length;
    const warnings = allTests.filter(t => t.status === 'warning').length;
    
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`⚠️ WARNINGS: ${warnings}`);
    console.log(`📈 SUCCESS RATE: ${Math.round((passed / allTests.length) * 100)}%`);
    
    if (failed === 0 && warnings <= 1) {
      console.log('\n🎉 SISTEMA ENTERPRISE ESTABILIZADO Y LISTO');
      console.log('🚀 Ready for production testing');
      console.log('📱 Roberto puede iniciar testing de alerts');
    } else {
      console.log('\n⚠️ Sistema needs attention:');
      allTests.filter(t => t.status !== 'pass').forEach(test => {
        console.log(`   - ${test.test}: ${test.details}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en testing completo:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Testing completed');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testSystemComplete();
}

module.exports = { testSystemComplete };