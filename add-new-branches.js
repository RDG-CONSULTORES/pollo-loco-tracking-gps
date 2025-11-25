require('dotenv').config();
const db = require('./src/config/database');

// =====================================================
// 🎯 TEMPLATE PARA LAS 3 NUEVAS SUCURSALES EPL CAS
// =====================================================
// Roberto: Reemplaza los datos de ejemplo con la información real
// 
// 📊 ESTADO ACTUAL DEL SISTEMA:
// • Total sucursales: 82 (confirmado)
// • Estados cubiertos: 7 (Nuevo León, Tamaulipas, Coahuila, Querétaro, Michoacán, Durango, Sinaloa)
// • Próximos IDs disponibles: 93, 94, 95 (o usar gaps: 11-17, 72-74)
// 
// 🗺️ GRUPOS OPERATIVOS DISPONIBLES (usar group_name exacto):
// 1. GRUPO MONTERREY CENTRO
// 2. GRUPO MONTERREY SUR  
// 3. GRUPO MONTERREY NORTE
// 4. GRUPO GUADALUPE
// 5. GRUPO APODACA
// 6. RAP
// 7. CRR
// 8. GRUPO ESCOBEDO
// 9. GRUPO SANTA CATARINA
// 10. GRUPO SAN NICOLÁS
// 11. GRUPO CADEREYTA
// 12. GRUPO LINARES
// 13. GRUPO GARCÍA
// 14. GRUPO GENERAL BRAVO
// 15. GRUPO SANTIAGO
// 16. GRUPO MONTEMORELOS
// 17. GRUPO ALLENDE
// 18. GRUPO RÍO BRAVO
// 19. GRUPO NUEVO LAREDO (RUELAS)
// 20. GRUPO CERRALVO

const newBranches = [
  {
    // === SUCURSAL 1 ===
    name: "Nombre de la Sucursal 1", // Ejemplo: "Plaza Sendero"
    city: "Ciudad",                  // Ejemplo: "Monterrey"
    state: "Estado",                 // Usar uno existente: Nuevo León, Tamaulipas, etc.
    municipality: "Municipio",       // Ejemplo: "Monterrey"
    group_name: "GRUPO_EXACTO",     // Copiar exacto de la lista arriba
    address: "Dirección completa de Google Maps", // Ejemplo: "Av. Revolución #123, Col. Centro"
    
    // 🗺️ COORDENADAS DE GOOGLE MAPS (CRÍTICO - Usar coordenadas exactas)
    // 1. Ir a Google Maps
    // 2. Buscar la dirección exacta
    // 3. Click derecho en el pin
    // 4. Copiar las coordenadas (primer número = latitud, segundo = longitud)
    latitude: 25.6866,   // ⚠️ REEMPLAZAR con latitud real
    longitude: -100.3161, // ⚠️ REEMPLAZAR con longitud real
    
    phone: "+52 81 XXXX-XXXX",      // Teléfono local de la sucursal
    email: "sucursalX@eplcas.com"   // Email corporativo
  },
  
  {
    // === SUCURSAL 2 ===
    name: "Nombre de la Sucursal 2",
    city: "Ciudad",
    state: "Estado", 
    municipality: "Municipio",
    group_name: "GRUPO_EXACTO",
    address: "Dirección completa de Google Maps",
    latitude: 25.6866,   // ⚠️ COORDENADAS REALES REQUERIDAS
    longitude: -100.3161, // ⚠️ COORDENADAS REALES REQUERIDAS
    phone: "+52 81 XXXX-XXXX",
    email: "sucursalX@eplcas.com"
  },
  
  {
    // === SUCURSAL 3 ===
    name: "Nombre de la Sucursal 3",
    city: "Ciudad",
    state: "Estado",
    municipality: "Municipio", 
    group_name: "GRUPO_EXACTO",
    address: "Dirección completa de Google Maps",
    latitude: 25.6866,   // ⚠️ COORDENADAS REALES REQUERIDAS
    longitude: -100.3161, // ⚠️ COORDENADAS REALES REQUERIDAS
    phone: "+52 81 XXXX-XXXX",
    email: "sucursalX@eplcas.com"
  }
];

async function addNewBranches() {
  console.log('🆕 AÑADIENDO 3 NUEVAS SUCURSALES EPL CAS...\n');
  
  try {
    // 1. Verificar grupos operativos existentes
    const groupsResult = await db.query('SELECT id, name FROM operational_groups ORDER BY name');
    
    console.log('📋 GRUPOS OPERATIVOS DISPONIBLES:');
    groupsResult.rows.forEach(group => {
      console.log(`  ID ${group.id}: ${group.name}`);
    });
    console.log('');

    // 2. Obtener siguiente ID disponible
    const maxIdResult = await db.query('SELECT MAX(id) as max_id FROM branches');
    let nextId = (maxIdResult.rows[0].max_id || 82) + 1;

    console.log(`🔢 Próximo ID disponible: ${nextId}`);
    console.log('');

    // 3. Validar coordenadas (México)
    console.log('🔍 VALIDANDO COORDENADAS...');
    for (const branch of newBranches) {
      const lat = parseFloat(branch.latitude);
      const lng = parseFloat(branch.longitude);
      
      if (lat < 14.5 || lat > 32.7 || lng < -118.5 || lng > -86.7) {
        console.error(`❌ Coordenadas inválidas para ${branch.name}: ${lat}, ${lng}`);
        console.error('   Las coordenadas deben estar en territorio mexicano');
        process.exit(1);
      }
      
      console.log(`✅ ${branch.name}: ${lat}, ${lng} (válido)`);
    }
    console.log('');

    // 4. Encontrar group_id para cada sucursal
    console.log('🔍 ASIGNANDO GRUPOS...');
    for (const branch of newBranches) {
      const group = groupsResult.rows.find(g => 
        g.name.toLowerCase().includes(branch.group_name.toLowerCase()) ||
        branch.group_name.toLowerCase().includes(g.name.toLowerCase())
      );
      
      if (group) {
        branch.group_id = group.id;
        console.log(`✅ ${branch.name} → Grupo: ${group.name} (ID: ${group.id})`);
      } else {
        console.warn(`⚠️ Grupo no encontrado para ${branch.name}: ${branch.group_name}`);
        console.log('   Asignando grupo por defecto (ID: 1)');
        branch.group_id = 1;
      }
    }
    console.log('');

    // 5. PREVISUALIZACIÓN (no inserta aún)
    console.log('👀 PREVISUALIZACIÓN DE INSERCIÓN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    newBranches.forEach((branch, index) => {
      console.log(`${nextId + index}. ${branch.name}`);
      console.log(`   📍 ${branch.city}, ${branch.state}`);
      console.log(`   🌎 ${branch.latitude}, ${branch.longitude}`);
      console.log(`   🏢 Grupo: ${branch.group_name} (ID: ${branch.group_id})`);
      console.log(`   📧 ${branch.email}`);
      console.log(`   🗺️ Google Maps: https://maps.google.com/?q=${branch.latitude},${branch.longitude}`);
      console.log('');
    });

    console.log('⚠️ ESTO ES UNA PREVISUALIZACIÓN');
    console.log('📝 Para insertar realmente, edita el archivo con los datos correctos');
    console.log('   y descomenta la línea "await insertBranches()" al final');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function insertBranches() {
  console.log('📝 INSERTANDO SUCURSALES EN BASE DE DATOS...');
  
  try {
    const maxIdResult = await db.query('SELECT MAX(id) as max_id FROM branches');
    let nextId = (maxIdResult.rows[0].max_id || 82) + 1;
    
    for (const [index, branch] of newBranches.entries()) {
      const branchId = nextId + index;
      
      await db.query(`
        INSERT INTO branches (
          id, name, city, state, municipality, 
          group_id, group_name, address,
          latitude, longitude,
          phone, email,
          country, active, gps_validated,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
        )
      `, [
        branchId,
        branch.name,
        branch.city, 
        branch.state,
        branch.municipality,
        branch.group_id,
        branch.group_name,
        branch.address,
        branch.latitude,
        branch.longitude, 
        branch.phone,
        branch.email,
        'México',
        true, // active
        true  // gps_validated
      ]);
      
      console.log(`✅ Insertada: ${branchId}. ${branch.name}`);
    }
    
    console.log('🎉 ¡3 nuevas sucursales añadidas exitosamente!');
    
    // Verificar total
    const totalResult = await db.query('SELECT COUNT(*) as total FROM branches');
    console.log(`📊 Total sucursales ahora: ${totalResult.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Error insertando:', error.message);
    throw error;
  }
}

// EJECUCIÓN
addNewBranches();

// PARA INSERTAR REALMENTE, DESCOMENTA LA SIGUIENTE LÍNEA:
// insertBranches();