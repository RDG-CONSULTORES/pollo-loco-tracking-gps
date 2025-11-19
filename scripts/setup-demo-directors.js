const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function setupDemoDirectors() {
  console.log('🏢 Configurando directores de prueba...');
  
  try {
    // 1. Verificar estructura de tablas necesarias
    console.log('📊 Verificando estructura de BD...');
    
    // Verificar y ajustar tabla directors existente
    await pool.query(`
      -- Agregar columnas faltantes si no existen
      DO $$ 
      BEGIN
        BEGIN
          ALTER TABLE directors ADD COLUMN email VARCHAR(100);
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
          ALTER TABLE directors ADD COLUMN phone VARCHAR(20);
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
          ALTER TABLE directors ADD COLUMN position VARCHAR(50);
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
          ALTER TABLE directors ADD COLUMN region VARCHAR(50);
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
          ALTER TABLE directors ADD COLUMN operational_groups TEXT[];
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
      END $$;
    `);

    // 2. Insertar directores de prueba
    const directors = [
      {
        director_code: 'DIR_001',
        full_name: 'Carlos Rodriguez',
        email: 'carlos.rodriguez@polloloco.com',
        phone: '+52-555-0101',
        position: 'Director Regional Norte',
        region: 'Norte',
        operational_groups: ['GRP_NORTE_1', 'GRP_NORTE_2', 'GRP_NORTE_3']
      },
      {
        director_code: 'DIR_002',
        full_name: 'Maria Gonzalez',
        email: 'maria.gonzalez@polloloco.com', 
        phone: '+52-555-0102',
        position: 'Directora Regional Centro',
        region: 'Centro',
        operational_groups: ['GRP_CENTRO_1', 'GRP_CENTRO_2']
      },
      {
        director_code: 'DIR_003',
        full_name: 'Roberto Davila',
        email: 'roberto.davila@polloloco.com',
        phone: '+52-555-0103', 
        position: 'Director Regional Sur',
        region: 'Sur',
        operational_groups: ['GRP_SUR_1', 'GRP_SUR_2', 'GRP_SUR_3', 'GRP_SUR_4']
      },
      {
        director_code: 'DIR_004',
        full_name: 'Ana Martinez',
        email: 'ana.martinez@polloloco.com',
        phone: '+52-555-0104',
        position: 'Directora de Operaciones',
        region: 'Nacional', 
        operational_groups: ['GRP_ESPECIAL_1', 'GRP_ESPECIAL_2']
      },
      {
        director_code: 'DIR_005',
        full_name: 'Luis Hernandez',
        email: 'luis.hernandez@polloloco.com',
        phone: '+52-555-0105',
        position: 'Director de Supervisión',
        region: 'Nacional',
        operational_groups: ['GRP_SUPER_1', 'GRP_SUPER_2']
      }
    ];

    console.log('👥 Creando directores...');
    
    for (const director of directors) {
      await pool.query(`
        INSERT INTO directors (director_code, full_name, email, phone, position, region, operational_groups, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (director_code) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          position = EXCLUDED.position,
          region = EXCLUDED.region,
          operational_groups = EXCLUDED.operational_groups,
          updated_at = NOW()
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
      
      console.log(`✅ Director creado: ${director.full_name} (${director.region})`);
    }

    // 3. Verificar creación
    const result = await pool.query('SELECT COUNT(*) as total FROM directors WHERE active = true');
    console.log(`📊 Total directores activos: ${result.rows[0].total}`);

    // 4. Mostrar resumen
    const directorsResult = await pool.query(`
      SELECT full_name, position, region, 
             array_length(operational_groups, 1) as grupos_count
      FROM directors 
      WHERE active = true 
      ORDER BY region, full_name
    `);

    console.log('\n📋 Directores configurados:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    directorsResult.rows.forEach(director => {
      console.log(`👨‍💼 ${director.full_name}`);
      console.log(`   📍 ${director.position} - ${director.region}`);
      console.log(`   👥 ${director.grupos_count || 0} grupos asignados`);
      console.log('');
    });

    console.log('✅ Directores de prueba configurados exitosamente');
    
  } catch (error) {
    console.error('❌ Error configurando directores:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupDemoDirectors()
    .then(() => {
      console.log('🎉 Configuración completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { setupDemoDirectors };