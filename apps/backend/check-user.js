const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('🔍 Checking database connection...');
    
    // Check user exists
    const user = await prisma.user.findUnique({
      where: { email: 'admin@smartcity.rs' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log('❌ User admin@smartcity.rs not found');
      
      // Show all users
      const allUsers = await prisma.user.findMany();
      console.log('Available users:', allUsers.map(u => ({ email: u.email, firstName: u.firstName, isActive: u.isActive })));
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: user.roles.map(ur => ur.role.name)
    });

    // Test password
    const isPasswordValid = await bcrypt.compare('Test123!', user.password);
    console.log('✅ Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Password hash:', user.password);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();