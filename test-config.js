const axios = require('axios');

async function testConfigBasedScore() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:3010/api/auth/login', {
      email: 'admin@smart-city.rs',
      password: 'Test123!'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Logged in');

    // Test for one day
    const response = await axios.post(
      'http://localhost:3010/api/driving-behavior/batch-statistics',
      {
        vehicleIds: [460],
        startDate: '2025-08-22',
        endDate: '2025-08-22'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const stats = response.data[0];
    console.log('\n📊 Rezultat za P93597 (22.08.2025):');
    console.log(`  Safety Score: ${stats.safetyScore}/100`);
    console.log(`  Kilometraža: ${stats.totalDistanceKm.toFixed(2)} km`);
    console.log(`  Ozbiljnih ubrzanja: ${stats.severeAccelerations}`);
    console.log(`  Umerenih ubrzanja: ${stats.moderateAccelerations}`); 
    console.log(`  Ozbiljnih kočenja: ${stats.severeBrakings}`);
    console.log(`  Umerenih kočenja: ${stats.moderateBrakings}`);
    console.log(`  Ukupno događaja: ${stats.totalEvents}`);
    console.log(`  Događaja/100km: ${stats.eventsPer100Km.toFixed(2)}`);
    
    // Ručna kalkulacija sa trenutnom konfiguracijom
    console.log('\n🔧 Konfiguracija iz baze:');
    console.log('  Ozbiljna ubrzanja: threshold=2/100km, penalty=15, multiplier=2, max=25');
    console.log('  Umerena ubrzanja: threshold=10/100km, penalty=5, multiplier=1.5, max=15');
    console.log('  Ozbiljna kočenja: threshold=2/100km, penalty=15, multiplier=2, max=25');
    console.log('  Umerena kočenja: threshold=10/100km, penalty=5, multiplier=1.5, max=15');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testConfigBasedScore();