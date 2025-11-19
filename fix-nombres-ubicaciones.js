require('dotenv').config();
const { Client } = require('pg');

/**
 * Corregir ubicaciones con nombres que no coinciden con su dirección
 * - Gómez Morín debe estar en Avenida Gómez Morín
 * - Cadereyta debe estar en Cadereyta Jiménez
 */

const CORRECCIONES = {
  "38 - Gomez Morin": {
    descripcion: "Esquina Gómez Morín con Missouri, San Pedro Garza García",
    busqueda: "Missouri 458 esquina Gomez Morin San Pedro Garza Garcia",
    // Coordenadas de la intersección Gómez Morín y Missouri (más precisas)
    latitud: 25.6505, 
    longitud: -100.3839,
    direccion: "Missouri #458-A ote. esq. Av. Gómez Morín, San Pedro Garza García, NL"
  },
  "26 - Cadereyta": {
    descripcion: "Debe estar en Cadereyta Jiménez (municipio correcto)",
    busqueda: "El Pollo Loco Cadereyta Jimenez Nuevo Leon",
    // Coordenadas del centro de Cadereyta Jiménez
    latitud: 25.5957,
    longitud: -99.9814,
    direccion: "Cadereyta Jiménez, Nuevo León"
  }
};

async function corregirUbicaciones() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🔧 Corrigiendo ubicaciones con nombres incorrectos...');
    
    for (const [nombre, correccion] of Object.entries(CORRECCIONES)) {
      console.log(`\n📍 Corrigiendo: ${nombre}`);
      console.log(`   🎯 ${correccion.descripcion}`);
      
      // Obtener ubicación actual
      const actual = await client.query(
        'SELECT * FROM tracking_locations_cache WHERE name = $1',
        [nombre]
      );
      
      if (actual.rows.length === 0) {
        console.log(`   ❌ No encontrada: ${nombre}`);
        continue;
      }
      
      const ubicacionActual = actual.rows[0];
      console.log(`   📍 Actual: ${ubicacionActual.latitude}, ${ubicacionActual.longitude} (${ubicacionActual.address})`);
      console.log(`   📍 Nueva: ${correccion.latitud}, ${correccion.longitud} (${correccion.direccion})`);
      
      // Actualizar coordenadas
      await client.query(`
        UPDATE tracking_locations_cache 
        SET 
          latitude = $1,
          longitude = $2,
          address = $3,
          synced_at = NOW()
        WHERE name = $4
      `, [
        correccion.latitud,
        correccion.longitud,
        correccion.direccion,
        nombre
      ]);
      
      console.log(`   ✅ Actualizada correctamente`);
      console.log(`   🌐 Verificar en: https://www.google.com/maps/@${correccion.latitud},${correccion.longitud},17z`);
    }
    
    // Verificación final
    console.log('\n📊 Verificación final:');
    const resultado = await client.query(`
      SELECT name, latitude, longitude, address 
      FROM tracking_locations_cache 
      WHERE name IN ('38 - Gomez Morin', '26 - Cadereyta')
      ORDER BY name
    `);
    
    resultado.rows.forEach(row => {
      console.log(`✅ ${row.name}`);
      console.log(`   📍 ${row.latitude}, ${row.longitude}`);
      console.log(`   📧 ${row.address}`);
    });
    
    console.log('\n🎉 Correcciones aplicadas. Las ubicaciones ahora coinciden con sus nombres.');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  corregirUbicaciones()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = corregirUbicaciones;