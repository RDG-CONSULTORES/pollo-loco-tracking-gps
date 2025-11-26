require('dotenv').config();
const { Pool } = require('pg');

async function verifyGroupsAndIds() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 VERIFICANDO GRUPOS OPERATIVOS Y IDS...\n');
    
    // 1. Verificar todas las sucursales con sus grupos
    console.log('📊 TODAS LAS SUCURSALES CON GRUPOS OPERATIVOS:');
    const allBranches = await pool.query(`
      SELECT 
        id, name, city, state, 
        operational_group, region, subregion,
        latitude, longitude
      FROM branches 
      WHERE active = true 
      ORDER BY CAST(SUBSTRING(name FROM '^([0-9]+)') AS INTEGER)
    `);
    
    console.log('ID_DB | Num | Nombre | Ciudad | Estado | Grupo Actual | Coordenadas');
    console.log('------|-----|--------|--------|--------|--------------|-------------');
    
    // Mapear grupos operativos correctos
    const correctGroups = {
      'Monterrey': 'MONTERREY CENTRO',
      'Guadalupe': 'GUADALUPE', 
      'San Nicolás de los Garza': 'SAN NICOLAS',
      'Santa Catarina': 'SANTA CATARINA',
      'General Escobedo': 'ESCOBEDO',
      'García': 'GARCIA',
      'Apodaca': 'APODACA',
      'Saltillo': 'SALTILLO',
      'Torreón': 'TORREON', 
      'Tampico': 'TAMPICO',
      'Matamoros': 'MATAMOROS',
      'Reynosa': 'REYNOSA',
      'Nuevo Laredo': 'NUEVO LAREDO',
      'Querétaro': 'QUERETARO',
      'Morelia': 'MICHOACAN',
      'Guasave': 'SINALOA',
      'Durango': 'DURANGO'
    };
    
    let inconsistencies = 0;
    
    allBranches.rows.forEach(branch => {
      // Extraer número de sucursal del nombre
      const branchNumber = branch.name.match(/^(\d+)/)?.[1] || '?';
      const expectedGroup = correctGroups[branch.city] || `${branch.state.toUpperCase()}`;
      const hasIssue = branch.operational_group !== expectedGroup;
      
      if (hasIssue) inconsistencies++;
      
      const statusIcon = hasIssue ? '❌' : '✅';
      console.log(`${statusIcon} ${branch.id.toString().padStart(3)} | ${branchNumber.padStart(3)} | ${branch.name.substring(0,15).padEnd(15)} | ${branch.city.substring(0,10).padEnd(10)} | ${branch.state.substring(0,8).padEnd(8)} | ${(branch.operational_group || 'SIN_GRUPO').padEnd(12)} | ${branch.latitude ? branch.latitude.toFixed(6) : 'N/A'}, ${branch.longitude ? branch.longitude.toFixed(6) : 'N/A'}`);
    });
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`   Total sucursales: ${allBranches.rows.length}`);
    console.log(`   Grupos incorrectos: ${inconsistencies}`);
    
    // 2. Verificar secuencia de números de sucursal
    console.log(`\n🔢 VERIFICANDO SECUENCIA DE NÚMEROS:`);
    const branchNumbers = allBranches.rows.map(b => {
      const num = parseInt(b.name.match(/^(\d+)/)?.[1] || '0');
      return { db_id: b.id, branch_num: num, name: b.name };
    }).sort((a, b) => a.branch_num - b.branch_num);
    
    console.log('Num | ID_DB | Nombre');
    console.log('----|-------|--------');
    
    let missing = [];
    for (let i = 1; i <= 85; i++) {
      const found = branchNumbers.find(b => b.branch_num === i);
      if (found) {
        console.log(`${i.toString().padStart(3)} | ${found.db_id.toString().padStart(5)} | ${found.name}`);
      } else {
        missing.push(i);
        console.log(`${i.toString().padStart(3)} | ❌    | FALTA`);
      }
    }
    
    if (missing.length > 0) {
      console.log(`\n⚠️ NÚMEROS FALTANTES: ${missing.join(', ')}`);
    }
    
    // 3. Verificar las 3 nuevas específicamente
    console.log(`\n🆕 VERIFICANDO LAS 3 NUEVAS SUCURSALES (83, 84, 85):`);
    const newOnes = await pool.query(`
      SELECT id, name, city, state, operational_group, zenput_id, latitude, longitude
      FROM branches 
      WHERE name LIKE '%83 -%' OR name LIKE '%84 -%' OR name LIKE '%85 -%'
      ORDER BY name
    `);
    
    newOnes.rows.forEach(branch => {
      console.log(`   🏪 ${branch.name}`);
      console.log(`      DB ID: ${branch.id} | Zenput: ${branch.zenput_id}`);
      console.log(`      Ciudad: ${branch.city}, ${branch.state}`);
      console.log(`      Grupo actual: ${branch.operational_group || 'SIN_GRUPO'}`);
      console.log(`      Coordenadas: ${branch.latitude}, ${branch.longitude}\n`);
    });
    
    return { 
      success: true, 
      total: allBranches.rows.length, 
      inconsistencies,
      missing: missing.length 
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

verifyGroupsAndIds();