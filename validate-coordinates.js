require('dotenv').config();
const db = require('./src/config/database');

async function validateCoordinates() {
  console.log('🔍 VALIDANDO COORDENADAS EPL CAS...\n');
  
  try {
    // 1. Obtener todas las coordenadas
    const result = await db.query(`
      SELECT 
        id, name, city, state, municipality,
        latitude, longitude,
        group_id, group_name
      FROM branches 
      WHERE latitude IS NOT NULL 
      ORDER BY group_name, name
    `);
    
    console.log(`📊 Total sucursales con coordenadas: ${result.rows.length}\n`);
    
    // 2. Validar rangos México
    const invalidCoords = result.rows.filter(branch => {
      const lat = parseFloat(branch.latitude);
      const lng = parseFloat(branch.longitude);
      
      // México: Lat 14.5 a 32.7, Lng -118.5 a -86.7
      return lat < 14.5 || lat > 32.7 || lng < -118.5 || lng > -86.7;
    });
    
    if (invalidCoords.length > 0) {
      console.log('❌ COORDENADAS FUERA DE MÉXICO:');
      invalidCoords.forEach(branch => {
        console.log(`  ${branch.name}: ${branch.latitude}, ${branch.longitude}`);
      });
    } else {
      console.log('✅ Todas las coordenadas están en territorio mexicano');
    }
    
    // 3. Agrupar por estado/región
    const byRegion = {};
    result.rows.forEach(branch => {
      const region = branch.state || branch.city || 'Sin Estado';
      if (!byRegion[region]) byRegion[region] = [];
      byRegion[region].push(branch);
    });
    
    console.log('\n📍 DISTRIBUCIÓN POR REGIÓN:');
    Object.keys(byRegion).forEach(region => {
      console.log(`  ${region}: ${byRegion[region].length} sucursales`);
      
      // Mostrar rango de coordenadas por región
      const lats = byRegion[region].map(b => parseFloat(b.latitude));
      const lngs = byRegion[region].map(b => parseFloat(b.longitude));
      
      console.log(`    Lat: ${Math.min(...lats).toFixed(3)} a ${Math.max(...lats).toFixed(3)}`);
      console.log(`    Lng: ${Math.min(...lngs).toFixed(3)} a ${Math.max(...lngs).toFixed(3)}`);
    });
    
    // 4. Detectar duplicados
    console.log('\n🔍 VERIFICANDO DUPLICADOS...');
    const coordMap = new Map();
    const duplicates = [];
    
    result.rows.forEach(branch => {
      const coordKey = `${branch.latitude},${branch.longitude}`;
      if (coordMap.has(coordKey)) {
        duplicates.push({
          coord: coordKey,
          branches: [coordMap.get(coordKey), branch.name]
        });
      } else {
        coordMap.set(coordKey, branch.name);
      }
    });
    
    if (duplicates.length > 0) {
      console.log('⚠️ COORDENADAS DUPLICADAS:');
      duplicates.forEach(dup => {
        console.log(`  ${dup.coord}: ${dup.branches.join(', ')}`);
      });
    } else {
      console.log('✅ No hay coordenadas duplicadas');
    }
    
    // 5. Reporte detallado
    console.log('\n📋 REPORTE DETALLADO (primeras 10):');
    result.rows.slice(0, 10).forEach((branch, i) => {
      console.log(`${i+1}. ${branch.name} (${branch.city})`);
      console.log(`   Grupo: ${branch.group_name}`);
      console.log(`   Coords: ${branch.latitude}, ${branch.longitude}`);
      console.log(`   Google Maps: https://maps.google.com/?q=${branch.latitude},${branch.longitude}`);
      console.log('');
    });
    
    // 6. Verificar si están todas en Nuevo León/Monterrey
    console.log('\n🌎 ANÁLISIS GEOGRÁFICO:');
    
    const monterreyCenter = { lat: 25.6866, lng: -100.3161 };
    
    result.rows.forEach(branch => {
      const lat = parseFloat(branch.latitude);
      const lng = parseFloat(branch.longitude);
      
      // Calcular distancia aproximada de Monterrey centro
      const distance = Math.sqrt(
        Math.pow((lat - monterreyCenter.lat) * 111, 2) +
        Math.pow((lng - monterreyCenter.lng) * 111 * Math.cos(lat * Math.PI / 180), 2)
      );
      
      branch.distanceFromMty = distance;
    });
    
    const farFromMty = result.rows.filter(b => b.distanceFromMty > 100); // +100km de Monterrey
    
    if (farFromMty.length > 0) {
      console.log('🚨 SUCURSALES LEJANAS DE MONTERREY (+100km):');
      farFromMty.forEach(branch => {
        console.log(`  ${branch.name}: ${branch.distanceFromMty.toFixed(1)}km`);
        console.log(`    ${branch.latitude}, ${branch.longitude}`);
      });
    } else {
      console.log('✅ Todas las sucursales están cerca de Monterrey (<100km)');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

validateCoordinates();