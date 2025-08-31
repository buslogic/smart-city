const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserRoles() {
  try {
    console.log('Checking UserRole table...\n');
    
    // Proveri UserRole tabelu
    const userRoles = await prisma.userRole.findMany({
      include: {
        user: true,
        role: true
      }
    });
    
    if (userRoles.length === 0) {
      console.log('❌ UserRole table is EMPTY! No users have assigned roles.');
    } else {
      console.log(`✅ Found ${userRoles.length} user-role assignments:`);
      userRoles.forEach(ur => {
        console.log(`   - User: ${ur.user.email} has role: ${ur.role.name}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Checking all users with their roles...\n');
    
    // Proveri sve korisnike sa njihovim rolama
    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    users.forEach(user => {
      const roleNames = user.roles.map(ur => ur.role.name).join(', ');
      if (user.roles.length > 0) {
        console.log(`✅ ${user.email}: ${roleNames}`);
      } else {
        console.log(`❌ ${user.email}: NO ROLES ASSIGNED`);
      }
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('Available roles in the system:\n');
    
    // Prikaži sve dostupne role
    const roles = await prisma.role.findMany();
    roles.forEach(role => {
      console.log(`   - ${role.name} (ID: ${role.id})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRoles();