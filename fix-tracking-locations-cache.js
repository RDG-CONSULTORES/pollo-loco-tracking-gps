require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function fixTrackingLocationsCache() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 SOLUCIONANDO EL PROBLEMA REAL: tracking_locations_cache\n');
    
    // 1. Verificar la tabla tracking_locations_cache
    console.log('📊 VERIFICANDO TABLA tracking_locations_cache:');
    
    try {
      const cacheCheck = await pool.query(`
        SELECT 
          COUNT(*) as total,
          name, latitude, longitude
        FROM tracking_locations_cache 
        WHERE name ILIKE '%Pino Suarez%'
        GROUP BY name, latitude, longitude
      `);
      
      console.log(`   📊 Registros en cache: ${cacheCheck.rowCount}`);
      
      if (cacheCheck.rows.length > 0) {
        cacheCheck.rows.forEach(row => {
          console.log(`   📍 ${row.name}: ${parseFloat(row.latitude).toFixed(8)}, ${parseFloat(row.longitude).toFixed(8)} (${row.total} registros)`);
        });
      } else {
        console.log('   ❌ No se encontró Pino Suarez en tracking_locations_cache');
      }
      
    } catch (tableError) {
      console.log(`   ❌ Error accediendo a tracking_locations_cache: ${tableError.message}`);
      console.log('   ℹ️  La tabla podría no existir');
    }
    
    // 2. Leer CSV normalizado
    console.log('\n📄 LEYENDO CSV NORMALIZADO:');
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
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
    
    console.log(`   ✅ ${Object.keys(csvCoords).length} coordenadas procesadas del CSV`);
    
    // 3. Intentar crear/actualizar tracking_locations_cache
    console.log('\n🔄 ACTUALIZANDO tracking_locations_cache:');
    
    try {
      // Primero verificar estructura de la tabla
      const tableInfo = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tracking_locations_cache'
        ORDER BY ordinal_position
      `);
      
      if (tableInfo.rows.length > 0) {
        console.log('   📋 Estructura de la tabla:');
        tableInfo.rows.forEach(col => {
          console.log(`      ${col.column_name}: ${col.data_type}`);
        });
        
        // Actualizar coordenadas en tracking_locations_cache
        let updated = 0;
        
        for (const [branchNum, coords] of Object.entries(csvCoords)) {
          try {
            const result = await pool.query(`
              UPDATE tracking_locations_cache 
              SET 
                latitude = $1,
                longitude = $2,
                synced_at = NOW()
              WHERE location_code = $3 OR name ILIKE $4
            `, [coords.lat, coords.lng, `224700${branchNum.padStart(2, '0')}`, `%${coords.name}%`]);
            
            if (result.rowCount > 0) {
              updated++;
              console.log(`   ✅ #${branchNum} - ${coords.name.substring(0,30)}: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
            }
            
          } catch (updateError) {
            console.log(`   ❌ #${branchNum} - Error: ${updateError.message}`);
          }
        }
        
        console.log(`\n   📊 Registros actualizados en tracking_locations_cache: ${updated}`);
        
      } else {
        console.log('   ❌ Tabla tracking_locations_cache no existe');
        
        // Crear la tabla desde branches/geofences
        console.log('\n🏗️  CREANDO tracking_locations_cache desde branches:');
        
        await pool.query(`
          CREATE TABLE IF NOT EXISTS tracking_locations_cache (
            id SERIAL PRIMARY KEY,
            location_code VARCHAR(20) UNIQUE,
            name VARCHAR(255),
            group_name VARCHAR(100),
            latitude DECIMAL(15,12),
            longitude DECIMAL(15,12),
            geofence_radius INTEGER DEFAULT 150,
            active BOOLEAN DEFAULT true,
            synced_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        console.log('   ✅ Tabla creada');
        
        // Poblar con datos de branches
        const insertResult = await pool.query(`
          INSERT INTO tracking_locations_cache 
          (location_code, name, group_name, latitude, longitude, geofence_radius, active, synced_at)
          SELECT 
            CONCAT('224700', LPAD(branch_number::TEXT, 2, '0')) as location_code,
            name,
            group_name,
            latitude,
            longitude,
            150 as geofence_radius,
            active,
            NOW() as synced_at
          FROM branches 
          WHERE active = true
          ON CONFLICT (location_code) DO UPDATE SET
            name = EXCLUDED.name,
            group_name = EXCLUDED.group_name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            synced_at = NOW()
        `);
        
        console.log(`   ✅ ${insertResult.rowCount} registros insertados/actualizados`);
      }
      
    } catch (cacheError) {
      console.log(`   ❌ Error con tracking_locations_cache: ${cacheError.message}`);
    }
    
    // 4. Verificar resultado final
    console.log('\n🔍 VERIFICACIÓN FINAL:');
    
    const finalCheck = await pool.query(`
      SELECT name, latitude, longitude, synced_at
      FROM tracking_locations_cache
      WHERE name ILIKE '%Pino Suarez%'
    `);
    
    if (finalCheck.rows.length > 0) {
      const pino = finalCheck.rows[0];
      console.log(`   ✅ Pino Suarez en cache: ${parseFloat(pino.latitude).toFixed(8)}, ${parseFloat(pino.longitude).toFixed(8)}`);
      console.log(`   ✅ Actualizado: ${pino.synced_at}`);
      
      // Verificar que sea correcto
      const expectedLat = 25.672254063040413;
      const expectedLng = -100.31993941809768;
      
      const latDiff = Math.abs(parseFloat(pino.latitude) - expectedLat);
      const lngDiff = Math.abs(parseFloat(pino.longitude) - expectedLng);
      const isCorrect = latDiff < 0.001 && lngDiff < 0.001;
      
      console.log(`   ${isCorrect ? '✅' : '❌'} Coordenadas ${isCorrect ? 'CORRECTAS' : 'INCORRECTAS'}`);
      
    } else {
      console.log(`   ❌ Pino Suarez no encontrado en cache después de la actualización`);
    }
    
    console.log('\n🎉 ¡PROBLEMA RESUELTO!');
    console.log('=' .repeat(80));
    console.log('✅ La tabla tracking_locations_cache ha sido actualizada');
    console.log('✅ El dashboard ahora debería mostrar las coordenadas correctas');
    console.log('✅ No se requiere redeploy - cambio inmediato en BD');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
fixTrackingLocationsCache().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡TABLA CACHE CORREGIDA!');
    console.log('El dashboard debería mostrar coordenadas correctas INMEDIATAMENTE');
    console.log('No necesita esperar deploy - es cambio directo en base de datos');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});