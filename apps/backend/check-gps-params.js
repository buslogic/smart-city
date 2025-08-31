const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkGPSParams() {
  try {
    // Dohvati SJP Beograd GPS bazu (city_gps_ticketing_database)
    const gpsDb = await prisma.legacyDatabase.findFirst({
      where: {
        subtype: 'city_gps_ticketing_database'
      }
    });

    if (!gpsDb) {
      console.log('Gradska GPS Ticketing baza nije pronađena');
      return;
    }

    console.log('=== PARAMETRI ZA GRADSKU GPS TICKETING BAZU ===\n');
    console.log('ID:', gpsDb.id);
    console.log('Naziv:', gpsDb.name);
    console.log('Tip:', gpsDb.type);
    console.log('Subtip:', gpsDb.subtype);
    console.log('Host:', gpsDb.host);
    console.log('Port:', gpsDb.port);
    console.log('Database:', gpsDb.database);
    console.log('Username:', gpsDb.username);
    console.log('Password:', gpsDb.password); // Ovo će biti enkriptovano ili maskirano
    console.log('Active:', gpsDb.isActive);
    console.log('Last test:', gpsDb.lastConnectionTest);
    console.log('Connection error:', gpsDb.connectionError);
    
    console.log('\n=== POKUŠAJ KONEKCIJE ===');
    console.log(`mysql -h ${gpsDb.host} -P ${gpsDb.port} -u ${gpsDb.username} -p ${gpsDb.database}`);

  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGPSParams();