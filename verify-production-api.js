require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function verifyProductionAPI() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO API DE PRODUCCIÓN RAILWAY...\n');
    
    // 1. Verificar DATABASE_URL
    console.log('📊 VERIFICANDO CONEXIÓN:');
    console.log(`   Database URL: ${process.env.DATABASE_URL ? 'CONFIGURADA' : 'NO CONFIGURADA'}`);
    
    // Test de conectividad
    const testQuery = await pool.query('SELECT NOW() as current_time');
    console.log(`   ✅ Conexión exitosa: ${testQuery.rows[0].current_time}`);
    
    // 2. Verificar sucursales problemáticas específicas
    const problematicBranches = [
      { name: 'Pino Suarez', number: 1 },
      { name: 'Cadereyta', number: 26 },
      { name: 'Huasteca', number: 66 },
      { name: 'Gomez Morin', number: 62 },
      { name: 'Anahuac', number: 83 }
    ];
    
    console.log('\n🚨 VERIFICANDO SUCURSALES PROBLEMÁTICAS EN PRODUCCIÓN:');
    console.log('=' .repeat(80));
    
    for (const branch of problematicBranches) {
      console.log(`\n🔍 VERIFICANDO #${branch.number} - ${branch.name}:`);
      
      const result = await pool.query(`
        SELECT branch_number, name, latitude, longitude, city, state, updated_at
        FROM branches 
        WHERE branch_number = $1 AND active = true
      `, [branch.number]);
      
      if (result.rows.length > 0) {
        const dbBranch = result.rows[0];
        console.log(`   📍 Nombre: ${dbBranch.name}`);
        console.log(`   📍 Ubicación: ${dbBranch.city}, ${dbBranch.state}`);
        console.log(`   📍 Coordenadas: ${parseFloat(dbBranch.latitude).toFixed(10)}, ${parseFloat(dbBranch.longitude).toFixed(10)}`);
        console.log(`   📍 Última actualización: ${dbBranch.updated_at}`);
      } else {
        console.log(`   ❌ No encontrada en producción`);
      }
    }
    
    // 3. Verificar CSV vs DB
    console.log('\n📊 COMPARANDO CON CSV NORMALIZADO:');
    console.log('=' .repeat(80));
    
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
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
    
    // Comparar coordenadas específicas
    let totalMismatches = 0;
    
    for (const branch of problematicBranches) {
      const csvData = csvCoords[branch.number];
      
      if (csvData) {
        console.log(`\n🔍 COMPARACIÓN #${branch.number}:`);
        
        const dbResult = await pool.query(`
          SELECT latitude, longitude 
          FROM branches 
          WHERE branch_number = $1 AND active = true
        `, [branch.number]);
        
        if (dbResult.rows.length > 0) {
          const dbLat = parseFloat(dbResult.rows[0].latitude);
          const dbLng = parseFloat(dbResult.rows[0].longitude);
          
          const latDiff = Math.abs(dbLat - csvData.lat);
          const lngDiff = Math.abs(dbLng - csvData.lng);
          const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
          
          console.log(`   📊 CSV:  ${csvData.lat.toFixed(12)}, ${csvData.lng.toFixed(12)}`);
          console.log(`   📊 DB:   ${dbLat.toFixed(12)}, ${dbLng.toFixed(12)}`);
          console.log(`   📊 Diff: lat=${latDiff.toFixed(15)}, lng=${lngDiff.toFixed(15)}`);
          console.log(`   ${isMatch ? '✅ COINCIDEN' : '❌ NO COINCIDEN'}`);
          
          if (!isMatch) {
            totalMismatches++;
          }
        }
      }
    }
    
    // 4. Verificar tabla geofences también
    console.log('\n🗺️ VERIFICANDO TABLA GEOFENCES:');
    console.log('=' .repeat(80));
    
    for (const branch of problematicBranches) {
      const geofenceResult = await pool.query(`
        SELECT g.name, g.center_lat, g.center_lng, b.branch_number
        FROM geofences g
        JOIN branches b ON g.branch_id = b.id
        WHERE b.branch_number = $1 AND b.active = true
      `, [branch.number]);
      
      if (geofenceResult.rows.length > 0) {
        const geofence = geofenceResult.rows[0];
        console.log(`   📍 #${geofence.branch_number}: ${parseFloat(geofence.center_lat).toFixed(6)}, ${parseFloat(geofence.center_lng).toFixed(6)}`);
      } else {
        console.log(`   ❌ #${branch.number}: Sin geofence`);
      }
    }
    
    // 5. Resumen del diagnóstico
    console.log('\n📊 DIAGNÓSTICO COMPLETO:');
    console.log('=' .repeat(80));
    console.log(`   🔍 Coordenadas que no coinciden: ${totalMismatches}`);
    
    if (totalMismatches > 0) {
      console.log('\n🚨 PROBLEMA CONFIRMADO:');
      console.log('   Las coordenadas en la base de datos NO coinciden con el CSV');
      console.log('   Los scripts anteriores no aplicaron los cambios correctamente');
      
      console.log('\n🔧 POSIBLES CAUSAS:');
      console.log('   1. ❌ DATABASE_URL apunta a base de datos incorrecta');
      console.log('   2. ❌ Scripts ejecutados en base de datos local');
      console.log('   3. ❌ Railway tiene múltiples instancias de base de datos');
      console.log('   4. ❌ Transacciones no se committearon correctamente');
      
      console.log('\n⚡ SOLUCIÓN INMEDIATA:');
      console.log('   Voy a aplicar las coordenadas del CSV DIRECTAMENTE');
    } else {
      console.log('\n✅ COORDENADAS CORRECTAS EN DB');
      console.log('   El problema puede ser:');
      console.log('   • Cache del navegador');
      console.log('   • API del dashboard usa endpoints incorrectos');
      console.log('   • JavaScript del dashboard con problemas');
    }
    
    return { success: true, mismatches: totalMismatches, csvCoords };
    
  } catch (error) {
    console.error('❌ Error verificando producción:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
verifyProductionAPI().then(result => {
  if (result.success) {
    console.log(`\n📊 Verificación completada: ${result.mismatches} problemas encontrados`);
  } else {
    console.log('\n❌ Error en verificación:', result.error);
  }
});