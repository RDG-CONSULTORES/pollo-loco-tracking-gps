require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function verifyDashboardCoordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO COORDENADAS PROBLEMÁTICAS EN DASHBOARD...\n');
    
    // Sucursales específicas que Roberto mencionó
    const problematicBranches = [
      'Pino Suarez',
      'Cadereyta', 
      'Huasteca',
      'Gomez Morin',
      'Anahuac'
    ];
    
    // 1. Leer CSV normalizado
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log('📊 LEYENDO CSV NORMALIZADO...');
    
    // Crear mapa de coordenadas del CSV
    const csvCoords = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const csvRegex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
      const parts = line.split(csvRegex);
      if (parts.length < 7) continue;
      
      const csvNum = parseInt(parts[1]);
      const csvName = parts[2];
      let csvCoordsStr = parts[6];
      
      if (!csvCoordsStr || csvCoordsStr.trim() === '' || csvCoordsStr.trim() === '""') continue;
      csvCoordsStr = csvCoordsStr.replace(/^"|"$/g, '').trim();
      
      const coordParts = csvCoordsStr.split(',');
      if (coordParts.length === 2) {
        const csvLat = parseFloat(coordParts[0].trim());
        const csvLng = parseFloat(coordParts[1].trim());
        
        if (!isNaN(csvLat) && !isNaN(csvLng)) {
          csvCoords[csvNum] = {
            name: csvName,
            lat: csvLat,
            lng: csvLng
          };
        }
      }
    }
    
    console.log(`   ✅ ${Object.keys(csvCoords).length} coordenadas leídas del CSV\n`);
    
    // 2. Verificar cada sucursal problemática
    console.log('🚨 VERIFICACIÓN DE SUCURSALES PROBLEMÁTICAS:');
    console.log('=' .repeat(100));
    
    let totalIssues = 0;
    
    for (const branchName of problematicBranches) {
      console.log(`\n🔍 VERIFICANDO: ${branchName.toUpperCase()}`);
      console.log('-' .repeat(60));
      
      // Buscar en base de datos
      const dbResults = await pool.query(`
        SELECT branch_number, name, latitude, longitude, city, state, group_name
        FROM branches 
        WHERE active = true AND name ILIKE $1
        ORDER BY branch_number
      `, [`%${branchName}%`]);
      
      if (dbResults.rows.length === 0) {
        console.log(`   ❌ No encontrada en base de datos`);
        totalIssues++;
        continue;
      }
      
      for (const branch of dbResults.rows) {
        const csvData = csvCoords[branch.branch_number];
        
        console.log(`\n📍 #${branch.branch_number} - ${branch.name}`);
        console.log(`   🏙️ ${branch.city}, ${branch.state} | Grupo: ${branch.group_name}`);
        
        if (csvData) {
          const dbLat = parseFloat(branch.latitude);
          const dbLng = parseFloat(branch.longitude);
          
          console.log(`   📊 CSV:  ${csvData.lat.toFixed(12)}, ${csvData.lng.toFixed(12)}`);
          console.log(`   📊 DB:   ${dbLat.toFixed(12)}, ${dbLng.toFixed(12)}`);
          
          const latDiff = Math.abs(dbLat - csvData.lat);
          const lngDiff = Math.abs(dbLng - csvData.lng);
          const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
          
          console.log(`   📊 Diferencia: lat=${latDiff.toFixed(15)}, lng=${lngDiff.toFixed(15)}`);
          console.log(`   ${isMatch ? '✅ COINCIDEN' : '❌ NO COINCIDEN'}`);
          
          if (!isMatch) {
            totalIssues++;
            console.log(`   🚨 ¡COORDENADAS INCORRECTAS!`);
            console.log(`   🔧 SQL para corregir:`);
            console.log(`      UPDATE branches SET latitude = ${csvData.lat}, longitude = ${csvData.lng} WHERE branch_number = ${branch.branch_number};`);
          }
        } else {
          console.log(`   ❌ No encontrada en CSV con número ${branch.branch_number}`);
          totalIssues++;
        }
      }
    }
    
    // 3. Verificar las APIs del dashboard
    console.log('\n🌐 VERIFICANDO APIS DEL DASHBOARD:');
    console.log('=' .repeat(100));
    
    // Verificar API de branches
    console.log('\n📡 API de Branches:');
    const apiData = await pool.query(`
      SELECT branch_number, name, latitude, longitude, city, state
      FROM branches 
      WHERE active = true AND name ILIKE ANY($1)
      ORDER BY branch_number
    `, [problematicBranches.map(name => `%${name}%`)]);
    
    console.log(`   📊 ${apiData.rows.length} sucursales encontradas en API`);
    
    for (const branch of apiData.rows) {
      console.log(`   📍 #${branch.branch_number} - ${branch.name}: ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}`);
    }
    
    // Verificar API de geofences
    console.log('\n📡 API de Geofences:');
    const geofenceData = await pool.query(`
      SELECT g.name, g.center_lat, g.center_lng, b.branch_number
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.active = true AND b.name ILIKE ANY($1)
      ORDER BY b.branch_number
    `, [problematicBranches.map(name => `%${name}%`)]);
    
    console.log(`   📊 ${geofenceData.rows.length} geofences encontrados en API`);
    
    for (const geofence of geofenceData.rows) {
      console.log(`   📍 #${geofence.branch_number} - ${geofence.name}: ${parseFloat(geofence.center_lat).toFixed(6)}, ${parseFloat(geofence.center_lng).toFixed(6)}`);
    }
    
    // 4. Resumen y diagnóstico
    console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:');
    console.log('=' .repeat(100));
    console.log(`   ${totalIssues === 0 ? '✅' : '❌'} Problemas encontrados: ${totalIssues}`);
    
    if (totalIssues > 0) {
      console.log('\n🔧 POSIBLES CAUSAS DEL PROBLEMA EN DASHBOARD:');
      console.log('   1. ❌ Coordenadas en DB no coinciden con CSV');
      console.log('   2. 🔄 Cache del navegador (Ctrl+F5)');
      console.log('   3. 📡 API del dashboard usa datos incorrectos');
      console.log('   4. 🚀 Railway aún deployando cambios');
    } else {
      console.log('\n✅ COORDENADAS CORRECTAS - POSIBLES CAUSAS DEL PROBLEMA:');
      console.log('   1. 🔄 Cache del navegador (hacer Ctrl+F5)');
      console.log('   2. 🚀 Railway deployando (esperar 2-3 minutos)');
      console.log('   3. 📱 JavaScript del dashboard con problemas');
      console.log('   4. 🌐 API endpoints del dashboard mal configurados');
    }
    
    console.log('\n🌐 URLS PARA VERIFICAR:');
    console.log('   📊 Dashboard: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    console.log('   📡 API Branches: https://pollo-loco-tracking-gps-production.up.railway.app/api/branches');
    console.log('   📡 API Geofences: https://pollo-loco-tracking-gps-production.up.railway.app/api/dashboard/geofences');
    
    return { success: true, issues: totalIssues };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

verifyDashboardCoordinates();