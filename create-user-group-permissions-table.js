require('dotenv').config();
const { Pool } = require('pg');

async function createUserGroupPermissionsTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🎯 CREANDO TABLA user_group_permissions\n');
    
    // 1. Verificar si ya existe
    const checkExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_group_permissions'
      )
    `);
    
    if (checkExists.rows[0].exists) {
      console.log('⚠️  La tabla user_group_permissions ya existe');
      
      // Mostrar estructura actual
      const structure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_group_permissions'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Estructura actual:');
      structure.rows.forEach(col => {
        console.log(`   • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
      
      return { success: true, existed: true };
    }
    
    console.log('📊 Creando tabla user_group_permissions...');
    
    // 2. Crear la tabla
    await pool.query(`
      CREATE TABLE user_group_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        operational_group_id INTEGER,
        operational_group_name VARCHAR(100),
        granted_at TIMESTAMP DEFAULT NOW(),
        granted_by INTEGER,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        -- Foreign keys
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES system_users(id) ON DELETE SET NULL,
        
        -- Constraints
        UNIQUE(user_id, operational_group_name),
        CHECK (operational_group_name IS NOT NULL OR operational_group_id IS NOT NULL)
      )
    `);
    
    console.log('✅ Tabla user_group_permissions creada');
    
    // 3. Crear índices para mejor performance
    console.log('📊 Creando índices...');
    
    await pool.query('CREATE INDEX idx_user_group_permissions_user_id ON user_group_permissions(user_id)');
    await pool.query('CREATE INDEX idx_user_group_permissions_group_name ON user_group_permissions(operational_group_name)');
    await pool.query('CREATE INDEX idx_user_group_permissions_active ON user_group_permissions(active)');
    
    console.log('✅ Índices creados');
    
    // 4. Verificar estructura final
    console.log('\n📋 ESTRUCTURA FINAL:');
    const finalStructure = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_group_permissions'
      ORDER BY ordinal_position
    `);
    
    finalStructure.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      const nullable = col.is_nullable === 'NO' ? 'NOT NULL' : '';
      const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
      console.log(`   • ${col.column_name}: ${col.data_type}${length} ${nullable} ${defaultVal}`);
    });
    
    // 5. Verificar foreign keys
    console.log('\n🔗 FOREIGN KEYS:');
    const foreignKeys = await pool.query(`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'user_group_permissions'
    `);
    
    foreignKeys.rows.forEach(fk => {
      console.log(`   • ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
    // 6. Test básico de inserción/eliminación
    console.log('\n🧪 TEST BÁSICO:');
    
    // Obtener un usuario de prueba
    const testUser = await pool.query('SELECT id FROM users WHERE active = true LIMIT 1');
    
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].id;
      
      // Insertar permiso de prueba
      await pool.query(`
        INSERT INTO user_group_permissions (user_id, operational_group_name) 
        VALUES ($1, 'TEST_GROUP')
      `, [userId]);
      
      console.log(`   ✅ Inserción exitosa para usuario ${userId}`);
      
      // Verificar inserción
      const testSelect = await pool.query(`
        SELECT * FROM user_group_permissions 
        WHERE user_id = $1 AND operational_group_name = 'TEST_GROUP'
      `, [userId]);
      
      console.log(`   ✅ Consulta exitosa: ${testSelect.rows.length} registros`);
      
      // Limpiar test
      await pool.query(`
        DELETE FROM user_group_permissions 
        WHERE user_id = $1 AND operational_group_name = 'TEST_GROUP'
      `, [userId]);
      
      console.log(`   ✅ Limpieza exitosa`);
    } else {
      console.log('   ⚠️  No hay usuarios para test, pero tabla funcional');
    }
    
    console.log('\n🎉 ¡TABLA CREADA EXITOSAMENTE!');
    console.log('=' .repeat(60));
    console.log('✅ user_group_permissions lista para usar');
    console.log('✅ Soporta asignación de usuarios a grupos operativos');
    console.log('✅ Incluye auditoría (granted_at, granted_by)');
    console.log('✅ Foreign keys configuradas correctamente');
    console.log('✅ Índices para optimización de consultas');
    
    return { success: true, existed: false };
    
  } catch (error) {
    console.error('❌ Error creando tabla:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar
createUserGroupPermissionsTable().then(result => {
  if (result.success) {
    if (result.existed) {
      console.log('\n🎯 TABLA YA EXISTÍA');
    } else {
      console.log('\n🎯 ¡TABLA CREADA EXITOSAMENTE!');
    }
    console.log('Próximo paso: Habilitar código comentado en unified-user-management.routes.js');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});