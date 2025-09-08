const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDashboardPermissions() {
  try {
    // Proveri korisnika i njegove permisije
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
    
    // Prikupi sve permisije
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.name)
    );
    const uniquePermissions = [...new Set(permissions)];
    
    console.log('\nRole:', roles);
    console.log('\n=== SVE PERMISIJE ===');
    uniquePermissions.forEach(p => {
      console.log(`  - "${p}"`);
    });
    
    // Filtriraj dashboard permisije
    console.log('\n=== DASHBOARD PERMISIJE ===');
    const dashboardPerms = uniquePermissions.filter(p => 
      p.toLowerCase().includes('dashboard')
    );
    
    if (dashboardPerms.length === 0) {
      console.log('❌ NEMA dashboard permisija!');
    } else {
      dashboardPerms.forEach(p => {
        console.log(`  - "${p}"`);
        // Analiziraj format
        if (p.includes(':')) {
          console.log('    ^ Koristi DVOTAČKU');
        } else if (p.includes('.')) {
          console.log('    ^ Koristi TAČKU');
        }
      });
    }
    
    // Proveri direktno u bazi kakve dashboard permisije postoje
    console.log('\n=== DASHBOARD PERMISIJE U BAZI ===');
    const allDashboardPerms = await prisma.permission.findMany({
      where: {
        OR: [
          { name: { contains: 'dashboard' } },
          { resource: { contains: 'dashboard' } }
        ]
      },
      orderBy: { name: 'asc' }
    });
    
    allDashboardPerms.forEach(p => {
      console.log(`  ID: ${p.id}, Name: "${p.name}", Resource: "${p.resource}", Action: "${p.action}"`);
    });
    
    // Proveri COMPANY_ADMIN rolu
    console.log('\n=== COMPANY_ADMIN DASHBOARD PERMISIJE ===');
    const companyAdminRole = await prisma.role.findFirst({
      where: { name: 'COMPANY_ADMIN' },
      include: {
        permissions: {
          where: {
            permission: {
              name: { contains: 'dashboard' }
            }
          },
          include: {
            permission: true
          }
        }
      }
    });
    
    if (companyAdminRole) {
      if (companyAdminRole.permissions.length === 0) {
        console.log('❌ COMPANY_ADMIN nema dashboard permisije!');
      } else {
        companyAdminRole.permissions.forEach(rp => {
          console.log(`  - "${rp.permission.name}"`);
        });
      }
    }

  } catch (error) {
    console.error('Greška:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDashboardPermissions();