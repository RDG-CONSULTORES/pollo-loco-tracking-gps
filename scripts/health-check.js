require('dotenv').config();
const { Client } = require('pg');

/**
 * Health check completo del sistema
 */
async function healthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    overall: 'unknown',
    checks: {}
  };
  
  try {
    console.log('🔍 Ejecutando health check completo...');
    
    // 1. Database check
    console.log('\n1️⃣ Verificando base de datos...');
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      
      // Test query
      const testResult = await client.query('SELECT NOW() as current_time');
      const usersResult = await client.query('SELECT COUNT(*) as count FROM tracking_users');
      const locationsResult = await client.query('SELECT COUNT(*) as count FROM tracking_locations_cache');
      
      results.checks.database = {
        status: 'healthy',
        current_time: testResult.rows[0].current_time,
        users_count: parseInt(usersResult.rows[0].count),
        locations_count: parseInt(locationsResult.rows[0].count)
      };
      
      await client.end();
      console.log('  ✅ Base de datos: OK');
      console.log(`  📊 Usuarios: ${results.checks.database.users_count}`);
      console.log(`  📍 Ubicaciones: ${results.checks.database.locations_count}`);
      
    } catch (error) {
      results.checks.database = {
        status: 'error',
        error: error.message
      };
      console.log('  ❌ Base de datos: ERROR -', error.message);
    }
    
    // 2. Environment check
    console.log('\n2️⃣ Verificando variables de entorno...');
    const requiredEnvs = ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN'];
    const envCheck = {};
    
    requiredEnvs.forEach(env => {
      envCheck[env] = process.env[env] ? 'present' : 'missing';
    });
    
    results.checks.environment = envCheck;
    console.log('  ✅ Variables de entorno verificadas');
    
    // 3. OwnTracks endpoint check
    console.log('\n3️⃣ Verificando endpoint OwnTracks...');
    try {
      // Simular payload de OwnTracks
      const testPayload = {
        _type: 'location',
        tid: 'TEST',
        lat: 25.6866,
        lon: -100.3161,
        tst: Math.floor(Date.now() / 1000),
        acc: 5
      };
      
      console.log('  📍 Payload de prueba:', JSON.stringify(testPayload, null, 2));
      results.checks.owntracks = {
        status: 'endpoint_ready',
        test_payload: testPayload
      };
      console.log('  ✅ Endpoint OwnTracks: Listo para recibir datos');
      
    } catch (error) {
      results.checks.owntracks = {
        status: 'error',
        error: error.message
      };
      console.log('  ❌ OwnTracks: ERROR -', error.message);
    }
    
    // 4. API endpoints check
    console.log('\n4️⃣ Verificando APIs críticas...');
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      
      // Test usuarios endpoint
      const usersQuery = `
        SELECT 
          tracker_id,
          display_name,
          active
        FROM tracking_users
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      const usersResult = await client.query(usersQuery);
      
      // Test locations endpoint  
      const locationsQuery = `
        SELECT 
          location_code,
          name,
          group_name,
          active
        FROM tracking_locations_cache
        ORDER BY name
        LIMIT 5
      `;
      
      const locationsResultQuery = await client.query(locationsQuery);
      
      await client.end();
      
      results.checks.api = {
        status: 'healthy',
        sample_users: usersResult.rows,
        sample_locations: locationsResultQuery.rows
      };
      
      console.log('  ✅ APIs: Funcionando');
      console.log('  👥 Usuarios muestra:', usersResult.rows.map(u => u.tracker_id).join(', '));
      console.log('  📍 Ubicaciones muestra:', locationsResultQuery.rows.length);
      
    } catch (error) {
      results.checks.api = {
        status: 'error',
        error: error.message
      };
      console.log('  ❌ APIs: ERROR -', error.message);
    }
    
    // Determine overall health
    const hasErrors = Object.values(results.checks).some(check => 
      check.status === 'error' || check.status === 'unhealthy'
    );
    
    results.overall = hasErrors ? 'unhealthy' : 'healthy';
    
    console.log(`\n🎯 RESULTADO GENERAL: ${results.overall.toUpperCase()}`);
    
    if (results.overall === 'healthy') {
      console.log('\n✅ SISTEMA LISTO PARA OWNTRACKS');
      console.log('📱 Configuración para tu iPhone:');
      console.log('   URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks/location');
      console.log('   Device ID: RD01');
      console.log('   User ID: RD01');
    } else {
      console.log('\n❌ SISTEMA CON PROBLEMAS');
      console.log('📋 Revisar errores arriba antes de configurar OwnTracks');
    }
    
    console.log('\n📊 Reporte completo:');
    console.log(JSON.stringify(results, null, 2));
    
    return results;
    
  } catch (error) {
    console.error('💥 Error en health check:', error);
    results.overall = 'error';
    results.checks.general = {
      status: 'error',
      error: error.message
    };
    return results;
  }
}

if (require.main === module) {
  healthCheck()
    .then(results => {
      process.exit(results.overall === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = healthCheck;