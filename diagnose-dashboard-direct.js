require('dotenv').config();
const { Pool } = require('pg');

async function diagnoseDashboardDirect() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 DIAGNÓSTICO DIRECTO DEL DASHBOARD...\n');
    
    // 1. VERIFICAR QUÉ ENDPOINT USA EL DASHBOARD
    console.log('📄 VERIFICANDO CÓDIGO DEL DASHBOARD:');
    const fs = require('fs');
    
    try {
      const dashboardContent = fs.readFileSync('./src/webapp/dashboard.html', 'utf8');
      const jsContent = fs.readFileSync('./src/webapp/js/dashboard.js', 'utf8');
      
      // Buscar qué endpoint está usando
      const apiCalls = [];
      
      // Buscar en dashboard.html
      const htmlMatches = dashboardContent.match(/fetch\(['"`]([^'"`]*geofences[^'"`]*)/g);
      if (htmlMatches) {
        htmlMatches.forEach(match => {
          apiCalls.push(match.replace(/fetch\(['"`]/, '').replace(/['"`].*/, ''));
        });
      }
      
      // Buscar en dashboard.js
      const jsMatches = jsContent.match(/fetch\(['"`]([^'"`]*geofences[^'"`]*)/g);
      if (jsMatches) {
        jsMatches.forEach(match => {
          apiCalls.push(match.replace(/fetch\(['"`]/, '').replace(/['"`].*/, ''));
        });
      }
      
      // Buscar loadRealGeofences específicamente
      if (jsContent.includes('/api/dashboard/geofences')) {
        apiCalls.push('/api/dashboard/geofences');
      }
      if (jsContent.includes('/api/admin/geofences')) {
        apiCalls.push('/api/admin/geofences');
      }
      
      console.log(`   📡 Endpoints encontrados en el código:`);
      const uniqueApis = [...new Set(apiCalls)];
      uniqueApis.forEach(api => {
        console.log(`      ${api}`);
      });
      
    } catch (error) {
      console.log(`   ❌ Error leyendo archivos: ${error.message}`);
    }
    
    // 2. VERIFICAR EL ENDPOINT /api/dashboard/geofences
    console.log('\n📡 VERIFICANDO ENDPOINT /api/dashboard/geofences:');
    
    try {
      const dashboardRoutes = fs.readFileSync('./src/api/routes/dashboard.routes.js', 'utf8');
      
      // Buscar la definición del endpoint geofences
      const lines = dashboardRoutes.split('\n');
      let foundGeofencesEndpoint = false;
      let queryLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('geofences') && (line.includes('get') || line.includes('GET'))) {
          foundGeofencesEndpoint = true;
          console.log(`   ✅ Endpoint encontrado en línea ${i + 1}`);
        }
        
        if (foundGeofencesEndpoint && line.includes('SELECT')) {
          // Capturar la query completa
          let j = i;
          while (j < lines.length && !lines[j].includes('`;')) {
            queryLines.push(lines[j].trim());
            j++;
          }
          if (j < lines.length) {
            queryLines.push(lines[j].trim());
          }
          break;
        }
      }
      
      if (queryLines.length > 0) {
        console.log(`   📄 Query del endpoint:`);
        queryLines.forEach(line => {
          console.log(`      ${line}`);
        });
      } else {
        console.log(`   ❌ No se encontró la query del endpoint`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error leyendo dashboard routes: ${error.message}`);
    }
    
    // 3. EJECUTAR LA MISMA QUERY QUE EL DASHBOARD
    console.log('\n🔄 EJECUTANDO QUERY COMO EL DASHBOARD:');
    
    const dashboardQuery = await pool.query(`
      SELECT 
        g.id,
        g.name as location_name,
        g.center_lat as latitude,
        g.center_lng as longitude,
        g.radius_meters,
        g.active,
        g.created_at,
        b.branch_number,
        b.group_name as grupo
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE g.active = true AND b.active = true
      ORDER BY b.branch_number
      LIMIT 5
    `);
    
    console.log(`   📊 Resultados (primeras 5):`);
    dashboardQuery.rows.forEach(row => {
      console.log(`      #${row.branch_number} - ${row.location_name}: ${parseFloat(row.latitude).toFixed(8)}, ${parseFloat(row.longitude).toFixed(8)}`);
    });
    
    // 4. VERIFICAR ESPECÍFICAMENTE PINO SUAREZ
    console.log('\n🎯 VERIFICANDO PINO SUAREZ ESPECÍFICAMENTE:');
    
    const pinoQueries = [
      {
        name: 'Branches table',
        query: `SELECT branch_number, name, latitude, longitude, updated_at FROM branches WHERE name ILIKE '%Pino Suarez%'`
      },
      {
        name: 'Geofences table', 
        query: `SELECT g.id, g.name, g.center_lat, g.center_lng, g.updated_at, b.branch_number FROM geofences g JOIN branches b ON g.branch_id = b.id WHERE b.name ILIKE '%Pino Suarez%'`
      },
      {
        name: 'Dashboard query simulation',
        query: `SELECT g.id, g.name as location_name, g.center_lat as latitude, g.center_lng as longitude, g.created_at, b.branch_number FROM geofences g JOIN branches b ON g.branch_id = b.id WHERE g.active = true AND b.active = true AND b.name ILIKE '%Pino Suarez%'`
      }
    ];
    
    for (const queryInfo of pinoQueries) {
      try {
        const result = await pool.query(queryInfo.query);
        console.log(`\n   📄 ${queryInfo.name}:`);
        if (result.rows.length > 0) {
          result.rows.forEach(row => {
            if (row.latitude && row.longitude) {
              console.log(`      Coordenadas: ${parseFloat(row.latitude).toFixed(8)}, ${parseFloat(row.longitude).toFixed(8)}`);
            } else if (row.center_lat && row.center_lng) {
              console.log(`      Coordenadas: ${parseFloat(row.center_lat).toFixed(8)}, ${parseFloat(row.center_lng).toFixed(8)}`);
            }
            if (row.updated_at || row.created_at) {
              console.log(`      Timestamp: ${row.updated_at || row.created_at}`);
            }
            if (row.id) {
              console.log(`      ID: ${row.id}`);
            }
          });
        } else {
          console.log(`      ❌ Sin resultados`);
        }
      } catch (queryError) {
        console.log(`      ❌ Error: ${queryError.message}`);
      }
    }
    
    // 5. VERIFICAR SI HAY PROBLEMAS DE PRECISIÓN
    console.log('\n🔍 VERIFICANDO PRECISIÓN DE COORDENADAS:');
    
    const expectedPino = {
      lat: 25.672254063040413,
      lng: -100.31993941809768
    };
    
    const precisionTest = await pool.query(`
      SELECT 
        branch_number, name,
        latitude::DECIMAL(15,12) as lat_precise,
        longitude::DECIMAL(15,12) as lng_precise,
        g.center_lat::DECIMAL(15,12) as geofence_lat_precise,
        g.center_lng::DECIMAL(15,12) as geofence_lng_precise
      FROM branches b
      LEFT JOIN geofences g ON g.branch_id = b.id
      WHERE b.name ILIKE '%Pino Suarez%'
    `);
    
    if (precisionTest.rows.length > 0) {
      const row = precisionTest.rows[0];
      console.log(`   📍 Branch precisión: ${row.lat_precise}, ${row.lng_precise}`);
      console.log(`   📍 Geofence precisión: ${row.geofence_lat_precise}, ${row.geofence_lng_precise}`);
      console.log(`   📍 Esperado del CSV: ${expectedPino.lat}, ${expectedPino.lng}`);
      
      const latDiff = Math.abs(parseFloat(row.lat_precise) - expectedPino.lat);
      const lngDiff = Math.abs(parseFloat(row.lng_precise) - expectedPino.lng);
      
      console.log(`   📊 Diferencia: lat=${latDiff.toFixed(12)}, lng=${lngDiff.toFixed(12)}`);
      console.log(`   ${latDiff < 0.001 && lngDiff < 0.001 ? '✅' : '❌'} Coordenadas ${latDiff < 0.001 && lngDiff < 0.001 ? 'CORRECTAS' : 'INCORRECTAS'}`);
    }
    
    // 6. PROBLEMA IDENTIFICADO
    console.log('\n🚨 DIAGNÓSTICO FINAL:');
    console.log('=' .repeat(80));
    
    console.log('El problema puede ser:');
    console.log('1. 📡 El dashboard usa un endpoint específico que no hemos identificado');
    console.log('2. 🔄 Hay cache del lado de Railway que no se está limpiando');
    console.log('3. 📄 El dashboard.js tiene hardcoded otro endpoint');
    console.log('4. 🗂️ La tabla que usa el dashboard NO es la que estamos actualizando');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar diagnóstico
diagnoseDashboardDirect().then(result => {
  if (result.success) {
    console.log('\n🔍 DIAGNÓSTICO COMPLETADO');
    console.log('Ahora sabemos exactamente qué está pasando');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});