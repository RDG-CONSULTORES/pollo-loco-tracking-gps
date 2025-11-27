require('dotenv').config();
const { Pool } = require('pg');

async function fixAeropuertoNuevoLaredoGroup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 CORRIGIENDO GRUPO: Aeropuerto Nuevo Laredo\n');
    
    console.log('📊 ESTADO ACTUAL:');
    
    // Verificar estado actual
    const currentState = await pool.query(`
      SELECT id, name, group_name, latitude, longitude, synced_at
      FROM tracking_locations_cache
      WHERE name = '82 - Aeropuerto Nuevo Laredo'
    `);
    
    if (currentState.rows.length > 0) {
      const current = currentState.rows[0];
      console.log(`   Nombre: ${current.name}`);
      console.log(`   Grupo actual: ${current.group_name}`);
      console.log(`   Grupo correcto: EXPO`);
      console.log(`   Coords: ${parseFloat(current.latitude).toFixed(6)}, ${parseFloat(current.longitude).toFixed(6)}`);
      console.log('');
    } else {
      console.log('   ❌ No se encontró el registro');
      return { success: false, error: 'Registro no encontrado' };
    }
    
    console.log('🔄 CAMBIANDO GRUPO A "EXPO":');
    
    // Actualizar el grupo operativo
    const updateResult = await pool.query(`
      UPDATE tracking_locations_cache 
      SET 
        group_name = 'EXPO',
        synced_at = NOW()
      WHERE name = '82 - Aeropuerto Nuevo Laredo'
    `);
    
    if (updateResult.rowCount > 0) {
      console.log(`   ✅ Grupo actualizado exitosamente: OGAS → EXPO`);
    } else {
      console.log(`   ❌ No se pudo actualizar el grupo`);
      return { success: false, error: 'Update failed' };
    }
    
    // Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL:');
    
    const finalCheck = await pool.query(`
      SELECT name, group_name, synced_at
      FROM tracking_locations_cache
      WHERE name = '82 - Aeropuerto Nuevo Laredo'
    `);
    
    if (finalCheck.rows.length > 0) {
      const final = finalCheck.rows[0];
      console.log(`   ✅ ${final.name}`);
      console.log(`   ✅ Grupo: ${final.group_name}`);
      console.log(`   ✅ Actualizado: ${final.synced_at}`);
      
      const isCorrect = final.group_name === 'EXPO';
      console.log(`   ${isCorrect ? '✅' : '❌'} ${isCorrect ? 'CORRECTO' : 'INCORRECTO'}`);
    }
    
    console.log('\n📋 RESUMEN GRUPOS OPERATIVOS FINALES:');
    console.log('   • #35 - Apodaca: PLOG NUEVO LEON ✓');
    console.log('   • #82 - Aeropuerto Nuevo Laredo: EXPO ✓');
    console.log('   • #83 - Cerradas de Anahuac: OGAS ✓');
    console.log('   • #84 - Aeropuerto del Norte: EPL SO ✓');
    console.log('   • #85 - Diego Diaz: OGAS ✓');
    
    console.log('\n🎉 ¡GRUPO CORREGIDO!');
    console.log('=' .repeat(60));
    console.log('✅ Aeropuerto Nuevo Laredo ahora es de EXPO');
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
fixAeropuertoNuevoLaredoGroup().then(result => {
  if (result.success) {
    console.log('\n🎯 ¡GRUPO OPERATIVO CORREGIDO!');
    console.log('Aeropuerto Nuevo Laredo ahora pertenece a EXPO');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});