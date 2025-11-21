/**
 * Migration: Add Unified User Management Columns
 * Panel Unificado EPL CAS: Support for complete user management with permissions
 */

const db = require('../config/database');

async function addUnifiedUserColumns() {
  try {
    console.log('🔄 Adding unified user management columns...');
    
    // Add email column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE
    `);
    
    // Add phone column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
    `);
    
    // Add position column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS position VARCHAR(100)
    `);
    
    // Add username column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE
    `);
    
    // Add password_hash column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    `);
    
    // Add permissions column (JSONB for flexible permissions)
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'
    `);
    
    // Add telegram_required column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS telegram_required BOOLEAN DEFAULT false
    `);
    
    // Add owntracks_required column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS owntracks_required BOOLEAN DEFAULT true
    `);
    
    console.log('✅ Unified user columns added successfully');
    
    // Create operational_groups table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS operational_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) NOT NULL UNIQUE,
        description TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create branches table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        operational_group_id INT REFERENCES operational_groups(id),
        name VARCHAR(100) NOT NULL,
        address TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        geofence_radius INTEGER DEFAULT 50,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create user_group_permissions table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_group_permissions (
        user_id INT REFERENCES tracking_users(id) ON DELETE CASCADE,
        operational_group_id INT REFERENCES operational_groups(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, operational_group_id)
      )
    `);
    
    console.log('✅ EPL CAS structure tables created');
    
    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_users_email 
      ON tracking_users(email)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_users_username 
      ON tracking_users(username)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_users_role 
      ON tracking_users(role)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_group_permissions_user 
      ON user_group_permissions(user_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_group_permissions_group 
      ON user_group_permissions(operational_group_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_group 
      ON branches(operational_group_id)
    `);
    
    console.log('✅ Performance indexes created');
    
    // Insert placeholder operational groups if table is empty
    const existingGroups = await db.query('SELECT COUNT(*) FROM operational_groups');
    
    if (parseInt(existingGroups.rows[0].count) === 0) {
      console.log('📋 Inserting placeholder operational groups...');
      
      const placeholderGroups = [
        { name: 'Norte', code: 'NTE', description: 'Grupo Operativo Norte - Zona Metropolitana Norte' },
        { name: 'Sur', code: 'SUR', description: 'Grupo Operativo Sur - Zona Metropolitana Sur' },
        { name: 'Centro', code: 'CTR', description: 'Grupo Operativo Centro - Zona Metropolitana Centro' },
        { name: 'Oriente', code: 'OTE', description: 'Grupo Operativo Oriente - Zona Metropolitana Oriente' }
      ];
      
      for (const group of placeholderGroups) {
        await db.query(`
          INSERT INTO operational_groups (name, code, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (code) DO NOTHING
        `, [group.name, group.code, group.description]);
      }
      
      console.log('✅ Placeholder groups inserted');
    }
    
    // Add system_users table foreign key if it doesn't exist
    await db.query(`
      ALTER TABLE system_users 
      ADD COLUMN IF NOT EXISTS tracking_user_id INT REFERENCES tracking_users(id)
    `);
    
    // Verify all columns exist
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tracking_users' 
        AND column_name IN (
          'email', 'phone', 'position', 'username', 'password_hash', 
          'permissions', 'telegram_required', 'owntracks_required'
        )
      ORDER BY column_name
    `);
    
    console.log('📋 Verified unified user columns:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error adding unified user columns:', error.message);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addUnifiedUserColumns()
    .then(() => {
      console.log('✅ Unified user management migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = { addUnifiedUserColumns };