const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const dispatcherPerms = await prisma.permission.findMany({
    where: {
      OR: [
        { name: { contains: 'dispatcher' } },
        { resource: { contains: 'dispatcher' } }
      ]
    },
    select: { name: true, resource: true, action: true }
  });
  
  console.log('Dispatcher permisije:', dispatcherPerms);
  
  const oldPerm = await prisma.permission.findFirst({
    where: { name: 'dispatcher:sync_gps' }
  });
  
  console.log('Stara permisija dispatcher:sync_gps:', oldPerm ? 'POSTOJI' : 'NE POSTOJI');
  
  const newPerms = await prisma.permission.findMany({
    where: { resource: 'dispatcher.sync' }
  });
  
  console.log('Nove dispatcher.sync permisije:', newPerms.length);
  
  await prisma.$disconnect();
}

check();