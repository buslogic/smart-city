const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.busVehicle.findMany({
    select: {
      id: true,
      garageNumber: true,
      legacyId: true,
    }
  });
  console.log('Existing vehicles:', vehicles);
  
  // Delete test vehicles to allow re-seeding
  const result = await prisma.busVehicle.deleteMany({
    where: {
      garageNumber: {
        in: ['P80123', 'P80456', 'P80789']
      }
    }
  });
  console.log('Deleted', result.count, 'test vehicles');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());