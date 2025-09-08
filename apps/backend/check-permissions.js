const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPermissions() {
  try {
    // Proveri sve permission sa : ili .
    const permissions = await prisma.permission.findMany({
      where: {
        OR: [
          { name: { contains: ':' } },
          { name: { contains: '.' } }
        ]
      },
      select: {
        id: true,
        name: true,
        resource: true,
        action: true
      },
      orderBy: { name: 'asc' }
    });

    console.log('\n=== Sve permisije sa : ili . ===');
    permissions.forEach(p => {
      const separator = p.name.includes(':') ? ':' : '.';
      console.log(`ID: ${p.id}, Name: ${p.name}, Resource: ${p.resource}, Action: ${p.action}, Separator: ${separator}`);
    });

    // Proveri maintenance permisiju
    const maintenancePermission = await prisma.permission.findFirst({
      where: { name: 'maintenance.timescaledb.view' }
    });
    
    console.log('\n=== Maintenance permisija ===');
    console.log(maintenancePermission);

    // Proveri COMPANY_ADMIN role permissions
    const companyAdminRole = await prisma.role.findFirst({
      where: { name: 'COMPANY_ADMIN' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    console.log('\n=== COMPANY_ADMIN permisije ===');
    if (companyAdminRole) {
      console.log(`Role ID: ${companyAdminRole.id}`);
      console.log(`Broj permisija: ${companyAdminRole.permissions.length}`);
      const maintenancePerms = companyAdminRole.permissions.filter(rp => 
        rp.permission.name.includes('maintenance')
      );
      console.log(`Maintenance permisije: ${maintenancePerms.length}`);
      maintenancePerms.forEach(rp => {
        console.log(`  - ${rp.permission.name}`);
      });
    }

    // Proveri korisnika ticketing.rs@gmail.com
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

    console.log('\n=== Korisnik ticketing.rs@gmail.com ===');
    if (user) {
      console.log(`User ID: ${user.id}`);
      const allPermissions = user.roles.flatMap(ur => 
        ur.role.permissions.map(rp => rp.permission.name)
      );
      const uniquePermissions = [...new Set(allPermissions)];
      console.log(`Ukupno permisija: ${uniquePermissions.length}`);
      
      const maintenancePerms = uniquePermissions.filter(p => p.includes('maintenance'));
      console.log(`Maintenance permisije korisnika: ${maintenancePerms.length}`);
      maintenancePerms.forEach(p => {
        console.log(`  - ${p}`);
      });
    }

  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPermissions();