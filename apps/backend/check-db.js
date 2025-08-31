const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Proveri postojeća vozila
    const vehicles = await prisma.busVehicle.findMany({
      select: {
        id: true,
        garageNumber: true,
        legacyId: true,
      }
    });
    
    console.log('=== POSTOJEĆA VOZILA ===');
    console.log('Ukupno vozila:', vehicles.length);
    vehicles.forEach(v => {
      console.log(`ID: ${v.id}, Garage: ${v.garageNumber}, LegacyID: ${v.legacyId}`);
    });
    
    // Proveri duplikate legacy_id
    const duplicateLegacyIds = vehicles
      .filter(v => v.legacyId !== null)
      .map(v => v.legacyId);
    
    console.log('\n=== LEGACY ID-jevi koji već postoje ===');
    console.log(duplicateLegacyIds);
    
  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();