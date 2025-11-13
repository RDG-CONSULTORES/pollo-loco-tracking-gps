/**
 * Test completo del flujo de OwnTracks
 * Este script puede ejecutarse localmente para probar la API remota
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://pollo-loco-tracking-gps-production.up.railway.app';

/**
 * Realizar petición HTTP
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    const req = lib.request(url, finalOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: result
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Test completo de OwnTracks
 */
async function testOwnTracksFlow() {
  console.log('🧪 Testing OwnTracks Flow Complete');
  console.log('═'.repeat(50));
  console.log('');
  
  const tests = [];
  
  try {
    // 1. Test conectividad básica
    console.log('1️⃣ Testing basic connectivity...');
    const pingResult = await makeRequest(`${BASE_URL}/api/owntracks/ping`);
    
    if (pingResult.status === 200) {
      console.log('   ✅ Ping successful');
      console.log(`   📍 Server responded: ${pingResult.data.message}`);
      tests.push({ test: 'ping', status: 'pass', data: pingResult.data });
    } else {
      console.log(`   ❌ Ping failed: ${pingResult.status}`);
      tests.push({ test: 'ping', status: 'fail', error: pingResult.status });
    }
    console.log('');
    
    // 2. Test system status
    console.log('2️⃣ Testing system status...');
    const statusResult = await makeRequest(`${BASE_URL}/api/debug/owntracks-status`);
    
    if (statusResult.status === 200) {
      console.log('   ✅ System status OK');
      console.log(`   👤 User RD01 exists: ${statusResult.data.user_rd01.exists}`);
      console.log(`   📊 Total locations: ${statusResult.data.locations.stats.total_locations}`);
      console.log(`   📅 Today locations: ${statusResult.data.locations.stats.today_locations}`);
      console.log(`   🔧 RD01 locations: ${statusResult.data.locations.stats.rd01_locations}`);
      
      if (!statusResult.data.user_rd01.exists) {
        console.log('   ⚠️ User RD01 needs to be created');
      }
      
      tests.push({ test: 'system_status', status: 'pass', data: statusResult.data });
    } else {
      console.log(`   ❌ System status failed: ${statusResult.status}`);
      tests.push({ test: 'system_status', status: 'fail', error: statusResult.status });
    }
    console.log('');
    
    // 3. Test location processing
    console.log('3️⃣ Testing location processing...');
    const testLocation = {
      tid: 'RD01',
      lat: 25.6866,
      lon: -100.3161
    };
    
    const testResult = await makeRequest(`${BASE_URL}/api/debug/test-location`, {
      method: 'POST',
      body: JSON.stringify(testLocation)
    });
    
    if (testResult.status === 200) {
      console.log('   ✅ Location processing test successful');
      console.log(`   📍 Input: ${testResult.data.input.tid} @ ${testResult.data.input.lat}, ${testResult.data.input.lon}`);
      console.log(`   📊 Result: ${JSON.stringify(testResult.data.result)}`);
      tests.push({ test: 'location_processing', status: 'pass', data: testResult.data });
    } else {
      console.log(`   ❌ Location processing failed: ${testResult.status}`);
      tests.push({ test: 'location_processing', status: 'fail', error: testResult.status });
    }
    console.log('');
    
    // 4. Test real OwnTracks payload
    console.log('4️⃣ Testing real OwnTracks payload...');
    const realPayload = {
      _type: 'location',
      tid: 'RD01',
      lat: 25.6866,
      lon: -100.3161,
      tst: Math.floor(Date.now() / 1000) - 60, // 1 minute ago to avoid future timestamp
      acc: 5,
      batt: 85,
      vel: 0,
      cog: 0
    };
    
    const realResult = await makeRequest(`${BASE_URL}/api/owntracks/location`, {
      method: 'POST',
      body: JSON.stringify(realPayload)
    });
    
    if (realResult.status === 200) {
      console.log('   ✅ Real OwnTracks payload successful');
      console.log(`   📡 Server response: ${realResult.data.status}`);
      console.log(`   💬 Message: ${realResult.data.message || 'N/A'}`);
      tests.push({ test: 'real_payload', status: 'pass', data: realResult.data });
    } else {
      console.log(`   ❌ Real OwnTracks payload failed: ${realResult.status}`);
      console.log(`   📄 Response: ${JSON.stringify(realResult.data)}`);
      tests.push({ test: 'real_payload', status: 'fail', error: realResult.status, response: realResult.data });
    }
    console.log('');
    
    // 5. Verificar si se guardó la ubicación
    console.log('5️⃣ Verifying location was saved...');
    const verifyResult = await makeRequest(`${BASE_URL}/api/debug/owntracks-status`);
    
    if (verifyResult.status === 200) {
      const newLocationCount = verifyResult.data.locations.stats.rd01_locations;
      console.log(`   📊 RD01 locations now: ${newLocationCount}`);
      
      if (verifyResult.data.locations.recent.length > 0) {
        console.log('   📍 Recent locations:');
        verifyResult.data.locations.recent.forEach((loc, index) => {
          console.log(`      ${index + 1}. ${loc.gps_timestamp} | ${loc.latitude}, ${loc.longitude}`);
        });
        tests.push({ test: 'location_saved', status: 'pass', count: newLocationCount });
      } else {
        console.log('   ⚠️ No recent locations found');
        tests.push({ test: 'location_saved', status: 'warning', count: newLocationCount });
      }
    } else {
      console.log(`   ❌ Could not verify location save: ${verifyResult.status}`);
      tests.push({ test: 'location_saved', status: 'fail', error: verifyResult.status });
    }
    console.log('');
    
    // Summary
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(30));
    
    const passed = tests.filter(t => t.status === 'pass').length;
    const failed = tests.filter(t => t.status === 'fail').length;
    const warnings = tests.filter(t => t.status === 'warning').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log('');
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('');
      console.log('📱 OwnTracks Configuration:');
      console.log('   URL: https://pollo-loco-tracking-gps-production.up.railway.app/api/owntracks/location');
      console.log('   Device ID: RD01');
      console.log('   User ID: RD01');
      console.log('   Mode: HTTP');
      console.log('');
      console.log('✅ Your OwnTracks should now be working!');
      console.log('Try tapping "Publish" in the OwnTracks app to send a manual location update.');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('Check the errors above and fix the issues before configuring OwnTracks.');
    }
    
    return {
      summary: { passed, failed, warnings },
      tests,
      success: failed === 0
    };
    
  } catch (error) {
    console.error('💥 Error during testing:', error.message);
    return {
      error: error.message,
      success: false
    };
  }
}

// Run if called directly
if (require.main === module) {
  testOwnTracksFlow()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = testOwnTracksFlow;