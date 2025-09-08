const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMaintenancePermission() {
  try {
    // Pronađi COMPANY_ADMIN rolu
    const role = await prisma.role.findFirst({
      where: { name: 'COMPANY_ADMIN' }
    });
    
    if (!role) {
      console.log('COMPANY_ADMIN rola ne postoji!');
      return;
    }
    
    // Pronađi maintenance.timescaledb.view permisiju
    const permission = await prisma.permission.findFirst({
      where: { name: 'maintenance.timescaledb.view' }
    });
    
    if (!permission) {
      console.log('maintenance.timescaledb.view permisija ne postoji!');
      return;
    }
    
    // Proveri da li već postoji veza
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      }
    });
    
    if (existing) {
      console.log('Permisija je već dodeljena ovoj roli!');
      return;
    }
    
    // Dodaj permisiju roli
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id
      }
    });
    
    console.log(`✅ Uspešno dodeljeno: ${permission.name} -> ${role.name}`);
    
    // Verifikuj
    const updatedRole = await prisma.role.findFirst({
      where: { name: 'COMPANY_ADMIN' },
      include: {
        permissions: {
          where: {
            permission: {
              name: { contains: 'maintenance' }
            }
          },
          include: {
            permission: true
          }
        }
      }
    });
    
    console.log('\nProvera nakon dodavanja:');
    console.log(`Maintenance permisije za ${role.name}:`);
    updatedRole.permissions.forEach(rp => {
      console.log(`  - ${rp.permission.name}`);
    });
    
  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMaintenancePermission();