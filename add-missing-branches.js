require('dotenv').config();
const { Pool } = require('pg');

async function addMissingBranches() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 AGREGANDO SUCURSALES FALTANTES...\n');
    
    // Sucursales faltantes del CSV
    const missingBranches = [
      {
        number: 35,
        name: "35 - Apodaca",
        location_code: "2247034",
        city: "Apodaca",
        state: "Nuevo León",
        lat: 25.752290904821493,
        lng: -100.19873704677164,
        grupo: "PLOG NUEVO LEON"
      },
      {
        number: 82,
        name: "82 - Aeropuerto Nuevo Laredo", 
        location_code: "2247081",
        city: "Nuevo Laredo",
        state: "Tamaulipas",
        lat: 27.514326638660112,
        lng: -99.56265939271763,
        grupo: "GRUPO NUEVO LAREDO (RUELAS)"
      },
      {
        number: 83,
        name: "83 - Cerradas de Anahuac",
        location_code: "2260766", 
        city: "General Escobedo",
        state: "Nuevo León",
        lat: 25.785732112716154,
        lng: -100.28004375427862,
        grupo: "OGAS"
      },
      {
        number: 84,
        name: "84 - Aeropuerto del Norte",
        location_code: "2260636",
        city: "Ciénega de Flores", 
        state: "Nuevo León",
        lat: 25.872453844485992,
        lng: -100.22957599236578,
        grupo: "PLOG NUEVO LEON"
      },
      {
        number: 85,
        name: "85 - Diego Diaz",
        location_code: "2260765",
        city: "San Nicolás de los Garza",
        state: "Nuevo León", 
        lat: 25.742390433874363,
        lng: -100.26368228213246,
        grupo: "EFM"
      }
    ];
    
    console.log('📊 SUCURSALES A AGREGAR:');
    missingBranches.forEach((branch, i) => {
      console.log(`   ${i+1}. #${branch.number} - ${branch.name}`);
      console.log(`      📍 ${branch.city}, ${branch.state}`);
      console.log(`      🗺️  ${branch.lat.toFixed(8)}, ${branch.lng.toFixed(8)}`);
      console.log(`      🏢 Grupo: ${branch.grupo}`);
      console.log(`      🆔 Code: ${branch.location_code}`);
      console.log('');
    });
    
    console.log('🔄 AGREGANDO A tracking_locations_cache:');
    
    let addedCount = 0;
    for (const branch of missingBranches) {
      try {
        // Verificar si ya existe
        const existsCheck = await pool.query(`
          SELECT id FROM tracking_locations_cache 
          WHERE location_code = $1 OR name = $2
        `, [branch.location_code, branch.name]);
        
        if (existsCheck.rows.length > 0) {
          console.log(`   ⚠️  #${branch.number} "${branch.name}" - Ya existe, actualizando...`);
          
          const updateResult = await pool.query(`
            UPDATE tracking_locations_cache 
            SET 
              name = $1,
              latitude = $2,
              longitude = $3,
              group_name = $4,
              synced_at = NOW()
            WHERE location_code = $5
          `, [branch.name, branch.lat, branch.lng, branch.grupo, branch.location_code]);
          
          if (updateResult.rowCount > 0) {
            console.log(`      ✅ Actualizado exitosamente`);
            addedCount++;
          }
        } else {
          console.log(`   ➕ #${branch.number} "${branch.name}" - Creando nueva entrada...`);
          
          const insertResult = await pool.query(`
            INSERT INTO tracking_locations_cache (
              location_code, name, address, latitude, longitude, 
              group_name, director_name, active, synced_at, 
              geofence_radius, geofence_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
          `, [
            branch.location_code,
            branch.name, 
            `${branch.city}, ${branch.state}`,
            branch.lat,
            branch.lng,
            branch.grupo,
            'Director',
            true,
            150,
            true
          ]);
          
          if (insertResult.rowCount > 0) {
            console.log(`      ✅ Creado exitosamente`);
            addedCount++;
          }
        }
        
      } catch (branchError) {
        console.log(`   ❌ Error con #${branch.number}: ${branchError.message}`);
      }
    }
    
    console.log(`\\n📊 RESULTADO: ${addedCount} sucursales procesadas`);
    
    // Verificación final
    console.log('\\n🔍 VERIFICACIÓN FINAL:');
    
    const totalCount = await pool.query('SELECT COUNT(*) FROM tracking_locations_cache WHERE active = true');
    console.log(`   📊 Total sucursales: ${totalCount.rows[0].count}`);
    
    // Verificar las nuevas sucursales
    for (const branch of missingBranches) {
      const check = await pool.query(`
        SELECT name, latitude, longitude, synced_at
        FROM tracking_locations_cache
        WHERE location_code = $1
      `, [branch.location_code]);
      
      if (check.rows.length > 0) {
        const row = check.rows[0];
        console.log(`   ✅ #${branch.number} "${row.name}"`);
        console.log(`      📍 ${parseFloat(row.latitude).toFixed(6)}, ${parseFloat(row.longitude).toFixed(6)}`);
      } else {
        console.log(`   ❌ #${branch.number} "${branch.name}" - No encontrado`);
      }
    }
    
    console.log('\\n🎉 ¡SUCURSALES FALTANTES AGREGADAS!');
    console.log('=' .repeat(80));
    console.log(`✅ Total agregadas/actualizadas: ${addedCount}`);
    console.log('✅ Incluye: Aeropuerto Nuevo Laredo, Cerradas de Anahuac, Aeropuerto del Norte, Diego Diaz');
    console.log('✅ Coordenadas exactas del CSV aplicadas');
    console.log('✅ Cambio inmediato - sin redeploy necesario');
    
    return { success: true, added: addedCount };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
addMissingBranches().then(result => {
  if (result.success) {
    console.log('\\n🎯 ¡SUCURSALES FALTANTES AGREGADAS!');
    console.log(`Ahora deberías tener las 85 sucursales completas`);
  } else {
    console.log('\\n❌ Error:', result.error);
  }
});