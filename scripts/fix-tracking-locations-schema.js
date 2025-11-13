require('dotenv').config();
const { Client } = require('pg');

/**
 * Fix tracking_locations table schema
 */
async function fixTrackingLocationsSchema() {
  console.log('🔧 Fixing tracking_locations table schema...');
  
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    // 1. Check current structure
    console.log('\n1️⃣ Checking current tracking_locations structure...');
    const currentColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tracking_locations'
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:');
    currentColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // 2. Check if tracker_id column exists
    const trackerIdExists = currentColumns.rows.some(col => col.column_name === 'tracker_id');
    const userIdExists = currentColumns.rows.some(col => col.column_name === 'user_id');
    
    console.log('\n2️⃣ Column analysis:');
    console.log(`   tracker_id exists: ${trackerIdExists}`);
    console.log(`   user_id exists: ${userIdExists}`);
    
    if (!trackerIdExists && userIdExists) {
      console.log('\n3️⃣ Need to rename user_id to tracker_id...');
      
      // Drop foreign key constraint if it exists
      console.log('   Dropping foreign key constraints...');
      try {
        await client.query(`
          ALTER TABLE tracking_locations 
          DROP CONSTRAINT IF EXISTS tracking_locations_user_id_fkey
        `);
        console.log('   ✅ Foreign key constraint dropped');
      } catch (error) {
        console.log('   ⚠️ No foreign key to drop:', error.message);
      }
      
      // Rename column
      console.log('   Renaming user_id to tracker_id...');
      await client.query(`
        ALTER TABLE tracking_locations 
        RENAME COLUMN user_id TO tracker_id
      `);
      console.log('   ✅ Column renamed');
      
      // Add back foreign key constraint
      console.log('   Adding foreign key constraint...');
      await client.query(`
        ALTER TABLE tracking_locations 
        ADD CONSTRAINT tracking_locations_tracker_id_fkey 
        FOREIGN KEY (tracker_id) REFERENCES tracking_users(tracker_id) ON DELETE CASCADE
      `);
      console.log('   ✅ Foreign key constraint added');
      
    } else if (trackerIdExists) {
      console.log('\n3️⃣ tracker_id column already exists - no changes needed');
    } else {
      console.log('\n3️⃣ Neither tracker_id nor user_id found - table may not exist or have different structure');
    }
    
    // 4. Verify final structure
    console.log('\n4️⃣ Verifying final structure...');
    const finalColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tracking_locations'
      ORDER BY ordinal_position
    `);
    
    console.log('Final columns:');
    finalColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // 5. Test insert
    console.log('\n5️⃣ Testing insert...');
    try {
      const testInsert = await client.query(`
        INSERT INTO tracking_locations 
        (tracker_id, zenput_email, latitude, longitude, accuracy, 
         battery, velocity, heading, gps_timestamp, raw_payload)
        VALUES ('TEST_USER', 'test@example.com', 25.6866, -100.3161, 5, 
                85, 0, 0, NOW(), '{}')
        RETURNING id
      `);
      
      console.log(`   ✅ Test insert successful, ID: ${testInsert.rows[0].id}`);
      
      // Clean up test record
      await client.query('DELETE FROM tracking_locations WHERE tracker_id = $1', ['TEST_USER']);
      console.log('   🧹 Test record cleaned up');
      
    } catch (error) {
      console.log('   ❌ Test insert failed:', error.message);
    }
    
    await client.end();
    console.log('\n✅ Schema fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
    throw error;
  }
}

if (require.main === module) {
  fixTrackingLocationsSchema()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fixTrackingLocationsSchema;