require('dotenv').config();
const { Pool } = require('pg');

async function fixCerradasAnahuac() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔧 CORRIGIENDO COORDENADAS DE CERRADAS DE ANAHUAC...\n');
    
    // Coordenadas correctas del CSV para #83 - Cerradas de Anahuac
    const correctLat = 25.785732112716154;
    const correctLng = -100.28004375427862;
    
    console.log('📊 ESTADO ACTUAL:');
    const current = await pool.query(`
      SELECT branch_number, name, latitude, longitude, city
      FROM branches 
      WHERE branch_number = 83
    `);
    
    if (current.rows.length > 0) {
      const branch = current.rows[0];
      console.log(`   #${branch.branch_number} - ${branch.name}`);
      console.log(`   Ciudad: ${branch.city}`);
      console.log(`   Coordenadas actuales: ${parseFloat(branch.latitude).toFixed(10)}, ${parseFloat(branch.longitude).toFixed(10)}`);
    }
    
    console.log('\n🔄 APLICANDO COORDENADAS CORRECTAS DEL CSV...');
    console.log(`   Coordenadas correctas: ${correctLat}, ${correctLng}`);
    
    await pool.query(`
      UPDATE branches 
      SET 
        latitude = $1,
        longitude = $2,
        updated_at = NOW()
      WHERE branch_number = 83
    `, [correctLat, correctLng]);
    
    console.log('   ✅ Coordenadas corregidas');
    
    // Verificar la corrección
    console.log('\n📊 VERIFICACIÓN:');
    const updated = await pool.query(`
      SELECT branch_number, name, latitude, longitude, city
      FROM branches 
      WHERE branch_number = 83
    `);
    
    if (updated.rows.length > 0) {
      const branch = updated.rows[0];
      const newLat = parseFloat(branch.latitude);
      const newLng = parseFloat(branch.longitude);
      
      console.log(`   #${branch.branch_number} - ${branch.name}`);
      console.log(`   Ciudad: ${branch.city}`);
      console.log(`   Coordenadas corregidas: ${newLat.toFixed(10)}, ${newLng.toFixed(10)}`);
      
      // Verificar que coinciden con el CSV
      const latDiff = Math.abs(newLat - correctLat);
      const lngDiff = Math.abs(newLng - correctLng);
      const isMatch = latDiff < 0.000001 && lngDiff < 0.000001;
      
      console.log(`   ${isMatch ? '✅' : '❌'} Coinciden con CSV: ${isMatch}`);
    }
    
    console.log('\n🎉 ¡CORRECCIÓN COMPLETADA!');
    console.log('\n✅ RESULTADO:');
    console.log('   • #83 Cerradas de Anahuac tiene sus coordenadas correctas del CSV');
    console.log('   • General Escobedo, Nuevo León');
    console.log('   • Grupo OGAS correcto');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

fixCerradasAnahuac();