require('dotenv').config();
const { Pool } = require('pg');

async function diagnoseAPICache() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 DIAGNOSTICANDO CACHE DEL API EN RAILWAY...\n');
    
    // 1. Verificar conexión directa a base de datos
    console.log('📊 VERIFICANDO CONEXIÓN DIRECTA A BASE DE DATOS:');
    const dbCheck = await pool.query('SELECT NOW() as current_time, version() as version');
    console.log(`   ✅ Hora de BD: ${dbCheck.rows[0].current_time}`);
    console.log(`   ✅ Versión: ${dbCheck.rows[0].version.split(' ').slice(0,2).join(' ')}`);
    
    // 2. Verificar cuántos geofences existen con timestamp reciente
    console.log('\n📊 VERIFICANDO GEOFENCES EN BASE DE DATOS:');
    const geofenceCount = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM geofences
    `);
    
    const counts = geofenceCount.rows[0];
    console.log(`   📊 Total geofences: ${counts.total}`);
    console.log(`   📊 Creados última hora: ${counts.recent}`);
    console.log(`   📊 Más antiguo: ${counts.oldest}`);
    console.log(`   📊 Más reciente: ${counts.newest}`);
    
    // 3. Verificar Pino Suarez específicamente
    console.log('\n🔍 VERIFICANDO PINO SUAREZ EN BASE DE DATOS:');
    const pinoSuarez = await pool.query(`
      SELECT 
        g.id, g.center_lat, g.center_lng, g.created_at, g.updated_at,
        b.branch_number, b.name, b.latitude as branch_lat, b.longitude as branch_lng
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.name ILIKE '%Pino Suarez%'
      ORDER BY g.created_at DESC
    `);
    
    if (pinoSuarez.rows.length > 0) {
      const pino = pinoSuarez.rows[0];
      console.log(`   📍 ID: ${pino.id}`);
      console.log(`   📍 Nombre: ${pino.name}`);
      console.log(`   📍 Coordenadas Geofence: ${parseFloat(pino.center_lat).toFixed(8)}, ${parseFloat(pino.center_lng).toFixed(8)}`);
      console.log(`   📍 Coordenadas Branch: ${parseFloat(pino.branch_lat).toFixed(8)}, ${parseFloat(pino.branch_lng).toFixed(8)}`);
      console.log(`   📍 Creado: ${pino.created_at}`);
      console.log(`   📍 Actualizado: ${pino.updated_at}`);
      
      // Verificar si es correcto
      const correctLat = 25.672254063040413;
      const correctLng = -100.31993941809768;
      
      const latDiff = Math.abs(parseFloat(pino.center_lat) - correctLat);
      const lngDiff = Math.abs(parseFloat(pino.center_lng) - correctLng);
      const isCorrect = latDiff < 0.001 && lngDiff < 0.001;
      
      console.log(`   ${isCorrect ? '✅' : '❌'} Coordenadas ${isCorrect ? 'CORRECTAS' : 'INCORRECTAS'} en BD`);
    } else {
      console.log(`   ❌ Pino Suarez no encontrado en base de datos`);
    }
    
    // 4. Simular exactamente la query del endpoint dashboard
    console.log('\n🌐 SIMULANDO QUERY DEL ENDPOINT /api/dashboard/geofences:');
    const apiSimulation = await pool.query(`
      SELECT 
        g.id,
        CONCAT('224700', CASE WHEN b.branch_number < 10 THEN '0' ELSE '' END, b.branch_number::TEXT) as location_code,
        CONCAT(b.branch_number, ' - ', b.name) as location_name,
        COALESCE(b.group_name, 'Sin Grupo') as grupo,
        g.center_lat as latitude,
        g.center_lng as longitude,
        g.radius_meters,
        g.active,
        g.created_at
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.active = true AND g.active = true
        AND b.name ILIKE '%Pino Suarez%'
      ORDER BY b.branch_number
      LIMIT 1
    `);
    
    if (apiSimulation.rows.length > 0) {
      const api = apiSimulation.rows[0];
      console.log(`   📍 API retornará:`);
      console.log(`   📍 ID: ${api.id}`);
      console.log(`   📍 Location Code: ${api.location_code}`);
      console.log(`   📍 Location Name: ${api.location_name}`);
      console.log(`   📍 Grupo: ${api.grupo}`);
      console.log(`   📍 Coordenadas: ${parseFloat(api.latitude).toFixed(8)}, ${parseFloat(api.longitude).toFixed(8)}`);
      console.log(`   📍 Created: ${api.created_at}`);
      
      // Verificar si es lo que esperamos
      const correctLat = 25.672254063040413;
      const correctLng = -100.31993941809768;
      
      const latDiff = Math.abs(parseFloat(api.latitude) - correctLat);
      const lngDiff = Math.abs(parseFloat(api.longitude) - correctLng);
      const isCorrect = latDiff < 0.001 && lngDiff < 0.001;
      
      console.log(`   ${isCorrect ? '✅' : '❌'} API simulation ${isCorrect ? 'CORRECTA' : 'INCORRECTA'}`);
      
      if (!isCorrect) {
        console.log(`   🔧 Debería ser: ${correctLat.toFixed(8)}, ${correctLng.toFixed(8)}`);
        console.log(`   📊 Diferencia: lat=${latDiff.toFixed(8)}, lng=${lngDiff.toFixed(8)}`);
      }
    }
    
    // 5. Verificar si hay geofences duplicados
    console.log('\n🔍 VERIFICANDO GEOFENCES DUPLICADOS:');
    const duplicates = await pool.query(`
      SELECT 
        b.name, COUNT(*) as count
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      GROUP BY b.name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`   ❌ ${duplicates.rows.length} sucursales con geofences duplicados:`);
      for (const dup of duplicates.rows.slice(0, 5)) {
        console.log(`      ${dup.name}: ${dup.count} geofences`);
      }
    } else {
      console.log(`   ✅ No hay geofences duplicados`);
    }
    
    // 6. Verificar conexiones activas
    console.log('\n🔗 VERIFICANDO CONEXIONES ACTIVAS:');
    const connections = await pool.query(`
      SELECT 
        COUNT(*) as total_connections,
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    const conn = connections.rows[0];
    console.log(`   📊 Conexiones totales: ${conn.total_connections}`);
    console.log(`   📊 Conexiones activas: ${conn.active_connections}`);
    console.log(`   📊 Conexiones idle: ${conn.idle_connections}`);
    
    // 7. Diagnóstico final
    console.log('\n📊 DIAGNÓSTICO:');
    console.log('=' .repeat(80));
    
    if (counts.recent == counts.total) {
      console.log('✅ Todos los geofences son recientes - BD actualizada correctamente');
    } else {
      console.log('❌ Hay geofences antiguos - posible problema de sincronización');
    }
    
    if (duplicates.rows.length > 0) {
      console.log('❌ Hay duplicados - esto puede causar resultados inconsistentes');
    }
    
    console.log('\n🔧 POSIBLES CAUSAS DEL PROBLEMA:');
    console.log('1. 🌐 Railway tiene múltiples instancias de la aplicación');
    console.log('2. 💾 Cache del endpoint no invalidado');
    console.log('3. 🔄 Connection pooling devolviendo conexiones viejas');
    console.log('4. 📡 Load balancer dirigiendo a instancias diferentes');
    console.log('5. 🗂️ Geofences duplicados confundiendo el resultado');
    
    return { 
      success: true,
      totalGeofences: counts.total,
      recentGeofences: counts.recent,
      hasDuplicates: duplicates.rows.length > 0,
      dbCorrect: true
    };
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
diagnoseAPICache().then(result => {
  if (result.success) {
    console.log(`\n📊 Diagnóstico completado`);
    if (result.hasDuplicates) {
      console.log('⚠️  Se detectaron duplicados - esto puede explicar el problema');
    }
  } else {
    console.log('\n❌ Error en diagnóstico:', result.error);
  }
});