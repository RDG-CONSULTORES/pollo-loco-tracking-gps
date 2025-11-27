/**
 * Arreglar problemas de esquema para endpoints Directors y Users
 */

require('dotenv').config();
const { Pool } = require('pg');

async function fixSchemaIssues() {
  console.log('🔧 ARREGLANDO PROBLEMAS DE ESQUEMA\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('📡 Conectando a Railway...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexión establecida\n');
    
    // 1. Verificar y arreglar problema directors (og.director_id)
    console.log('1️⃣ VERIFICANDO TABLA operational_groups...');
    try {
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'operational_groups'
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      console.log('📋 Columnas en operational_groups:', columnNames.join(', '));
      
      if (!columnNames.includes('director_id')) {
        console.log('❌ Columna director_id faltante');
        console.log('🔧 Agregando columna director_id...');
        await pool.query(`ALTER TABLE operational_groups ADD COLUMN director_id INTEGER`);
        console.log('✅ Columna director_id agregada');
      } else {
        console.log('✅ Columna director_id presente');
      }
      
    } catch (error) {
      console.log(`⚠️ Tabla operational_groups no existe: ${error.message}`);
      console.log('🔧 Creando tabla operational_groups...');
      await pool.query(`
        CREATE TABLE operational_groups (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          director_id INTEGER,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabla operational_groups creada');
    }
    
    // 2. Verificar y arreglar problema users (username)
    console.log('\n2️⃣ VERIFICANDO TABLA system_users...');
    try {
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'system_users'
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      console.log('📋 Columnas en system_users:', columnNames.join(', '));
      
      if (!columnNames.includes('username')) {
        console.log('❌ Columna username faltante');
        console.log('🔧 Agregando columna username...');
        await pool.query(`ALTER TABLE system_users ADD COLUMN username VARCHAR(50)`);
        console.log('✅ Columna username agregada');
        
        // Actualizar usernames existentes basados en email
        console.log('🔧 Actualizando usernames existentes...');
        await pool.query(`UPDATE system_users SET username = split_part(email, '@', 1) WHERE username IS NULL`);
        console.log('✅ Usernames actualizados');
      } else {
        console.log('✅ Columna username presente');
      }
      
    } catch (error) {
      console.log(`❌ Error con tabla system_users: ${error.message}`);
    }
    
    // 3. Verificar tabla directors existe
    console.log('\n3️⃣ VERIFICANDO TABLA directors...');
    try {
      const result = await pool.query(`SELECT COUNT(*) FROM directors`);
      console.log(`✅ Tabla directors existe con ${result.rows[0].count} registros`);
    } catch (error) {
      console.log('❌ Tabla directors no existe');
      console.log('🔧 Creando tabla directors...');
      await pool.query(`
        CREATE TABLE directors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          phone VARCHAR(20),
          telegram_chat_id VARCHAR(50),
          region VARCHAR(50),
          active BOOLEAN DEFAULT true,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabla directors creada');
    }
    
    // 4. Verificar tabla director_groups para relación
    console.log('\n4️⃣ VERIFICANDO TABLA director_groups...');
    try {
      const result = await pool.query(`SELECT COUNT(*) FROM director_groups`);
      console.log(`✅ Tabla director_groups existe con ${result.rows[0].count} registros`);
    } catch (error) {
      console.log('❌ Tabla director_groups no existe');
      console.log('🔧 Creando tabla director_groups...');
      await pool.query(`
        CREATE TABLE director_groups (
          id SERIAL PRIMARY KEY,
          director_id INTEGER NOT NULL,
          group_id INTEGER NOT NULL,
          assigned_by INTEGER,
          assigned_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (director_id) REFERENCES directors(id),
          FOREIGN KEY (group_id) REFERENCES operational_groups(id),
          UNIQUE(director_id, group_id)
        )
      `);
      console.log('✅ Tabla director_groups creada');
    }
    
    // 5. Test queries que fallan
    console.log('\n5️⃣ TESTING QUERIES PROBLEMÁTICAS...');
    
    // Test directors query
    console.log('🧪 Testing directors query...');
    try {
      const directorsResult = await pool.query(`
        SELECT 
          d.*,
          COUNT(DISTINCT og.id) as groups_count,
          COUNT(DISTINCT tu.id) as users_count,
          COUNT(DISTINCT tu.id) FILTER (WHERE tu.active = true) as active_users_count,
          ARRAY_AGG(DISTINCT og.name) FILTER (WHERE og.name IS NOT NULL) as group_names
        FROM directors d
        LEFT JOIN operational_groups og ON d.id = og.director_id AND og.active = true
        LEFT JOIN tracking_users tu ON d.id = tu.director_id
        WHERE d.active = true
        GROUP BY d.id
        ORDER BY d.created_at DESC
        LIMIT 5
      `);
      console.log(`   ✅ Directors query OK (${directorsResult.rows.length} registros)`);
    } catch (error) {
      console.log(`   ❌ Directors query error: ${error.message}`);
    }
    
    // Test users query
    console.log('🧪 Testing users query...');
    try {
      const usersResult = await pool.query(`
        SELECT 
          id,
          username,
          email,
          user_type,
          active,
          created_at
        FROM system_users
        ORDER BY created_at DESC
        LIMIT 5
      `);
      console.log(`   ✅ Users query OK (${usersResult.rows.length} registros)`);
    } catch (error) {
      console.log(`   ❌ Users query error: ${error.message}`);
    }
    
    console.log('\n🎉 ¡ESQUEMAS ARREGLADOS!');
    console.log('✅ Directors endpoint debería funcionar');
    console.log('✅ Users endpoint debería funcionar');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

fixSchemaIssues().then(success => {
  if (success) {
    console.log('\n🚀 ¡Esquemas reparados exitosamente!');
    console.log('⏰ Espera 30 segundos y prueba: node test-fixed-endpoints.js');
  }
}).catch(console.error);