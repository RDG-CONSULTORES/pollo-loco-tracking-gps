/**
 * Test script para verificar los 3 endpoints críticos reparados
 */

async function testFixedEndpoints() {
  console.log('🔧 TESTING ENDPOINTS CRÍTICOS REPARADOS\n');
  
  const baseUrl = 'https://pollo-loco-tracking-gps-production.up.railway.app';
  
  console.log('🎯 Probando 3 endpoints reparados...\n');
  
  // 1. Admin Dashboard Data (movido de /api/admin a /api/dashboard)
  console.log('1️⃣ TEST: Admin Dashboard Data');
  try {
    const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/dashboard-data`);
    console.log(`   Status: ${dashboardResponse.status}`);
    
    if (dashboardResponse.ok) {
      const data = await dashboardResponse.json();
      console.log('   ✅ Admin Dashboard FUNCIONANDO');
      console.log(`   📊 Users: ${data.data?.users?.overview?.total_users || 0}`);
      console.log(`   📍 Geofences: ${data.data?.geofences?.overview?.total_geofences || 0}`);
    } else {
      const error = await dashboardResponse.text();
      console.log(`   ❌ Error: ${error.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Error de conexión: ${error.message}`);
  }
  
  // 2. Directors List (sin autenticación)
  console.log('\n2️⃣ TEST: Directors List');
  try {
    const directorsResponse = await fetch(`${baseUrl}/api/directors/list`);
    console.log(`   Status: ${directorsResponse.status}`);
    
    if (directorsResponse.ok) {
      const data = await directorsResponse.json();
      console.log('   ✅ Directors API FUNCIONANDO');
      console.log(`   👥 Directores encontrados: ${Array.isArray(data) ? data.length : 'N/A'}`);
    } else {
      const error = await directorsResponse.text();
      console.log(`   ❌ Error: ${error.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Error de conexión: ${error.message}`);
  }
  
  // 3. Users List (nuevo endpoint)
  console.log('\n3️⃣ TEST: Users List');
  try {
    const usersResponse = await fetch(`${baseUrl}/api/users/list`);
    console.log(`   Status: ${usersResponse.status}`);
    
    if (usersResponse.ok) {
      const data = await usersResponse.json();
      console.log('   ✅ Users List FUNCIONANDO');
      console.log(`   📋 Tracking Users: ${data.data?.stats?.total_tracking_users || 0}`);
      console.log(`   🔧 Admin Users: ${data.data?.stats?.total_admin_users || 0}`);
    } else {
      const error = await usersResponse.text();
      console.log(`   ❌ Error: ${error.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`   ❌ Error de conexión: ${error.message}`);
  }
  
  console.log('\n📊 RESUMEN DE REPARACIONES:');
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│ ENDPOINT CRÍTICO                   STATUS   │');
  console.log('├─────────────────────────────────────────────┤');
  console.log('│ /api/dashboard/dashboard-data      Reparado │');
  console.log('│ /api/directors/list                Reparado │');
  console.log('│ /api/users/list                    Añadido  │');
  console.log('└─────────────────────────────────────────────┘');
  
  console.log('\n🎯 PRÓXIMOS PASOS:');
  console.log('1. Verificar que Railway ha deployado los cambios');
  console.log('2. Probar dashboard admin en navegador');
  console.log('3. Verificar que los 3 endpoints respondan correctamente');
  
  console.log('\n🔗 URLs PARA PROBAR:');
  console.log(`📊 Dashboard: ${baseUrl}/webapp/admin.html`);
  console.log(`📱 Mobile: ${baseUrl}/webapp/admin-mobile.html`);
  console.log(`👥 Users: ${baseUrl}/webapp/unified-user-panel.html`);
}

testFixedEndpoints().catch(console.error);