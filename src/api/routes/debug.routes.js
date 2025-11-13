const express = require('express');
const router = express.Router();

/**
 * Debug routes for troubleshooting
 */

/**
 * GET /api/debug/owntracks-status
 * Complete OwnTracks debugging info
 */
router.get('/owntracks-status', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // 1. Check user RD01
    const userCheck = await db.query(`
      SELECT 
        id,
        tracker_id, 
        display_name, 
        active, 
        created_at,
        zenput_email
      FROM tracking_users 
      WHERE tracker_id = 'RD01'
    `);
    
    // 2. Check recent locations
    const locationsCheck = await db.query(`
      SELECT 
        COUNT(*) as total_locations,
        COUNT(*) FILTER (WHERE DATE(gps_timestamp) = CURRENT_DATE) as today_locations,
        COUNT(*) FILTER (WHERE tracker_id = 'RD01') as rd01_locations,
        MAX(gps_timestamp) as last_location
      FROM tracking_locations
    `);
    
    // 3. Check system config
    const configCheck = await db.query(`
      SELECT key, value
      FROM system_config
      WHERE key IN ('system_active', 'work_hours_start', 'work_hours_end')
    `);
    
    // 4. Check table structure
    const tableStruct = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tracking_users'
      ORDER BY ordinal_position
    `);
    
    // 5. Get last few location records for RD01
    let recentLocations = [];
    if (locationsCheck.rows[0].rd01_locations > 0) {
      const recentResult = await db.query(`
        SELECT 
          gps_timestamp,
          latitude,
          longitude,
          accuracy
        FROM tracking_locations
        WHERE tracker_id = 'RD01'
        ORDER BY gps_timestamp DESC
        LIMIT 5
      `);
      recentLocations = recentResult.rows;
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      system: {
        status: 'running',
        database: 'connected'
      },
      user_rd01: {
        exists: userCheck.rows.length > 0,
        data: userCheck.rows[0] || null
      },
      locations: {
        stats: locationsCheck.rows[0],
        recent: recentLocations
      },
      config: configCheck.rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {}),
      table_structure: tableStruct.rows,
      owntracks: {
        endpoint_url: 'https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks/location',
        ping_url: 'https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks/ping',
        expected_device_id: 'RD01',
        expected_user_id: 'RD01'
      },
      troubleshooting: {
        steps: [
          '1. Verify OwnTracks app is installed and configured',
          '2. Check iPhone location permissions (Settings → Privacy → Location Services)',
          '3. Verify Background App Refresh is enabled for OwnTracks',
          '4. Try manual publish from OwnTracks app',
          '5. Check server logs for incoming requests'
        ],
        common_issues: [
          'Location services disabled',
          'Wrong URL in OwnTracks config',
          'Network connectivity issues',
          'Background app refresh disabled'
        ]
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error.message);
    
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/debug/test-location
 * Test location processing with sample data
 */
router.post('/test-location', async (req, res) => {
  try {
    const { tid, lat, lon } = req.body;
    
    // Use defaults if not provided
    const testPayload = {
      _type: 'location',
      tid: tid || 'RD01',
      lat: lat || 25.6866,
      lon: lon || -100.3161,
      tst: Math.floor(Date.now() / 1000),
      acc: 5,
      batt: 85,
      vel: 0
    };
    
    console.log(`🧪 [DEBUG] Test location processing: ${testPayload.tid} @ ${testPayload.lat}, ${testPayload.lon}`);
    
    const locationProcessor = require('../../services/location-processor');
    const result = await locationProcessor.processLocation(testPayload);
    
    console.log(`📊 [DEBUG] Processing result:`, result);
    
    res.json({
      status: 'test_completed',
      input: testPayload,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in test endpoint:', error.message);
    
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/debug/create-rd01
 * Create RD01 user for testing
 */
router.post('/create-rd01', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Check if RD01 exists
    const existingUser = await db.query(`
      SELECT * FROM tracking_users WHERE tracker_id = 'RD01'
    `);
    
    if (existingUser.rows.length > 0) {
      res.json({
        message: 'User RD01 already exists',
        user: existingUser.rows[0],
        timestamp: new Date().toISOString()
      });
    } else {
      // Create RD01 user
      const result = await db.query(`
        INSERT INTO tracking_users 
        (tracker_id, display_name, zenput_email, active)
        VALUES ('RD01', 'Roberto Davila', 'roberto@pollocas.com', true)
        RETURNING *
      `);
      
      res.json({
        message: 'User RD01 created successfully',
        user: result.rows[0],
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating RD01:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/debug/request-log
 * Show recent requests (if logging is enabled)
 */
router.get('/request-log', (req, res) => {
  // Simple request logging
  const log = {
    message: 'Request logging not implemented yet',
    suggestion: 'Check Railway logs for detailed request information',
    endpoints: {
      owntracks_location: '/api/owntracks/location (POST)',
      owntracks_ping: '/api/owntracks/ping (GET)',
      owntracks_status: '/api/owntracks/status (GET)',
      debug_status: '/api/debug/owntracks-status (GET)',
      debug_test: '/api/debug/test-location (POST)',
      debug_create_rd01: '/api/debug/create-rd01 (POST)'
    },
    timestamp: new Date().toISOString()
  };
  
  res.json(log);
});

/**
 * POST /api/debug/test-save-location
 * Test saving a location directly to database
 */
router.post('/test-save-location', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Test data
    const testData = {
      tracker_id: 'RD01',
      zenput_email: 'roberto@pollocas.com',
      latitude: 25.6866,
      longitude: -100.3161,
      accuracy: 5,
      altitude: null,
      battery: 85,
      velocity: 0,
      heading: 0,
      gps_timestamp: new Date(),
      raw_payload: JSON.stringify({
        _type: 'location',
        tid: 'RD01',
        lat: 25.6866,
        lon: -100.3161,
        acc: 5
      })
    };
    
    console.log('[DEBUG] Attempting to save location:', testData);
    
    const result = await db.query(`
      INSERT INTO tracking_locations 
      (tracker_id, zenput_email, latitude, longitude, accuracy, altitude, 
       battery, velocity, heading, gps_timestamp, raw_payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, tracker_id, latitude, longitude, gps_timestamp
    `, [
      testData.tracker_id,
      testData.zenput_email,
      testData.latitude,
      testData.longitude,
      testData.accuracy,
      testData.altitude,
      testData.battery,
      testData.velocity,
      testData.heading,
      testData.gps_timestamp,
      testData.raw_payload
    ]);
    
    console.log('[DEBUG] Location saved successfully:', result.rows[0]);
    
    res.json({
      status: 'success',
      message: 'Location saved successfully',
      saved_location: result.rows[0],
      test_data: testData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error saving location:', error.message);
    console.error('❌ [DEBUG] Full error:', error);
    
    res.status(500).json({
      status: 'error',
      error: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;