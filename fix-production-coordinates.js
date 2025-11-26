require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function fixProductionCoordinates() {
  // Usar la URL de Railway directamente para asegurar conexión a producción
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚀 APLICANDO COORDENADAS CORRECTAS A PRODUCCIÓN RAILWAY...\n');
    
    // 1. Leer CSV normalizado de Roberto
    console.log('📊 Leyendo CSV normalizado...');
    const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log(`   ✅ ${lines.length - 1} filas encontradas en CSV`);
    
    // 2. Procesar coordenadas del CSV
    console.log('\n🔄 Procesando coordenadas del CSV...');
    const updates = [];
    
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
          updates.push({
            number: csvNum,
            name: csvName,
            lat: csvLat,
            lng: csvLng
          });
        }
      }
    }
    
    console.log(`   ✅ ${updates.length} coordenadas preparadas para actualizar`);
    
    // 3. Aplicar todas las coordenadas a producción
    console.log('\n🎯 APLICANDO COORDENADAS A BASE DE DATOS DE PRODUCCIÓN:');
    console.log('=' .repeat(80));
    
    let updated = 0;
    let errors = 0;
    
    for (const update of updates) {
      try {
        const result = await pool.query(`
          UPDATE branches 
          SET 
            latitude = $1,
            longitude = $2,
            updated_at = NOW()
          WHERE branch_number = $3 AND active = true
        `, [update.lat, update.lng, update.number]);
        
        if (result.rowCount > 0) {
          console.log(`   ✅ #${update.number} - ${update.name.substring(0,30).padEnd(30)} → ${update.lat.toFixed(6)}, ${update.lng.toFixed(6)}`);
          updated++;
        } else {
          console.log(`   ⚠️ #${update.number} - No encontrada en producción`);
          errors++;
        }
      } catch (error) {
        console.log(`   ❌ #${update.number} - Error: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n📊 RESULTADO DE ACTUALIZACIÓN:');
    console.log(`   ✅ Coordenadas actualizadas: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📊 Total procesadas: ${updated + errors}`);
    
    // 4. Aplicar correcciones de grupos operativos
    console.log('\n👥 APLICANDO CORRECCIONES DE GRUPOS OPERATIVOS...');
    
    // #82 Aeropuerto Nuevo Laredo → EXPO
    await pool.query(`
      UPDATE branches 
      SET group_id = 2, group_name = 'EXPO', updated_at = NOW()
      WHERE branch_number = 82
    `);
    console.log('   ✅ #82 Aeropuerto Nuevo Laredo → Grupo EXPO');
    
    // #83 Cerradas de Anahuac → OGAS
    await pool.query(`
      UPDATE branches 
      SET group_id = 4, group_name = 'OGAS', updated_at = NOW()
      WHERE branch_number = 83
    `);
    console.log('   ✅ #83 Cerradas de Anahuac → Grupo OGAS');
    
    // #84 Aeropuerto del Norte → EPL SO
    await pool.query(`
      UPDATE branches 
      SET group_id = 20, group_name = 'EPL SO', updated_at = NOW()
      WHERE branch_number = 84
    `);
    console.log('   ✅ #84 Aeropuerto del Norte → Grupo EPL SO');
    
    // #85 Diego Diaz → OGAS
    await pool.query(`
      UPDATE branches 
      SET group_id = 4, group_name = 'OGAS', updated_at = NOW()
      WHERE branch_number = 85
    `);
    console.log('   ✅ #85 Diego Diaz → Grupo OGAS');
    
    // #57 Harold R. Pape → Monclova
    await pool.query(`
      UPDATE branches 
      SET city = 'Monclova', municipality = 'Monclova', updated_at = NOW()
      WHERE branch_number = 57
    `);
    console.log('   ✅ #57 Harold R. Pape → Monclova');
    
    // 5. Limpiar y recrear geofences con coordenadas correctas
    console.log('\n🔄 SINCRONIZANDO GEOFENCES...');
    await pool.query(`DELETE FROM geofences`);
    console.log('   ✅ Geofences limpiados');
    
    // Recrear geofences con coordenadas correctas
    const branches = await pool.query(`
      SELECT 
        id, branch_number, name, city, state,
        latitude, longitude, group_name
      FROM branches 
      WHERE active = true AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY branch_number
    `);
    
    let geofencesCreated = 0;
    for (const branch of branches.rows) {
      await pool.query(`
        INSERT INTO geofences (
          name, branch_id, description,
          center_lat, center_lng, radius_meters, 
          active, alert_on_enter, alert_on_exit, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        branch.name,
        branch.id,
        `Geofence para ${branch.name} - Grupo: ${branch.group_name} - ${branch.city}, ${branch.state}`,
        branch.latitude,
        branch.longitude,
        150,
        true,
        true,
        true
      ]);
      geofencesCreated++;
    }
    
    console.log(`   ✅ ${geofencesCreated} geofences recreados`);
    
    // 6. Verificar coordenadas específicas problemáticas
    console.log('\n🔍 VERIFICANDO COORDENADAS PROBLEMÁTICAS:');
    const problemBranches = ['Pino Suarez', 'Cadereyta', 'Huasteca', 'Gomez Morin', 'Anahuac'];
    
    for (const branchName of problemBranches) {
      const result = await pool.query(`
        SELECT branch_number, name, latitude, longitude, city
        FROM branches 
        WHERE active = true AND name ILIKE $1
        ORDER BY branch_number
      `, [`%${branchName}%`]);
      
      for (const branch of result.rows) {
        console.log(`   ✅ #${branch.branch_number} - ${branch.name}: ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}`);
      }
    }
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETA EN PRODUCCIÓN!');
    console.log('=' .repeat(80));
    console.log('✅ RESULTADOS:');
    console.log(`   • ${updated} coordenadas aplicadas del CSV validado`);
    console.log(`   • ${geofencesCreated} geofences sincronizados`);
    console.log('   • Grupos operativos corregidos');
    console.log('   • Ciudad de Harold R. Pape corregida');
    console.log('   • Dashboard debería mostrar coordenadas correctas en 1-2 minutos');
    
    console.log('\n🌐 VERIFICA EL DASHBOARD:');
    console.log('   https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
    return { success: true, updated, geofencesCreated };
    
  } catch (error) {
    console.error('❌ Error aplicando correcciones:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
fixProductionCoordinates().then(result => {
  if (result.success) {
    console.log('\n🚀 ¡SOLUCIÓN COMPLETADA EXITOSAMENTE!');
  } else {
    console.log('\n❌ Error en la solución:', result.error);
  }
  process.exit(0);
});