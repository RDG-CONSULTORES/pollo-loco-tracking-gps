/**
 * Migration: Add Telegram Detection Columns
 * Mini-Step 1B: Support for @username → telegram_id detection
 */

const db = require('../config/database');

async function addTelegramDetectionColumns() {
  try {
    console.log('🔄 Adding Telegram detection columns to tracking_users...');
    
    // Add telegram_username column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100)
    `);
    
    // Add detection_status column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS detection_status VARCHAR(50) DEFAULT 'pending_detection'
    `);
    
    // Add detection_method column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS detection_method VARCHAR(50) DEFAULT 'manual'
    `);
    
    // Add updated_at column if it doesn't exist
    await db.query(`
      ALTER TABLE tracking_users 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);
    
    // Create index on telegram_username for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_users_telegram_username 
      ON tracking_users(telegram_username)
    `);
    
    // Create index on detection_status for filtering
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_users_detection_status 
      ON tracking_users(detection_status)
    `);
    
    console.log('✅ Telegram detection columns added successfully');
    
    // Verify columns exist
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tracking_users' 
        AND column_name IN ('telegram_username', 'detection_status', 'detection_method', 'updated_at')
      ORDER BY column_name
    `);
    
    console.log('📋 Verified columns:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}) ${col.column_default || ''}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error adding Telegram detection columns:', error.message);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addTelegramDetectionColumns()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = { addTelegramDetectionColumns };