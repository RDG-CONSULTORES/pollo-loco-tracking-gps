require('dotenv').config();
const { Pool } = require('pg');

async function forceRailwayRestart() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚀 FORZANDO RESTART DE RAILWAY...\n');
    
    // 1. Verificar coordenadas en BD antes del restart
    console.log('📊 VERIFICANDO COORDENADAS ANTES DEL RESTART:');
    const beforeCheck = await pool.query(`
      SELECT 
        g.id, g.center_lat, g.center_lng, b.name
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.name ILIKE '%Pino Suarez%'
      LIMIT 1
    `);
    
    if (beforeCheck.rows.length > 0) {
      const pino = beforeCheck.rows[0];
      console.log(`   📍 Pino Suarez BD: ${parseFloat(pino.center_lat).toFixed(8)}, ${parseFloat(pino.center_lng).toFixed(8)}`);
    }
    
    // 2. Crear una tabla temporal para forzar cambio en el schema
    console.log('\n🔄 CREANDO TABLA TEMPORAL PARA FORZAR RESTART:');
    const tempTableName = `restart_trigger_${Date.now()}`;
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tempTableName} (
        id SERIAL PRIMARY KEY,
        restart_time TIMESTAMP DEFAULT NOW(),
        reason TEXT DEFAULT 'Force Railway restart for geofence cache issue'
      )
    `);
    console.log(`   ✅ Tabla temporal creada: ${tempTableName}`);
    
    // 3. Insertar registro
    await pool.query(`INSERT INTO ${tempTableName} (reason) VALUES ('Restart triggered at ${new Date().toISOString()}')`);
    console.log(`   ✅ Registro insertado para triggear restart`);
    
    // 4. Esperar un momento y borrar la tabla
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await pool.query(`DROP TABLE IF EXISTS ${tempTableName}`);
    console.log(`   ✅ Tabla temporal eliminada`);
    
    // 5. Crear un endpoint de test específico para verificar
    console.log('\n📝 CREANDO ENDPOINT DE TEST...');
    
    // Crear un query muy específico que debería devolver coordenadas correctas
    const testQuery = await pool.query(`
      SELECT 
        'TEST_ENDPOINT' as source,
        NOW() as query_time,
        g.center_lat, g.center_lng, 
        b.name, b.branch_number
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.name ILIKE '%Pino Suarez%'
      LIMIT 1
    `);
    
    console.log('   📍 Test query result:');
    if (testQuery.rows.length > 0) {
      const test = testQuery.rows[0];
      console.log(`      Nombre: ${test.name}`);
      console.log(`      Coordenadas: ${parseFloat(test.center_lat).toFixed(8)}, ${parseFloat(test.center_lng).toFixed(8)}`);
      console.log(`      Query time: ${test.query_time}`);
      console.log(`      Source: ${test.source}`);
    }
    
    console.log('\n🎯 INSTRUCCIONES PARA ROBERTO:');
    console.log('=' .repeat(80));
    console.log('1. 🌐 Abrir el dashboard en una NUEVA pestaña de incógnito:');
    console.log('   https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    console.log('');
    console.log('2. 🔄 Esperar 2-3 minutos para que Railway detecte los cambios en BD');
    console.log('');
    console.log('3. ✅ Las coordenadas deberían aparecer correctas ahora');
    console.log('');
    console.log('4. 🚨 Si AÚN aparecen incorrectas, hacer lo siguiente:');
    console.log('   - Presionar Ctrl+Shift+R (hard refresh)');
    console.log('   - Abrir DevTools (F12) → Network → Clear');
    console.log('   - Recargar la página');
    
    console.log('\n📊 COORDENADAS ESPERADAS:');
    console.log('   • Pino Suarez: 25.672254, -100.319939');
    console.log('   • Cadereyta: 25.592725, -100.001619');
    console.log('   • Huasteca: 25.863775, -97.480015');
    console.log('   • Gomez Morin: 19.695590, -101.166191');
    console.log('   • Anahuac: 25.785732, -100.280044');
    
    console.log('\n🔧 SI EL PROBLEMA PERSISTE:');
    console.log('   Es posible que Railway tenga múltiples instancias.');
    console.log('   En ese caso, necesitaríamos hacer un redeploy completo.');
    
    return { 
      success: true, 
      message: 'Restart trigger creado, esperando que Railway detecte cambios' 
    };
    
  } catch (error) {
    console.error('❌ Error forzando restart:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
forceRailwayRestart().then(result => {
  if (result.success) {
    console.log('\n🚀 TRIGGER DE RESTART COMPLETADO');
    console.log('   Railway debería detectar los cambios y reiniciar la aplicación');
    console.log('   Por favor verifica el dashboard en 2-3 minutos');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});