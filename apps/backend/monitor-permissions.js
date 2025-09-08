const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function monitorPermissions() {
  console.log('🔍 Monitoring počinje... Dodelite permisiju kroz UI\n');
  
  // Početno stanje
  const initialState = await prisma.rolePermission.findMany({
    where: {
      role: { name: 'COMPANY_ADMIN' },
      permission: { name: { contains: 'maintenance' } }
    },
    include: {
      permission: true,
      role: true
    }
  });
  
  console.log('Početno stanje COMPANY_ADMIN maintenance permisija:', initialState.length);
  initialState.forEach(rp => {
    console.log(`  - ${rp.permission.name}`);
  });
  
  // Praćenje na svakih 2 sekunde
  let counter = 0;
  const interval = setInterval(async () => {
    counter++;
    
    const currentState = await prisma.rolePermission.findMany({
      where: {
        role: { name: 'COMPANY_ADMIN' },
        permission: { 
          OR: [
            { name: { contains: 'maintenance' } },
            { name: { contains: 'timescale' } }
          ]
        }
      },
      include: {
        permission: true,
        role: true
      }
    });
    
    if (currentState.length !== initialState.length) {
      console.log(`\n✅ PROMENA DETEKTOVANA! (nakon ${counter * 2} sekundi)`);
      console.log('Nove maintenance/timescale permisije:');
      currentState.forEach(rp => {
        console.log(`  - ID: ${rp.permission.id}, Name: "${rp.permission.name}"`);
        console.log(`    Resource: ${rp.permission.resource}, Action: ${rp.permission.action}`);
      });
      
      // Proveri i korisnika
      const user = await prisma.user.findFirst({
        where: { email: 'ticketing.rs@gmail.com' },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    where: {
                      permission: { 
                        OR: [
                          { name: { contains: 'maintenance' } },
                          { name: { contains: 'timescale' } }
                        ]
                      }
                    },
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
      
      if (user) {
        console.log('\nKorisnik ticketing.rs@gmail.com sada ima:');
        user.roles.forEach(ur => {
          ur.role.permissions.forEach(rp => {
            console.log(`  - ${rp.permission.name}`);
          });
        });
      }
      
      clearInterval(interval);
      await prisma.$disconnect();
      process.exit(0);
    } else {
      process.stdout.write('.');
    }
  }, 2000);
  
  // Timeout nakon 60 sekundi
  setTimeout(() => {
    console.log('\n\nTimeout - nema promena nakon 60 sekundi');
    clearInterval(interval);
    prisma.$disconnect();
    process.exit(0);
  }, 60000);
}

monitorPermissions().catch(console.error);