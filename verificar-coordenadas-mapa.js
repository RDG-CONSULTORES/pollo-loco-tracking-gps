require('dotenv').config();
const { Client } = require('pg');

/**
 * Script para verificar coordenadas visualmente
 * Genera URLs de Google Maps para revisión manual
 */

async function verificarCoordenadasMapa() {
  console.log('🗺️ VERIFICACIÓN VISUAL DE COORDENADAS');
  console.log('Generando enlaces de Google Maps para verificación');
  console.log('='.repeat(60));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // Obtener todas las sucursales con coordenadas
    const sucursales = await client.query(`
      SELECT 
        location_code,
        name,
        group_name,
        latitude,
        longitude,
        active
      FROM tracking_locations_cache 
      ORDER BY group_name, CAST(location_code AS INTEGER)
    `);
    
    console.log(`📊 Total de sucursales: ${sucursales.rows.length}\n`);
    
    // Agrupar por región para verificación organizada
    const gruposPorRegion = {
      'Monterrey (TEPEYAC/OGAS/TEC)': [],
      'Área Metropolitana (EFM/EPL/PLOG)': [],
      'Foráneas (EXPO/Tampico/Morelia)': [],
      'Otros Estados': []
    };
    
    sucursales.rows.forEach(suc => {
      const lat = parseFloat(suc.latitude);
      const lng = parseFloat(suc.longitude);
      
      const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const streetViewUrl = `https://www.google.com/maps/@${lat},${lng},3a,75y,90t/data=!3m1!1e3`;
      
      const sucursalInfo = {
        codigo: suc.location_code,
        nombre: suc.name,
        grupo: suc.group_name,
        coordenadas: `${lat}, ${lng}`,
        googleMaps: googleMapsUrl,
        streetView: streetViewUrl,
        lat,
        lng
      };
      
      // Clasificar por región
      if (lat >= 25.65 && lat <= 25.75 && lng >= -100.35 && lng <= -100.25) {
        gruposPorRegion['Monterrey (TEPEYAC/OGAS/TEC)'].push(sucursalInfo);
      } else if (lat >= 25.6 && lat <= 25.8 && lng >= -100.5 && lng <= -100.1) {
        gruposPorRegion['Área Metropolitana (EFM/EPL/PLOG)'].push(sucursalInfo);
      } else if (lat >= 19 && lat <= 27 && lng >= -108 && lng <= -97) {
        gruposPorRegion['Foráneas (EXPO/Tampico/Morelia)'].push(sucursalInfo);
      } else {
        gruposPorRegion['Otros Estados'].push(sucursalInfo);
      }
    });
    
    // Mostrar verificación por regiones
    Object.entries(gruposPorRegion).forEach(([region, sucursales]) => {
      if (sucursales.length === 0) return;
      
      console.log(`\n🏢 ${region.toUpperCase()}`);
      console.log('='.repeat(50));
      
      sucursales.slice(0, 5).forEach((suc, index) => {
        console.log(`${index + 1}. [${suc.codigo}] ${suc.nombre}`);
        console.log(`   🏢 Grupo: ${suc.grupo}`);
        console.log(`   📍 Coordenadas: ${suc.coordenadas}`);
        console.log(`   🗺️ Google Maps: ${suc.googleMaps}`);
        console.log(`   👁️ Street View: ${suc.streetView}`);
        console.log('');
      });
      
      if (sucursales.length > 5) {
        console.log(`   ... y ${sucursales.length - 5} más en esta región\n`);
      }
    });
    
    // Generar verificación rápida de muestra
    console.log('\n🎯 VERIFICACIÓN RÁPIDA - SUCURSALES PRINCIPALES:');
    console.log('='.repeat(50));
    
    const muestraVerificacion = [
      { codigo: '2247000', nombre: 'Pino Suarez' },
      { codigo: '2247003', nombre: 'Santa Catarina' },  
      { codigo: '2247005', nombre: 'Garcia' },
      { codigo: '2247022', nombre: 'Guasave' },
      { codigo: '2247057', nombre: 'Universidad Tampico' }
    ];
    
    for (const muestra of muestraVerificacion) {
      const suc = sucursales.rows.find(s => s.location_code === muestra.codigo);
      if (suc) {
        const lat = parseFloat(suc.latitude);
        const lng = parseFloat(suc.longitude);
        console.log(`✅ ${muestra.nombre}: ${lat}, ${lng}`);
        console.log(`   🔗 https://www.google.com/maps?q=${lat},${lng}`);
      }
    }
    
    console.log('\n💡 CÓMO VERIFICAR:');
    console.log('='.repeat(20));
    console.log('1. 🖱️ Haz clic en cualquier enlace de Google Maps');
    console.log('2. 🏪 Verifica que aparezca "El Pollo Loco" en esa ubicación');
    console.log('3. 📍 Confirma que la dirección coincida con el nombre de la sucursal');
    console.log('4. 🔍 Usa Street View para ver el restaurante físicamente');
    
    // Detectar coordenadas sospechosas
    console.log('\n⚠️ ANÁLISIS DE COORDENADAS SOSPECHOSAS:');
    console.log('='.repeat(40));
    
    const coordenadasSospechosas = sucursales.rows.filter(suc => {
      const lat = parseFloat(suc.latitude);
      const lng = parseFloat(suc.longitude);
      
      // Detectar coordenadas fuera de México o en océano
      return (
        lat < 14 || lat > 33 ||  // Fuera de latitud de México
        lng < -118 || lng > -86 || // Fuera de longitud de México
        (lat === 0 && lng === 0) // Coordenadas por defecto
      );
    });
    
    if (coordenadasSospechosas.length > 0) {
      console.log(`🚨 Encontradas ${coordenadasSospechosas.length} coordenadas sospechosas:`);
      coordenadasSospechosas.forEach(suc => {
        console.log(`   ❌ [${suc.location_code}] ${suc.name}: ${suc.latitude}, ${suc.longitude}`);
      });
    } else {
      console.log('✅ Todas las coordenadas están dentro de rangos válidos para México');
    }

  } catch (error) {
    console.error('❌ Error durante verificación:', error.message);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  verificarCoordenadasMapa()
    .then(() => {
      console.log('\n✅ Verificación completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { verificarCoordenadasMapa };