require('dotenv').config();
const { Client } = require('pg');

/**
 * Corregir las 3 ubicaciones problemáticas:
 * - Cadereyta: mover a Cadereyta Jiménez real
 * - Gómez Morín: mantener coordenadas actuales 
 * - La Huasteca: usar coordenadas más precisas
 */

const CORRECCIONES = {
  "26 - Cadereyta": {
    descripcion: "Mover a Cadereyta Jiménez real (no Monterrey)",
    latitud: 25.5957,
    longitud: -99.9814,
    direccion: "Cadereyta Jiménez, Nuevo León"
  },
  "38 - Gomez Morin": {
    descripcion: "Mantener coordenadas actuales (validadas)",
    latitud: 25.6505422,
    longitud: -100.3838798,
    direccion: "San Pedro Garza García, Nuevo León"
  },
  "Sucursal LH - La Huasteca": {
    descripcion: "Usar coordenadas más precisas de La Huasteca",
    latitud: 25.661585,
    longitud: -100.437944,
    direccion: "Santa Catarina, Nuevo León"
  }
};

async function corregirProblematicas() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔧 Corrigiendo las 3 ubicaciones problemáticas...');
    
    // Mostrar estado actual
    console.log('\n📍 Estado ANTES de las correcciones:');
    const antes = await client.query(`
      SELECT name, latitude, longitude, address 
      FROM tracking_locations_cache 
      WHERE name IN ('26 - Cadereyta', '38 - Gomez Morin', 'Sucursal LH - La Huasteca')
      ORDER BY name
    `);
    
    antes.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.latitude}, ${row.longitude} (${row.address})`);
    });
    
    // Aplicar correcciones
    for (const [nombre, correccion] of Object.entries(CORRECCIONES)) {
      console.log(`\n🔧 Corrigiendo: ${nombre}`);
      console.log(`   ${correccion.descripcion}`);
      
      const resultado = await client.query(`
        UPDATE tracking_locations_cache 
        SET 
          latitude = $1,
          longitude = $2,
          address = $3,
          synced_at = NOW()
        WHERE name = $4
        RETURNING name, latitude, longitude
      `, [
        correccion.latitud,
        correccion.longitud,
        correccion.direccion,
        nombre
      ]);
      
      if (resultado.rows.length > 0) {
        const updated = resultado.rows[0];
        console.log(`   ✅ Actualizada: ${updated.latitude}, ${updated.longitude}`);
        console.log(`   🌐 Verificar: https://www.google.com/maps/@${updated.latitude},${updated.longitude},17z`);
      } else {
        console.log(`   ❌ No encontrada: ${nombre}`);
      }
    }
    
    // Mostrar estado final
    console.log('\n📍 Estado DESPUÉS de las correcciones:');
    const despues = await client.query(`
      SELECT name, latitude, longitude, address 
      FROM tracking_locations_cache 
      WHERE name IN ('26 - Cadereyta', '38 - Gomez Morin', 'Sucursal LH - La Huasteca')
      ORDER BY name
    `);
    
    despues.rows.forEach(row => {
      console.log(`  ✅ ${row.name}: ${row.latitude}, ${row.longitude} (${row.address})`);
    });
    
    console.log('\n🎉 Correcciones aplicadas. Verificar en el dashboard.');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  corregirProblematicas()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = corregirProblematicas;