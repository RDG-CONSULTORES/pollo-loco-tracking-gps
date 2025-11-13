const { Client } = require('pg');

/**
 * Verificar estructura real de grupos desde Neon
 */
async function verifyGruposEstructura() {
  let neonClient;
  
  try {
    console.log('🔍 Verificando estructura real de grupos desde Neon...');
    
    // Conectar a Neon
    neonClient = new Client({
      connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    
    await neonClient.connect();
    console.log('✅ Conectado a Neon');
    
    // Consultar estructura completa por grupo operativo
    const gruposResult = await neonClient.query(`
      SELECT 
        grupo_operativo_limpio,
        estado_normalizado,
        municipio,
        location_name,
        COUNT(*) as total_supervisiones,
        MIN(fecha_supervision) as primera_fecha,
        MAX(fecha_supervision) as ultima_fecha
      FROM supervision_operativa_clean
      WHERE grupo_operativo_limpio IS NOT NULL 
        AND grupo_operativo_limpio != 'REQUIERE_MAPEO_MANUAL'
        AND location_name IS NOT NULL
      GROUP BY grupo_operativo_limpio, estado_normalizado, municipio, location_name
      ORDER BY grupo_operativo_limpio, estado_normalizado, municipio, location_name
    `);
    
    console.log(`\n📊 Encontrados ${gruposResult.rows.length} registros únicos`);
    
    // Organizar por grupo operativo
    const gruposOrganizados = {};
    gruposResult.rows.forEach(row => {
      const grupo = row.grupo_operativo_limpio;
      if (!gruposOrganizados[grupo]) {
        gruposOrganizados[grupo] = {};
      }
      
      const estado = row.estado_normalizado;
      if (!gruposOrganizados[grupo][estado]) {
        gruposOrganizados[grupo][estado] = {};
      }
      
      const municipio = row.municipio;
      if (!gruposOrganizados[grupo][estado][municipio]) {
        gruposOrganizados[grupo][estado][municipio] = [];
      }
      
      gruposOrganizados[grupo][estado][municipio].push({
        sucursal: row.location_name,
        supervisiones: row.total_supervisiones,
        periodo: `${row.primera_fecha} - ${row.ultima_fecha}`
      });
    });
    
    // Mostrar estructura completa
    console.log('\n🏢 ESTRUCTURA COMPLETA POR GRUPOS OPERATIVOS:\n');
    
    Object.entries(gruposOrganizados).forEach(([grupo, estados]) => {
      console.log(`📋 GRUPO: ${grupo}`);
      console.log('='.repeat(50));
      
      Object.entries(estados).forEach(([estado, municipios]) => {
        console.log(`  🏛️  Estado: ${estado}`);
        
        Object.entries(municipios).forEach(([municipio, sucursales]) => {
          console.log(`    📍 Municipio: ${municipio} (${sucursales.length} sucursales)`);
          
          sucursales.forEach(sucursal => {
            console.log(`      - ${sucursal.sucursal} (${sucursal.supervisiones} supervisiones)`);
          });
        });
        console.log('');
      });
      console.log('\n');
    });
    
    // Resumen estadístico
    console.log('📊 RESUMEN ESTADÍSTICO:');
    console.log('='.repeat(40));
    
    Object.entries(gruposOrganizados).forEach(([grupo, estados]) => {
      let totalSucursales = 0;
      let totalEstados = Object.keys(estados).length;
      let totalMunicipios = 0;
      
      Object.values(estados).forEach(municipios => {
        totalMunicipios += Object.keys(municipios).length;
        Object.values(municipios).forEach(sucursales => {
          totalSucursales += sucursales.length;
        });
      });
      
      console.log(`${grupo}:`);
      console.log(`  - ${totalSucursales} sucursales`);
      console.log(`  - ${totalEstados} estados`);
      console.log(`  - ${totalMunicipios} municipios`);
      console.log('');
    });
    
    console.log('✅ Verificación completada');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    if (neonClient) await neonClient.end();
  }
}

// Ejecutar
if (require.main === module) {
  verifyGruposEstructura()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = verifyGruposEstructura;