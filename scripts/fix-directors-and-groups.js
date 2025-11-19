const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function fixDirectorsAndGroups() {
  console.log('🔧 Corrigiendo directores y grupos operativos...');
  
  try {
    // 1. Limpiar directores existentes y recrear con grupos reales
    console.log('🧹 Limpiando directores existentes...');
    await pool.query('DELETE FROM directors WHERE director_code LIKE \'DIR_%\'');

    // 2. Obtener grupos reales del sistema
    const realGroups = await pool.query(`
      SELECT DISTINCT group_name 
      FROM tracking_locations_cache 
      WHERE group_name IS NOT NULL AND group_name != ''
      ORDER BY group_name
    `);

    console.log('📊 Grupos operativos reales encontrados:');
    realGroups.rows.forEach(group => {
      console.log(`   - ${group.group_name}`);
    });

    // 3. Crear directores con grupos reales distribuidos
    const realDirectors = [
      {
        director_code: 'DIR_001',
        full_name: 'Carlos Rodriguez',
        email: 'carlos.rodriguez@polloloco.com',
        phone: '+52-555-0101',
        position: 'Director Regional Norte',
        region: 'Norte',
        operational_groups: ['EXPO', 'GRUPO NUEVO LAREDO (RUELAS)', 'GRUPO MATAMOROS', 'GRUPO SALTILLO']
      },
      {
        director_code: 'DIR_002',
        full_name: 'Maria Gonzalez',
        email: 'maria.gonzalez@polloloco.com', 
        phone: '+52-555-0102',
        position: 'Directora Regional Centro',
        region: 'Centro',
        operational_groups: ['PLOG QUERETARO', 'GRUPO CANTERA ROSA (MORELIA)', 'TEC']
      },
      {
        director_code: 'DIR_003',
        full_name: 'Roberto Davila',
        email: 'roberto.davila@polloloco.com',
        phone: '+52-555-0103', 
        position: 'Director Regional Sur',
        region: 'Sur',
        operational_groups: ['CRR', 'EFM', 'EPL SO', 'RAP']
      },
      {
        director_code: 'DIR_004',
        full_name: 'Ana Martinez',
        email: 'ana.martinez@polloloco.com',
        phone: '+52-555-0104',
        position: 'Directora de Operaciones Especiales',
        region: 'Nacional', 
        operational_groups: ['OGAS', 'OCHTER TAMPICO', 'TEPEYAC']
      },
      {
        director_code: 'DIR_005',
        full_name: 'Luis Hernandez',
        email: 'luis.hernandez@polloloco.com',
        phone: '+52-555-0105',
        position: 'Director Zona Fronteriza',
        region: 'Frontera',
        operational_groups: ['PLOG LAGUNA', 'PLOG NUEVO LEON', 'GRUPO PIEDRAS NEGRAS', 'GRUPO RIO BRAVO', 'GRUPO SABINAS HIDALGO', 'GRUPO CENTRITO']
      }
    ];

    console.log('\n👥 Creando directores con grupos reales...');
    
    for (const director of realDirectors) {
      await pool.query(`
        INSERT INTO directors (director_code, full_name, email, phone, position, region, operational_groups, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        director.director_code,
        director.full_name,
        director.email, 
        director.phone,
        director.position,
        director.region,
        director.operational_groups,
        true
      ]);
      
      console.log(`✅ Director creado: ${director.full_name} (${director.operational_groups.length} grupos)`);
    }

    // 4. Actualizar el usuario demo con un grupo real
    console.log('\n📱 Actualizando usuario demo con grupo real...');
    await pool.query(`
      UPDATE tracking_users 
      SET grupo = $1 
      WHERE tracker_id = 'rd01'
    `, ['CRR']);
    
    console.log('✅ Usuario rd01 actualizado con grupo CRR');

    // 5. Verificar resultado
    const directorsResult = await pool.query(`
      SELECT full_name, position, region, 
             array_length(operational_groups, 1) as grupos_count
      FROM directors 
      WHERE active = true 
      ORDER BY region, full_name
    `);

    console.log('\n📋 DIRECTORES CONFIGURADOS CON GRUPOS REALES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    directorsResult.rows.forEach(director => {
      console.log(`👨‍💼 ${director.full_name}`);
      console.log(`   📍 ${director.position} - ${director.region}`);
      console.log(`   👥 ${director.grupos_count || 0} grupos asignados`);
      console.log('');
    });

    console.log('✅ Directores y grupos corregidos exitosamente');
    
  } catch (error) {
    console.error('❌ Error corrigiendo directores:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixDirectorsAndGroups()
    .then(() => {
      console.log('🎉 Corrección completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixDirectorsAndGroups };