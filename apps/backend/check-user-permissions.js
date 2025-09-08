const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserPermissions() {
  try {
    // Proveri korisnika sa svim permisijama
    const user = await prisma.user.findFirst({
      where: { email: 'ticketing.rs@gmail.com' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('Korisnik nije pronađen');
      return;
    }

    console.log('\n=== Korisnik ticketing.rs@gmail.com ===');
    console.log(`ID: ${user.id}, Email: ${user.email}`);
    
    // Prikupljamo sve permisije kao što radi auth.service.ts
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.name)
    );
    const uniquePermissions = [...new Set(permissions)];
    
    console.log('\nRole:', roles);
    console.log('\nPermisije (kao što vraća auth.service.ts):');
    uniquePermissions.forEach(p => {
      console.log(`  - "${p}"`);
    });
    
    // Proveri specifično maintenance permisije
    console.log('\n=== Maintenance permisije (filtrirane) ===');
    const maintenancePerms = uniquePermissions.filter(p => 
      p.toLowerCase().includes('maintenance') || p.toLowerCase().includes('timescale')
    );
    maintenancePerms.forEach(p => {
      console.log(`  - "${p}"`);
      // Analiziraj format
      if (p.includes(':')) {
        console.log('    ^ Koristi DVOTAČKU');
      } else if (p.includes('.')) {
        console.log('    ^ Koristi TAČKU');
      }
    });
    
    // Direktno proveri permisiju u bazi
    console.log('\n=== Direktna provera u bazi ===');
    const directPermission = await prisma.permission.findFirst({
      where: { 
        OR: [
          { name: 'maintenance.timescaledb.view' },
          { name: 'maintenance.timescaledb:view' },
          { name: { contains: 'maintenance' } }
        ]
      }
    });
    
    if (directPermission) {
      console.log(`Permisija u bazi: ID=${directPermission.id}, Name="${directPermission.name}"`);
    }

  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPermissions();