import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignStopsSyncPermissions() {
  try {
    console.log('🔍 Tražim SUPER_ADMIN rolu...');

    // Pronađi SUPER_ADMIN rolu
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      console.error('❌ SUPER_ADMIN rola nije pronađena!');
      return;
    }

    console.log(`✅ Pronađena SUPER_ADMIN rola (ID: ${superAdminRole.id})`);
    console.log('\n🔍 Tražim Stajališta Sync permisije...');

    // Pronađi sve stops_sync permisije
    const stopsSyncPermissions = await prisma.permission.findMany({
      where: {
        name: {
          startsWith: 'transport.administration.stops_sync',
        },
      },
      orderBy: {
        menuOrder: 'asc',
      },
    });

    console.log(`📊 Pronađeno ${stopsSyncPermissions.length} permisija:\n`);
    stopsSyncPermissions.forEach(p => {
      console.log(`   - ${p.name} (menuOrder: ${p.menuOrder})`);
    });

    console.log('\n🔄 Dodeljujem permisije SUPER_ADMIN roli...');

    let assigned = 0;
    let alreadyAssigned = 0;

    for (const permission of stopsSyncPermissions) {
      // Proveri da li je već dodeljena
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
      });

      if (existing) {
        console.log(`   ⏭️  ${permission.name} - već dodeljena`);
        alreadyAssigned++;
      } else {
        await prisma.rolePermission.create({
          data: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        });
        console.log(`   ✅ ${permission.name} - dodeljena`);
        assigned++;
      }
    }

    console.log(`\n✅ Gotovo! Dodeljeno: ${assigned}, Već dodeljeno: ${alreadyAssigned}`);
    console.log('\n💡 Korisnici sa SUPER_ADMIN rolom sada mogu pristupiti Stajališta Sync funkcionalnosti.');

  } catch (error) {
    console.error('❌ Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignStopsSyncPermissions();
