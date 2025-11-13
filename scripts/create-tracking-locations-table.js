require('dotenv').config();
const { Client } = require('pg');

/**
 * Create missing tracking_locations table
 */
async function createTrackingLocationsTable() {
  console.log('📍 Creating tracking_locations table...');
  
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tracking_locations'
      )
    `);
    
    console.log(`Table exists: ${tableExists.rows[0].exists}`);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating tracking_locations table...');
      
      await client.query(`
        CREATE TABLE tracking_locations (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          zenput_email VARCHAR(100),
          
          -- Datos GPS
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          accuracy INT,           -- Precisión en metros
          altitude INT,
          battery INT,            -- Porcentaje batería
          velocity DECIMAL(5, 2), -- Velocidad km/h
          heading INT,            -- Dirección 0-360°
          
          -- Timestamps
          gps_timestamp TIMESTAMP NOT NULL,
          received_at TIMESTAMP DEFAULT NOW(),
          
          -- Metadata
          raw_payload JSONB,
          
          FOREIGN KEY (user_id) REFERENCES tracking_users(id) ON DELETE CASCADE
        )
      `);
      
      console.log('✅ Table created');
      
      // Add indexes
      console.log('Creating indexes...');
      await client.query(`
        CREATE INDEX idx_locations_user_time ON tracking_locations(user_id, gps_timestamp DESC)
      `);
      await client.query(`
        CREATE INDEX idx_locations_timestamp ON tracking_locations(gps_timestamp DESC)
      `);
      await client.query(`
        CREATE INDEX idx_locations_date ON tracking_locations(DATE(gps_timestamp))
      `);
      
      console.log('✅ Indexes created');
      
    } else {
      console.log('Table already exists. Checking structure...');
      
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'tracking_locations'
        ORDER BY ordinal_position
      `);
      
      console.log('Current columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      const hasUserId = columns.rows.some(col => col.column_name === 'user_id');
      console.log(`Has user_id column: ${hasUserId}`);
    }
    
    // Test insert
    console.log('\nTesting insert...');
    try {
      const testInsert = await client.query(`
        INSERT INTO tracking_locations 
        (user_id, zenput_email, latitude, longitude, accuracy, 
         battery, velocity, heading, gps_timestamp, raw_payload)
        VALUES (3, 'test@example.com', 25.6866, -100.3161, 5, 
                85, 0, 0, NOW(), '{"test": true}')
        RETURNING id, user_id, latitude, longitude
      `);
      
      console.log('✅ Test insert successful:', testInsert.rows[0]);
      
      // Clean up test record
      await client.query('DELETE FROM tracking_locations WHERE raw_payload @> $1', ['{"test": true}']);
      console.log('🧹 Test record cleaned up');
      
    } catch (insertError) {
      console.log('❌ Test insert failed:', insertError.message);
    }
    
    await client.end();
    console.log('\n✅ Table creation process completed!');
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  }
}

if (require.main === module) {
  createTrackingLocationsTable()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createTrackingLocationsTable;