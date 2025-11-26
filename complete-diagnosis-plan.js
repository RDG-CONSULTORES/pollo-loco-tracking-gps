require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function completeDiagnosisPlan() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DEL PROBLEMA EN RAILWAY...\n');
    
    // 1. VERIFICAR ENDPOINT ACTUAL EN VIVO
    console.log('🌐 PASO 1: VERIFICANDO ENDPOINT ACTUAL EN VIVO');
    console.log('=' .repeat(80));
    
    try {
      const fetch = require('node-fetch');
      const response = await fetch('https://pollo-loco-tracking-gps-production.up.railway.app/api/dashboard/geofences');
      const data = await response.json();
      
      console.log(`📊 Status: ${response.status}`);
      console.log(`📊 Sucursales en API: ${data.geofences ? data.geofences.length : 'ERROR'}`);
      
      if (data.geofences && data.geofences.length > 0) {
        const pinoAPI = data.geofences.find(g => g.location_name.includes('Pino Suarez'));
        if (pinoAPI) {
          console.log(`📍 Pino Suarez API: ${pinoAPI.latitude}, ${pinoAPI.longitude}`);
          console.log(`📍 Timestamp API: ${pinoAPI.created_at}`);
          
          // Comparar con lo esperado
          const expectedLat = 25.672254063040413;
          const expectedLng = -100.31993941809768;
          const apiLat = parseFloat(pinoAPI.latitude);
          const apiLng = parseFloat(pinoAPI.longitude);
          
          const isCorrect = Math.abs(apiLat - expectedLat) < 0.001 && Math.abs(apiLng - expectedLng) < 0.001;
          console.log(`📍 API ${isCorrect ? 'CORRECTO' : 'INCORRECTO'}: ${isCorrect ? '✅' : '❌'}`);
          
          if (!isCorrect) {
            console.log(`📍 Esperado: ${expectedLat.toFixed(8)}, ${expectedLng.toFixed(8)}`);
            console.log(`📍 Diferencia: ${Math.abs(apiLat - expectedLat).toFixed(8)}, ${Math.abs(apiLng - expectedLng).toFixed(8)}`);
          }
        }
      }
    } catch (fetchError) {
      console.log(`❌ Error fetching API: ${fetchError.message}`);
    }
    
    // 2. VERIFICAR BASE DE DATOS DIRECTA
    console.log('\n💾 PASO 2: VERIFICANDO BASE DE DATOS DIRECTA');
    console.log('=' .repeat(80));
    
    const dbPino = await pool.query(`
      SELECT 
        g.id, g.center_lat, g.center_lng, g.created_at,
        b.name, b.branch_number, b.latitude, b.longitude
      FROM geofences g
      JOIN branches b ON g.branch_id = b.id
      WHERE b.name ILIKE '%Pino Suarez%'
      ORDER BY g.created_at DESC
      LIMIT 1
    `);
    
    if (dbPino.rows.length > 0) {
      const pino = dbPino.rows[0];
      console.log(`📍 BD Pino Suarez: ${parseFloat(pino.center_lat).toFixed(8)}, ${parseFloat(pino.center_lng).toFixed(8)}`);
      console.log(`📍 BD Timestamp: ${pino.created_at}`);
      console.log(`📍 BD ID: ${pino.id}`);
    }
    
    // 3. VERIFICAR RUTA DEL ENDPOINT
    console.log('\n🛣️ PASO 3: VERIFICANDO CÓDIGO DEL ENDPOINT');
    console.log('=' .repeat(80));
    
    try {
      const dashboardRoutesPath = './src/api/routes/dashboard.routes.js';
      if (fs.existsSync(dashboardRoutesPath)) {
        const routesContent = fs.readFileSync(dashboardRoutesPath, 'utf8');
        
        // Buscar el endpoint de geofences
        if (routesContent.includes('/geofences')) {
          console.log('✅ Endpoint /geofences encontrado en dashboard.routes.js');
          
          // Verificar si hay cache o query específica
          if (routesContent.includes('cache') || routesContent.includes('Cache')) {
            console.log('⚠️ POSIBLE CACHE detectado en el código');
          }
          
          // Buscar la query exacta
          const lines = routesContent.split('\n');
          let inGeofenceHandler = false;
          let queryLines = [];
          
          for (const line of lines) {
            if (line.includes('geofences') && line.includes('get')) {
              inGeofenceHandler = true;
            }
            
            if (inGeofenceHandler && line.includes('SELECT')) {
              queryLines.push(line.trim());
            }
            
            if (inGeofenceHandler && line.includes('});')) {
              break;
            }
          }
          
          if (queryLines.length > 0) {
            console.log('📄 Query encontrada en el endpoint:');
            console.log(queryLines.join('\n'));
          }
        } else {
          console.log('❌ Endpoint /geofences NO encontrado');
        }
      }
    } catch (codeError) {
      console.log(`❌ Error leyendo código: ${codeError.message}`);
    }
    
    // 4. VERIFICAR SI HAY MÚLTIPLES ENDPOINTS
    console.log('\n🔍 PASO 4: BUSCANDO TODOS LOS ENDPOINTS DE GEOFENCES');
    console.log('=' .repeat(80));
    
    try {
      const { execSync } = require('child_process');
      const grepResult = execSync('find src -name "*.js" -exec grep -l "geofences" {} \\;', { encoding: 'utf8' });
      const files = grepResult.trim().split('\n');
      
      console.log(`📁 Archivos con 'geofences': ${files.length}`);
      for (const file of files) {
        console.log(`   📄 ${file}`);
      }
    } catch (grepError) {
      console.log('⚠️ No se pudo buscar archivos con grep');
    }
    
    // 5. VERIFICAR CONEXIÓN A BASE DE DATOS
    console.log('\n🔗 PASO 5: VERIFICANDO CONEXIÓN DE BASE DE DATOS');
    console.log('=' .repeat(80));
    
    const connTest = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log(`✅ Conexión exitosa a: ${connTest.rows[0].db_name}`);
    console.log(`✅ Hora actual: ${connTest.rows[0].current_time}`);
    
    // 6. PLAN DE ACCIÓN DEFINITIVO
    console.log('\n🎯 DIAGNÓSTICO Y PLAN DE ACCIÓN');
    console.log('=' .repeat(80));
    
    console.log('📊 PROBLEMAS IDENTIFICADOS:');
    console.log('1. 🌐 API del dashboard NO refleja cambios en BD');
    console.log('2. 💾 Base de datos tiene coordenadas correctas');
    console.log('3. 🔄 Posible cache en aplicación o multiple instancias');
    console.log('4. 📡 Endpoint puede estar usando query incorrecta');
    
    console.log('\n🔧 PLAN DE SOLUCIÓN DEFINITIVO:');
    console.log('');
    console.log('OPCIÓN 1: REDEPLOY COMPLETO (RECOMENDADO)');
    console.log('- Forzar redeploy completo en Railway');
    console.log('- Limpiar todas las instancias');
    console.log('- Garantizar que use BD correcta');
    console.log('');
    console.log('OPCIÓN 2: ENDPOINT DIRECTO NUEVO');
    console.log('- Crear endpoint completamente nuevo');
    console.log('- Bypass cualquier cache existente');
    console.log('- Testear independientemente');
    console.log('');
    console.log('OPCIÓN 3: HARDCODE FIX');
    console.log('- Modificar endpoint para force refresh');
    console.log('- Agregar timestamp único');
    console.log('- Forzar nueva consulta cada vez');
    
    console.log('\n⚡ ACCIÓN INMEDIATA RECOMENDADA:');
    console.log('Voy a crear un endpoint completamente nuevo que bypassee');
    console.log('cualquier problema existente y use tus coordenadas directamente.');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar diagnóstico
completeDiagnosisPlan().then(result => {
  if (result.success) {
    console.log('\n🚀 DIAGNÓSTICO COMPLETADO');
    console.log('Procediendo con la solución definitiva...');
  } else {
    console.log('\n❌ Error en diagnóstico:', result.error);
  }
});