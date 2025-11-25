require('dotenv').config();
const db = require('./src/config/database');

/**
 * INTEGRACIÓN DE LAS 3 NUEVAS SUCURSALES CON VALIDACIÓN DE COORDENADAS
 * Step 1: Integrar con direcciones conocidas
 * Step 2: Buscar coordenadas en Google Maps (manual)
 * Step 3: Actualizar coordenadas
 */

// Las 3 nuevas sucursales encontradas en Zenput
const newBranches = [
  {
    zenput_id: 2260766,
    name: "83 - Cerradas de Anahuac", 
    city: "Ciudad General Escobedo",
    state: "Nuevo León",
    municipality: "General Escobedo",
    address: "401 Avenida Concordia",
    phone: "+52 81 0000-0001", // Placeholder
    email: "sucursal83@eplcas.com"
  },
  {
    zenput_id: 2260636,
    name: "84 - Aeropuerto del Norte",
    city: "Ciénega de Flores", 
    state: "Nuevo León",
    municipality: "Ciénega de Flores",
    address: "Km. 23.2 Autopista Monterrey - Nuevo Laredo",
    phone: "+52 81 0000-0002", // Placeholder
    email: "sucursal84@eplcas.com"
  },
  {
    zenput_id: 2260765,
    name: "85 - Diego Diaz",
    city: "San Nicolás de los Garza",
    state: "Nuevo León", 
    municipality: "San Nicolás de los Garza",
    address: "198 Avenida Diego Díaz de Berlanga",
    phone: "+52 81 0000-0003", // Placeholder
    email: "sucursal85@eplcas.com"
  }
];

async function integrate3NewBranches() {
  console.log('🔄 INTEGRACIÓN DE LAS 3 NUEVAS SUCURSALES EPL CAS\n');
  
  try {
    // 1. Verificar estado actual
    const currentCount = await db.query('SELECT COUNT(*) as total FROM branches WHERE active = true');
    console.log(`📊 Sucursales actuales en BD: ${currentCount.rows[0].total}`);
    
    // 2. Obtener siguiente ID disponible
    const maxIdResult = await db.query('SELECT MAX(id) as max_id FROM branches');
    const nextId = (maxIdResult.rows[0].max_id || 82) + 1;
    console.log(`🔢 Próximo ID disponible: ${nextId}`);
    
    // 3. Obtener grupos operativos disponibles para asignación
    const groupsResult = await db.query('SELECT id, name FROM operational_groups ORDER BY name');
    console.log(`🏢 Grupos operativos disponibles: ${groupsResult.rows.length}`);
    
    // Mostrar grupos disponibles
    console.log('\n📋 GRUPOS OPERATIVOS PARA ASIGNACIÓN:');
    groupsResult.rows.forEach(group => {
      console.log(`  ${group.id}. ${group.name}`);
    });
    
    // 4. Asignar grupo basado en ubicación (todas están en Nuevo León)
    const nuevoLeonGroups = groupsResult.rows.filter(g => 
      g.name.toLowerCase().includes('monterrey') ||
      g.name.toLowerCase().includes('escobedo') ||
      g.name.toLowerCase().includes('san nicolás') ||
      g.name.toLowerCase().includes('garcía') ||
      g.name.toLowerCase().includes('guadalupe') ||
      g.name.toLowerCase().includes('apodaca')
    );
    
    console.log('\n🎯 GRUPOS DE NUEVO LEÓN DETECTADOS:');
    nuevoLeonGroups.forEach(group => {
      console.log(`  ${group.id}. ${group.name}`);
    });
    
    // Usar el primer grupo de Nuevo León o grupo 1 por defecto
    const defaultGroupId = nuevoLeonGroups.length > 0 ? nuevoLeonGroups[0].id : 1;
    const defaultGroupName = nuevoLeonGroups.length > 0 ? nuevoLeonGroups[0].name : 'TEPEYAC';
    
    console.log(`\n🏷️ Grupo asignado por defecto: ${defaultGroupName} (ID: ${defaultGroupId})`);
    
    // 5. Mostrar previsualización
    console.log('\n👀 PREVISUALIZACIÓN DE INSERCIÓN:');
    console.log('━'.repeat(70));
    
    newBranches.forEach((branch, index) => {
      const branchId = nextId + index;
      console.log(`${branchId}. ${branch.name}`);
      console.log(`   📍 ${branch.address}`);
      console.log(`   🏙️ ${branch.city}, ${branch.state}`);
      console.log(`   🏢 Grupo: ${defaultGroupName} (ID: ${defaultGroupId})`);
      console.log(`   🆔 Zenput ID: ${branch.zenput_id}`);
      console.log(`   📧 ${branch.email}`);
      console.log(`   ⚠️ Coordenadas: Por determinar con Google Maps`);
      console.log('');
    });
    
    // 6. Direcciones para buscar en Google Maps
    console.log('\n🗺️ DIRECCIONES PARA GOOGLE MAPS:');
    console.log('━'.repeat(70));
    console.log('📋 Copia estas direcciones y busca en Google Maps:');
    console.log('');
    
    newBranches.forEach((branch, index) => {
      const fullAddress = `${branch.address}, ${branch.city}, ${branch.state}, México`;
      console.log(`${index + 1}. ${branch.name}`);
      console.log(`   🔍 Buscar: "${fullAddress}"`);
      console.log(`   📝 Luego: Click derecho → Copiar coordenadas`);
      console.log('');
    });
    
    // 7. Confirmar inserción
    console.log('❓ CONFIRMAR INSERCIÓN:');
    console.log('━'.repeat(70));
    console.log('🎯 ¿Proceder con la inserción de las 3 nuevas sucursales?');
    console.log('   • Se insertarán SIN coordenadas inicialmente');
    console.log('   • Coordenadas se actualizarán después con Google Maps');
    console.log('   • Total después: 85 sucursales');
    console.log('');
    console.log('✅ Para confirmar: Ejecuta con --confirm');
    console.log('   node integrate-3-new-branches.js --confirm');
    
    // Solo insertar si se pasa flag --confirm
    if (process.argv.includes('--confirm')) {
      console.log('\n🚀 INSERTANDO SUCURSALES...');
      await insertNewBranches(nextId, defaultGroupId, defaultGroupName);
    } else {
      console.log('\n⏸️ INSERCIÓN PAUSADA - Esperando confirmación');
    }
    
  } catch (error) {
    console.error('❌ Error en integración:', error.message);
    throw error;
  }
}

async function insertNewBranches(nextId, groupId, groupName) {
  console.log('📝 Insertando en base de datos...');
  
  try {
    for (const [index, branch] of newBranches.entries()) {
      const branchId = nextId + index;
      
      await db.query(`
        INSERT INTO branches (
          id, name, city, state, municipality,
          group_id, group_name, address,
          latitude, longitude,
          phone, email, zenput_id,
          country, active, gps_validated,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
        )
      `, [
        branchId,
        branch.name,
        branch.city,
        branch.state, 
        branch.municipality,
        groupId,
        groupName,
        branch.address,
        null, // latitude - se actualizará después
        null, // longitude - se actualizará después
        branch.phone,
        branch.email,
        branch.zenput_id,
        'México',
        true, // active
        false // gps_validated - será true después de agregar coordenadas
      ]);
      
      console.log(`✅ ${branchId}. ${branch.name} - Insertada`);
    }
    
    // Verificar nuevo total
    const newCount = await db.query('SELECT COUNT(*) as total FROM branches WHERE active = true');
    console.log(`\n🎉 INSERCIÓN COMPLETADA!`);
    console.log(`📊 Nuevo total de sucursales: ${newCount.rows[0].total}`);
    
    console.log('\n📝 SIGUIENTES PASOS:');
    console.log('1. ✅ Sucursales insertadas exitosamente');
    console.log('2. 🗺️ Buscar coordenadas en Google Maps');
    console.log('3. 📊 Actualizar coordenadas en BD');
    console.log('4. ✅ Validar sistema completo');
    
  } catch (error) {
    console.error('❌ Error insertando:', error.message);
    throw error;
  }
}

// Función para mostrar instrucciones de Google Maps
function showGoogleMapsInstructions() {
  console.log('\n🗺️ INSTRUCCIONES GOOGLE MAPS:');
  console.log('━'.repeat(70));
  console.log('1. Abre https://maps.google.com');
  console.log('2. Busca cada dirección:');
  
  newBranches.forEach((branch, index) => {
    const fullAddress = `${branch.address}, ${branch.city}, ${branch.state}, México`;
    console.log(`   ${index + 1}. "${fullAddress}"`);
  });
  
  console.log('\n3. Para cada resultado:');
  console.log('   • Click derecho en el pin rojo');
  console.log('   • Seleccionar "¿Qué hay aquí?"');
  console.log('   • Copiar las coordenadas (formato: 25.123456, -100.123456)');
  console.log('\n4. Después ejecutar script de actualización de coordenadas');
}

// Ejecutar
async function main() {
  await integrate3NewBranches();
  
  if (!process.argv.includes('--confirm')) {
    showGoogleMapsInstructions();
  }
  
  process.exit(0);
}

main();