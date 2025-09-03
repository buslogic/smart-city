const axios = require('axios');

async function testBatchAPI() {
  try {
    // First, get a token
    const loginResponse = await axios.post('http://localhost:3010/api/auth/login', {
      email: 'admin@smart-city.rs',
      password: 'Test123!'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Logged in successfully');
    
    // Test with top 10 vehicles for August 2025
    const vehicleIds = [460, 1212, 180, 411, 1205, 800, 1177, 1200, 1165, 1198];
    
    console.log(`\n📊 Testing batch API with ${vehicleIds.length} vehicles...`);
    console.log('Vehicle IDs:', vehicleIds);
    console.log('Date range: 2025-08-01 to 2025-08-31\n');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      'http://localhost:3010/api/driving-behavior/batch-statistics',
      {
        vehicleIds,
        startDate: '2025-08-01',
        endDate: '2025-08-31'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Response received in ${duration.toFixed(2)} seconds`);
    console.log(`📈 Statistics for ${response.data.length} vehicles:\n`);
    
    // Display results
    response.data.forEach(stat => {
      console.log(`Vehicle ${stat.vehicleId} (${stat.garageNo}):`);
      console.log(`  - Safety Score: ${stat.safetyScore}`);
      console.log(`  - Total Distance: ${stat.totalDistanceKm.toFixed(2)} km`);
      console.log(`  - Total Events: ${stat.totalEvents}`);
      console.log(`  - Severe Accelerations: ${stat.severeAccelerations}`);
      console.log(`  - Severe Brakings: ${stat.severeBrakings}`);
      console.log('');
    });
    
    console.log(`\n🎯 Performance Summary:`);
    console.log(`  - Time per vehicle: ${(duration / vehicleIds.length).toFixed(3)} seconds`);
    console.log(`  - Estimated time for 1200 vehicles: ${((duration / vehicleIds.length) * 1200).toFixed(1)} seconds`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testBatchAPI();