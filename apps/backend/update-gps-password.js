const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const readline = require('readline');

const prisma = new PrismaClient();

// Isti algoritam i ključ kao u servisu
const algorithm = 'aes-256-cbc';
const encryptionKey = Buffer.from('12345678901234567890123456789012'); // 32 bytes

function encryptPassword(password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function updateGPSPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('=== AŽURIRANJE PASSWORD-A ZA GPS BAZU ===\n');

  // Pronađi GPS bazu
  const gpsDb = await prisma.legacyDatabase.findFirst({
    where: {
      subtype: 'city_gps_ticketing_database'
    }
  });

  if (!gpsDb) {
    console.log('GPS baza nije pronađena!');
    rl.close();
    await prisma.$disconnect();
    return;
  }

  console.log('Pronađena baza:', gpsDb.name);
  console.log('Host:', gpsDb.host);
  console.log('Database:', gpsDb.database);
  console.log('Username:', gpsDb.username);
  console.log('');

  rl.question('Unesite novi password: ', async (password) => {
    if (!password) {
      console.log('Password ne može biti prazan!');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    // Enkriptuj password
    const encryptedPassword = encryptPassword(password);
    
    console.log('\nEnkriptovan password:', encryptedPassword);
    
    // Ažuriraj u bazi
    await prisma.legacyDatabase.update({
      where: { id: gpsDb.id },
      data: { 
        password: encryptedPassword,
        lastConnectionTest: null,
        connectionError: null
      }
    });

    console.log('✅ Password uspešno ažuriran!');
    
    rl.close();
    await prisma.$disconnect();
  });
}

updateGPSPassword().catch(console.error);