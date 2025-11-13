require('dotenv').config();
const { Client } = require('pg');

/**
 * Test Railway database connection and check current schema
 */
async function testRailwayConnection() {
  let client;
  
  try {
    console.log('🔍 Testing Railway database connection...');
    
    // Since the app is working, let's test the current connection
    const testUrls = [
      process.env.DATABASE_URL,
      // Railway external pattern (will be provided by user)
      // 'postgresql://postgres:PASSWORD@HOST:PORT/railway'
    ].filter(Boolean);
    
    for (const url of testUrls) {
      try {
        console.log(`\n🔗 Trying connection: ${url.split('@')[1] || 'masked'}`);
        
        client = new Client({
          connectionString: url,
          ssl: url.includes('railway.app') ? { rejectUnauthorized: false } : false
        });
        
        await client.connect();
        console.log('✅ Connected successfully!');
        
        // Check current tracking_visits columns
        const columns = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'tracking_visits'
          ORDER BY ordinal_position
        `);
        
        console.log('\n📊 Current tracking_visits columns:');
        columns.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        // Check for Spanish column names
        const spanishColumns = columns.rows.filter(col => 
          ['entrada_at', 'salida_at', 'duracion_minutos', 'entrada_lat', 'entrada_lon', 'salida_lat', 'salida_lon'].includes(col.column_name)
        );
        
        if (spanishColumns.length > 0) {
          console.log('\n⚠️  Found Spanish columns that need renaming:');
          spanishColumns.forEach(col => console.log(`  - ${col.column_name}`));
          console.log('\n💡 Need to run schema fix!');
        } else {
          console.log('\n✅ All columns are in English');
        }
        
        await client.end();
        return; // Success, exit
        
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        if (client) {
          try { await client.end(); } catch {}
          client = null;
        }
      }
    }
    
    console.log('\n❌ No successful connections. Check DATABASE_URL in Railway.');
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

if (require.main === module) {
  testRailwayConnection()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = testRailwayConnection;