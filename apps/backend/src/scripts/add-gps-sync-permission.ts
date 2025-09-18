import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Dodavanje permisije za GPS sinhronizaciju...');

  // Kreiraj permisiju za GPS sinhronizaciju
  const permission = await prisma.permission.upsert({
    where: {
      name: 'dispatcher:sync_gps',
    },
    update: {},
    create: {
      name: 'dispatcher:sync_gps',
      resource: 'dispatcher',
      action: 'sync_gps',
      description: 'Pokretanje i upravljanje GPS sinhronizacijom',
    },
  });

  console.log('✅ Permisija kreirana:', permission.name);

  // Dodeli permisiju SUPER_ADMIN roli
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'SUPER_ADMIN' },
  });

  if (superAdminRole) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });
    console.log('✅ Permisija dodeljena SUPER_ADMIN roli');
  }

  // Dodeli permisiju CITY_MANAGER roli
  const cityManagerRole = await prisma.role.findFirst({
    where: { name: 'CITY_MANAGER' },
  });

  if (cityManagerRole) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: cityManagerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: cityManagerRole.id,
        permissionId: permission.id,
      },
    });
    console.log('✅ Permisija dodeljena CITY_MANAGER roli');
  }

  console.log('✅ Sve permisije uspešno dodate!');
}

main()
  .catch((e) => {
    console.error('❌ Greška:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
