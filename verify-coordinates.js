require('dotenv').config();
const { Pool } = require('pg');

async function verifyCoordinates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO COORDENADAS EN LA BASE DE DATOS...\n');
    
    // Verificar las primeras 10 sucursales
    const result = await pool.query(`
      SELECT 
        id, name, city, latitude, longitude, updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_ago
      FROM branches 
      WHERE active = true AND id <= 10
      ORDER BY id
    `);
    
    console.log('📊 PRIMERAS 10 SUCURSALES EN LA BASE DE DATOS:');
    console.log('ID | Nombre | Ciudad | Coordenadas Actuales | Última Actualización');
    console.log('---|---------|--------|---------------------|---------------------');
    
    result.rows.forEach(branch => {
      const minutesAgo = Math.round(branch.minutes_ago);
      const timeStatus = minutesAgo < 60 ? `🆕 hace ${minutesAgo}m` : `⏰ hace ${Math.round(minutesAgo/60)}h`;
      console.log(`${branch.id} | ${branch.name.substring(0,15).padEnd(15)} | ${branch.city.substring(0,10).padEnd(10)} | ${branch.latitude}, ${branch.longitude} | ${timeStatus}`);
    });
    
    // Verificar las 3 nuevas sucursales específicamente
    console.log('\n🆕 VERIFICANDO LAS 3 SUCURSALES NUEVAS:');
    const newBranches = await pool.query(`
      SELECT id, name, city, latitude, longitude, zenput_id, updated_at
      FROM branches 
      WHERE id IN (93, 94, 95)
      ORDER BY id
    `);
    
    newBranches.rows.forEach(branch => {
      const hasCoords = branch.latitude && branch.longitude && branch.latitude != 0;
      const status = hasCoords ? '✅ COORDENADAS OK' : '❌ SIN COORDENADAS';
      console.log(`   #${branch.id} - ${branch.name}`);
      console.log(`      Coord: ${branch.latitude}, ${branch.longitude}`);
      console.log(`      Estado: ${status}`);
      console.log(`      Actualizado: ${new Date(branch.updated_at).toLocaleString('es-MX')}\n`);
    });
    
    // Verificar cuántas tienen las coordenadas que TÚ pusiste vs las viejas
    console.log('🔍 ANÁLISIS DE COORDENADAS:');
    const coordAnalysis = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '3 hours' THEN 1 END) as recent_updates,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != 0 THEN 1 END) as with_coords
      FROM branches WHERE active = true
    `);
    
    const stats = coordAnalysis.rows[0];
    console.log(`   Total sucursales: ${stats.total}`);
    console.log(`   Con coordenadas: ${stats.with_coords}`);
    console.log(`   Actualizadas reciente: ${stats.recent_updates}`);
    
    // Comparar con el CSV para ver si coinciden
    console.log('\n📊 COMPARANDO CON TU CSV...');
    const fs = require('fs');
    try {
      const csvContent = fs.readFileSync('./sucursales_epl_cas.csv', 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      console.log(`   CSV tiene ${lines.length - 1} filas de datos`);
      
      // Tomar una muestra del CSV para comparar
      if (lines.length > 1) {
        const sampleLine = lines[1]; // Primera fila de datos
        console.log(`   Ejemplo CSV: ${sampleLine.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log('   ⚠️ No se pudo leer el CSV');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyCoordinates();