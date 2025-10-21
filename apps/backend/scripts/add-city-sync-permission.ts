import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCitySyncPermission() {
  try {
    console.log('🔄 Dodajem city:sync permisiju...\n');

    // Proveri da li permisija već postoji
    const existing = await prisma.permission.findFirst({
      where: {
        name: 'transport.administration.stops_sync.city:sync',
      },
    });

    if (existing) {
      console.log('✅ Permisija već postoji (ID:', existing.id, ')');
      return;
    }

    // Kreiraj permisiju
    const permission = await prisma.permission.create({
      data: {
        name: 'transport.administration.stops_sync.city:sync',
        resource: 'transport.administration.stops_sync.city',
        action: 'sync',
        description: 'City server - Sync stops',
        descriptionSr: 'Gradski server - Sinhronizacija stajališta',
        menuOrder: 301515200004,
      },
    });

    console.log('✅ Permisija kreirana:', permission.name, '(ID:', permission.id, ')');

    // Pronađi SUPER_ADMIN rolu
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      console.log('⚠️  SUPER_ADMIN rola nije pronađena - permisija kreirana ali nije dodeljena');
      return;
    }

    // Dodeli permisiju SUPER_ADMIN roli
    await prisma.rolePermission.create({
      data: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });

    console.log('✅ Permisija dodeljena SUPER_ADMIN roli');
    console.log('\n✨ Gotovo! Sada možeš da koristiš City sync funkcionalnost.');

  } catch (error) {
    console.error('❌ Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addCitySyncPermission();
