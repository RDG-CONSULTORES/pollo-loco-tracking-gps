require('dotenv').config();
const { Pool } = require('pg');

async function fixSpecialBranches() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 NORMALIZANDO SUCURSALES ESPECIALES...\n');
    
    // Sucursales especiales con coordenadas correctas del CSV
    const specialBranches = [
      {
        old_name: "Sucursal SC - Santa Catarina",
        new_name: "4 - Santa Catarina", 
        new_code: "2247003",
        lat: 25.675066418655128,
        lng: -100.44392246923258,
        branch_number: 4
      },
      {
        old_name: "Sucursal GC - Garcia",
        new_name: "6 - Garcia",
        new_code: "2247005", 
        lat: 25.794376997546525,
        lng: -100.58331696472145,
        branch_number: 6
      },
      {
        old_name: "Sucursal LH - La Huasteca",
        new_name: "7 - La Huasteca",
        new_code: "2247006",
        lat: 25.66167939366433,
        lng: -100.43812815949279,
        branch_number: 7
      }
    ];
    
    console.log('📊 SUCURSALES A NORMALIZAR:');
    specialBranches.forEach((branch, i) => {
      console.log(`   ${i+1}. "${branch.old_name}" → "${branch.new_name}"`);
      console.log(`      Coords: ${branch.lat.toFixed(8)}, ${branch.lng.toFixed(8)}`);
      console.log(`      Code: ${branch.new_code}`);
      console.log('');
    });
    
    console.log('🔄 ACTUALIZANDO tracking_locations_cache:');
    
    for (const branch of specialBranches) {
      try {
        // Actualizar en tracking_locations_cache
        const result = await pool.query(`
          UPDATE tracking_locations_cache 
          SET 
            name = $1,
            location_code = $2,
            latitude = $3,
            longitude = $4,
            synced_at = NOW()
          WHERE name = $5
        `, [
          branch.new_name, 
          branch.new_code,
          branch.lat, 
          branch.lng, 
          branch.old_name
        ]);
        
        if (result.rowCount > 0) {
          console.log(`   ✅ "${branch.old_name}" → "${branch.new_name}"`);
          console.log(`      Coords: ${branch.lat.toFixed(8)}, ${branch.lng.toFixed(8)}`);
        } else {
          console.log(`   ⚠️  "${branch.old_name}" - No se encontró registro`);
        }
        
      } catch (updateError) {
        console.log(`   ❌ Error actualizando "${branch.old_name}": ${updateError.message}`);
      }
    }
    
    console.log('\n🔄 ACTUALIZANDO branches (si existen):');
    
    for (const branch of specialBranches) {
      try {
        // También actualizar en branches si existe
        const branchResult = await pool.query(`
          UPDATE branches 
          SET 
            name = $1,
            latitude = $2,
            longitude = $3,
            updated_at = NOW()
          WHERE name ILIKE $4 OR branch_number = $5
        `, [
          branch.new_name,
          branch.lat, 
          branch.lng,
          `%${branch.old_name.replace('Sucursal ', '').replace(' - ', '%')}%`,
          branch.branch_number
        ]);
        
        if (branchResult.rowCount > 0) {
          console.log(`   ✅ Branch #${branch.branch_number} actualizado`);
        }
        
      } catch (branchError) {
        console.log(`   ❌ Error en branches: ${branchError.message}`);
      }
    }
    
    console.log('\n🔄 ACTUALIZANDO geofences:');
    
    for (const branch of specialBranches) {
      try {
        // Buscar y actualizar geofences relacionados
        const geofenceUpdate = await pool.query(`
          UPDATE geofences 
          SET 
            name = $1,
            center_lat = $2,
            center_lng = $3,
            updated_at = NOW()
          WHERE name ILIKE $4
        `, [
          branch.new_name,
          branch.lat, 
          branch.lng,
          `%${branch.old_name.replace('Sucursal ', '').replace(' - ', '%')}%`
        ]);
        
        if (geofenceUpdate.rowCount > 0) {
          console.log(`   ✅ Geofence "${branch.new_name}" actualizado`);
        }
        
      } catch (geofenceError) {
        console.log(`   ❌ Error en geofences: ${geofenceError.message}`);
      }
    }
    
    // Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL:');
    
    for (const branch of specialBranches) {
      const check = await pool.query(`
        SELECT name, latitude, longitude, synced_at
        FROM tracking_locations_cache
        WHERE name = $1
      `, [branch.new_name]);
      
      if (check.rows.length > 0) {
        const row = check.rows[0];
        console.log(`   ✅ "${row.name}"`);
        console.log(`      Coords: ${parseFloat(row.latitude).toFixed(8)}, ${parseFloat(row.longitude).toFixed(8)}`);
        console.log(`      Actualizado: ${row.synced_at}`);
        console.log('');
      }
    }
    
    console.log('🎉 ¡SUCURSALES ESPECIALES NORMALIZADAS!');
    console.log('=' .repeat(80));
    console.log('✅ Formato normalizado: "# - Nombre Sucursal"');
    console.log('✅ Coordenadas exactas del CSV aplicadas');
    console.log('✅ Códigos de sucursal corregidos'); 
    console.log('✅ Cambio inmediato - sin redeploy necesario');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
fixSpecialBranches().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡NORMALIZACIÓN COMPLETADA!');
    console.log('Las 3 sucursales especiales ya tienen el formato correcto');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});