// Pokreni backend API test preko servisa
const axios = require('axios');

async function testGPSConnection() {
  try {
    console.log('Pozivam backend API za test konekcije...\n');
    
    const response = await axios.get('http://localhost:3010/api/legacy-databases/12/test-connection');
    
    console.log('Rezultat:', response.data);
    
    if (response.data.success) {
      console.log('\n✅ Konekcija radi preko backend-a!');
      console.log('Sada hajde da dohvatimo podatke iz current tabele...\n');
      
      // Ako konekcija radi, probaj da dohvatiš podatke
      // Ali pošto nemamo endpoint još, samo potvrdi da konekcija radi
    }
    
  } catch (error) {
    console.error('Greška:', error.response?.data || error.message);
  }
}

testGPSConnection();