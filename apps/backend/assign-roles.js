const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignRoles() {
  try {
    // Pronađi role
    const superAdminRole = await prisma.role.findUnique({
      where: { name: 'SUPER_ADMIN' }
    });
    
    const cityManagerRole = await prisma.role.findUnique({
      where: { name: 'CITY_MANAGER' }
    });
    
    const operatorRole = await prisma.role.findUnique({
      where: { name: 'OPERATOR' }
    });

    // Pronađi korisnike
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@smart-city.rs' }
    });
    
    const petarUser = await prisma.user.findUnique({
      where: { email: 'petar.petrovic@smart-city.rs' }
    });
    
    const milicaUser = await prisma.user.findUnique({
      where: { email: 'milica.nikolic@smart-city.rs' }
    });

    // Dodeli role
    if (adminUser && superAdminRole) {
      // Prvo obriši postojeće role
      await prisma.userRole.deleteMany({
        where: { userId: adminUser.id }
      });
      
      // Dodeli SUPER_ADMIN rolu
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: superAdminRole.id
        }
      });
      console.log(`Assigned SUPER_ADMIN to ${adminUser.email}`);
    }

    if (petarUser && cityManagerRole) {
      await prisma.userRole.deleteMany({
        where: { userId: petarUser.id }
      });
      
      await prisma.userRole.create({
        data: {
          userId: petarUser.id,
          roleId: cityManagerRole.id
        }
      });
      console.log(`Assigned CITY_MANAGER to ${petarUser.email}`);
    }

    if (milicaUser && operatorRole) {
      await prisma.userRole.deleteMany({
        where: { userId: milicaUser.id }
      });
      
      await prisma.userRole.create({
        data: {
          userId: milicaUser.id,
          roleId: operatorRole.id
        }
      });
      console.log(`Assigned OPERATOR to ${milicaUser.email}`);
    }

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

    console.log('\nAll users with roles:');
    users.forEach(user => {
      const roleNames = user.roles.map(ur => ur.role.name).join(', ');
      console.log(`- ${user.email}: ${roleNames || 'No roles'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignRoles();