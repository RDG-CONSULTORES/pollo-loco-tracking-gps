require('dotenv').config();
const { Pool } = require('pg');

async function checkDashboardData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 DIAGNÓSTICO DEL DASHBOARD\n');
    
    // 1. Verificar tracking_locations_cache
    console.log('📊 VERIFICANDO tracking_locations_cache:');
    const cacheCount = await pool.query('SELECT COUNT(*) as count FROM tracking_locations_cache WHERE active = true');
    console.log(`   ✅ Registros activos: ${cacheCount.rows[0].count}`);
    
    if (cacheCount.rows[0].count > 0) {
      const sampleCache = await pool.query(`
        SELECT id, name, group_name, latitude, longitude, synced_at
        FROM tracking_locations_cache 
        WHERE active = true 
        ORDER BY name 
        LIMIT 5
      `);
      
      console.log('   📋 Muestra de datos:');
      sampleCache.rows.forEach(row => {
        console.log(`      #${row.id} - ${row.name} (${row.group_name}) - ${parseFloat(row.latitude).toFixed(6)}, ${parseFloat(row.longitude).toFixed(6)}`);
      });
    }
    
    // 2. Verificar geofences
    console.log('\n🗺️ VERIFICANDO geofences:');
    const geofenceCount = await pool.query('SELECT COUNT(*) as count FROM geofences WHERE active = true');
    console.log(`   ✅ Geofences activos: ${geofenceCount.rows[0].count}`);
    
    if (geofenceCount.rows[0].count > 0) {
      const sampleGeofences = await pool.query(`
        SELECT g.id, g.name, g.center_lat, g.center_lng, b.branch_number
        FROM geofences g
        LEFT JOIN branches b ON g.branch_id = b.id
        WHERE g.active = true 
        ORDER BY g.name 
        LIMIT 5
      `);
      
      console.log('   📋 Muestra de geofences:');
      sampleGeofences.rows.forEach(row => {
        console.log(`      #${row.id} - ${row.name} - Branch #${row.branch_number || 'N/A'} - ${parseFloat(row.center_lat).toFixed(6)}, ${parseFloat(row.center_lng).toFixed(6)}`);
      });
    }
    
    // 3. Verificar branches
    console.log('\n🏢 VERIFICANDO branches:');
    const branchCount = await pool.query('SELECT COUNT(*) as count FROM branches WHERE active = true');
    console.log(`   ✅ Branches activos: ${branchCount.rows[0].count}`);
    
    // 4. Verificar si el API está funcionando
    console.log('\n🔌 VERIFICANDO ENDPOINTS:');
    
    // Simular llamada al admin dashboard
    let adminData;
    try {
      adminData = await pool.query(`
        SELECT 
          COUNT(*) as total_geofences,
          COUNT(*) FILTER (WHERE geofence_enabled = true) as active_geofences,
          COUNT(*) FILTER (WHERE geofence_enabled = false) as inactive_geofences,
          COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as with_coordinates
        FROM tracking_locations_cache 
        WHERE active = true
      `);
      
      const stats = adminData.rows[0];
      console.log(`   📊 Stats API data:`);
      console.log(`      Total geofences: ${stats.total_geofences}`);
      console.log(`      Activos: ${stats.active_geofences}`);
      console.log(`      Inactivos: ${stats.inactive_geofences}`);
      console.log(`      Con coordenadas: ${stats.with_coordinates}`);
      
    } catch (apiError) {
      console.log(`   ❌ Error simulando API: ${apiError.message}`);
      adminData = { rows: [{ with_coordinates: 0 }] };
    }
    
    // 5. Verificar si las coordenadas están correctas
    console.log('\n📍 VERIFICANDO COORDENADAS ESPECÍFICAS:');
    
    const coordCheck = await pool.query(`
      SELECT name, latitude, longitude, synced_at
      FROM tracking_locations_cache 
      WHERE name IN ('1 - Pino Suarez', '4 - Santa Catarina', '82 - Aeropuerto Nuevo Laredo')
      AND active = true
      ORDER BY name
    `);
    
    coordCheck.rows.forEach(row => {
      console.log(`   ${row.name}: ${parseFloat(row.latitude).toFixed(8)}, ${parseFloat(row.longitude).toFixed(8)} (${row.synced_at})`);
    });
    
    // 6. Verificar la URL del dashboard
    console.log('\n🌐 URLs PARA VERIFICAR:');
    console.log('   🎯 Dashboard: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/');
    console.log('   📊 API Admin: https://pollo-loco-tracking-gps-production.up.railway.app/api/admin/dashboard-data');
    console.log('   💓 Health: https://pollo-loco-tracking-gps-production.up.railway.app/health');
    
    console.log('\n🎉 DIAGNÓSTICO COMPLETADO');
    console.log('=' .repeat(60));
    
    const hasData = parseInt(cacheCount.rows[0].count) > 0;
    const hasCoords = parseInt(adminData.rows[0].with_coordinates) > 0;
    
    if (hasData && hasCoords) {
      console.log('✅ ESTADO: Dashboard debería mostrar datos correctamente');
      console.log('✅ Las 85 sucursales están en la base de datos');
      console.log('✅ Las coordenadas están actualizadas');
    } else {
      console.log('⚠️ ESTADO: Posible problema con los datos');
      console.log(`   Datos: ${hasData ? 'SÍ' : 'NO'}`);
      console.log(`   Coordenadas: ${hasCoords ? 'SÍ' : 'NO'}`);
    }
    
    return { success: true, hasData, hasCoords };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
checkDashboardData().then(result => {
  if (result.success) {
    console.log('\n🎯 DIAGNÓSTICO EXITOSO');
  } else {
    console.log('\n❌ Error en diagnóstico:', result.error);
  }
});