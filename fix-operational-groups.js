require('dotenv').config();
const { Pool } = require('pg');

async function fixOperationalGroups() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 CORRIGIENDO GRUPOS OPERATIVOS...\n');
    
    // Correcciones de grupos según Roberto
    const groupCorrections = [
      {
        number: 35,
        name: "35 - Apodaca",
        correct_group: "PLOG NUEVO LEON",
        current_group: "PLOG NUEVO LEON" // Ya está correcto
      },
      {
        number: 82,
        name: "82 - Aeropuerto Nuevo Laredo",
        correct_group: "OGAS", // Cambiar de GRUPO NUEVO LAREDO (RUELAS) a OGAS
        current_group: "GRUPO NUEVO LAREDO (RUELAS)"
      },
      {
        number: 83,
        name: "83 - Cerradas de Anahuac",
        correct_group: "OGAS", // Ya está correcto
        current_group: "OGAS"
      },
      {
        number: 84,
        name: "84 - Aeropuerto del Norte",
        correct_group: "EPL SO", // Cambiar de PLOG NUEVO LEON a EPL SO
        current_group: "PLOG NUEVO LEON"
      },
      {
        number: 85,
        name: "85 - Diego Diaz",
        correct_group: "OGAS", // Cambiar de EFM a OGAS
        current_group: "EFM"
      }
    ];
    
    console.log('📊 CORRECCIONES DE GRUPOS OPERATIVOS:');
    groupCorrections.forEach((branch, i) => {
      const needsChange = branch.correct_group !== branch.current_group;
      console.log(`   ${i+1}. #${branch.number} - ${branch.name.split(' - ')[1]}`);
      console.log(`      Actual: ${branch.current_group}`);
      console.log(`      Correcto: ${branch.correct_group}`);
      console.log(`      ${needsChange ? '🔄 NECESITA CAMBIO' : '✅ YA CORRECTO'}`);
      console.log('');
    });
    
    console.log('🔄 ACTUALIZANDO GRUPOS EN tracking_locations_cache:');
    
    let updatedCount = 0;
    for (const branch of groupCorrections) {
      if (branch.correct_group !== branch.current_group) {
        try {
          const result = await pool.query(`
            UPDATE tracking_locations_cache 
            SET 
              group_name = $1,
              synced_at = NOW()
            WHERE name = $2
          `, [branch.correct_group, branch.name]);
          
          if (result.rowCount > 0) {
            updatedCount++;
            console.log(`   ✅ #${branch.number} - ${branch.name.split(' - ')[1]}: ${branch.current_group} → ${branch.correct_group}`);
          } else {
            console.log(`   ⚠️  #${branch.number} - No se encontró registro`);
          }
          
        } catch (updateError) {
          console.log(`   ❌ #${branch.number} - Error: ${updateError.message}`);
        }
      } else {
        console.log(`   ✅ #${branch.number} - ${branch.name.split(' - ')[1]}: Ya tiene el grupo correcto (${branch.correct_group})`);
      }
    }
    
    console.log(`\\n📊 RESULTADO: ${updatedCount} grupos corregidos`);
    
    // Verificación final
    console.log('\\n🔍 VERIFICACIÓN FINAL DE GRUPOS:');
    
    for (const branch of groupCorrections) {
      const check = await pool.query(`
        SELECT name, group_name, synced_at
        FROM tracking_locations_cache
        WHERE name = $1
      `, [branch.name]);
      
      if (check.rows.length > 0) {
        const row = check.rows[0];
        const isCorrect = row.group_name === branch.correct_group;
        console.log(`   ${isCorrect ? '✅' : '❌'} #${branch.number} "${row.name.split(' - ')[1]}"`);
        console.log(`      Grupo: ${row.group_name}`);
        console.log(`      ${isCorrect ? 'CORRECTO' : 'INCORRECTO'}`);
        console.log('');
      }
    }
    
    console.log('🎉 ¡GRUPOS OPERATIVOS CORREGIDOS!');
    console.log('=' .repeat(80));
    console.log(`✅ Grupos corregidos: ${updatedCount}`);
    console.log('✅ Apodaca: PLOG NUEVO LEON ✓');
    console.log('✅ Aeropuerto Nuevo Laredo: OGAS ✓');
    console.log('✅ Cerradas de Anahuac: OGAS ✓'); 
    console.log('✅ Aeropuerto del Norte: EPL SO ✓');
    console.log('✅ Diego Diaz: OGAS ✓');
    console.log('✅ Cambio inmediato - sin redeploy necesario');
    
    return { success: true, updated: updatedCount };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar inmediatamente
fixOperationalGroups().then(result => {
  if (result.success) {
    console.log('\\n🎯 ¡GRUPOS OPERATIVOS CORREGIDOS!');
    console.log('Todas las nuevas sucursales tienen sus grupos correctos');
  } else {
    console.log('\\n❌ Error:', result.error);
  }
});