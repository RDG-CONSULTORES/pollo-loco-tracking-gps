require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;

async function generateCSV() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📊 GENERANDO ARCHIVO CSV PARA EXCEL...\n');
    
    const result = await pool.query(`
      SELECT 
        id, branch_number, name, city, state, address,
        latitude, longitude, gps_validated, zenput_id
      FROM branches 
      WHERE active = true
      ORDER BY id
    `);
    
    // Crear contenido CSV SIN coordenadas incorrectas
    let csvContent = 'ID,Numero_Sucursal,Nombre,Ciudad,Estado,Direccion,Latitud,Longitud,Zenput_ID\n';
    
    result.rows.forEach(branch => {
      // Escapar comillas en nombres y direcciones
      const name = (branch.name || '').replace(/"/g, '""');
      const address = (branch.address || '').replace(/"/g, '""');
      
      // Dejar columnas vacías para que Roberto llene las coordenadas correctas
      csvContent += `${branch.id},"${branch.branch_number || ''}","${name}","${branch.city || ''}","${branch.state || ''}","${address}",,,"${branch.zenput_id || ''}"\n`;
    });
    
    // Guardar archivo CSV
    await fs.writeFile('./sucursales_epl_cas.csv', csvContent, 'utf8');
    console.log('✅ Archivo CSV creado: sucursales_epl_cas.csv');
    
    // Estadísticas
    const validated = result.rows.filter(b => b.gps_validated && b.latitude && b.longitude && b.latitude != 0).length;
    const pending = result.rows.length - validated;
    
    console.log(`\n📊 ESTADÍSTICAS:`);
    console.log(`   Total sucursales: ${result.rows.length}`);
    console.log(`   ✅ Validadas: ${validated}`);
    console.log(`   ❌ Pendientes: ${pending}`);
    
    // Mostrar las pendientes
    if (pending > 0) {
      console.log(`\n❌ SUCURSALES PENDIENTES:`);
      result.rows.forEach(branch => {
        if (!branch.gps_validated || !branch.latitude || !branch.longitude || branch.latitude == 0) {
          console.log(`   #${branch.id} - ${branch.name} (${branch.city})`);
        }
      });
    }
    
    console.log(`\n🎯 INSTRUCCIONES:`);
    console.log(`1. Abre el archivo: sucursales_epl_cas.csv`);
    console.log(`2. Excel lo abrirá automáticamente en columnas`);
    console.log(`3. Busca las sucursales con Validada = "NO"`);
    console.log(`4. Llena las coordenadas de Google Maps`);
    console.log(`5. ¡Listo! Tienes tu respaldo completo`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

generateCSV();