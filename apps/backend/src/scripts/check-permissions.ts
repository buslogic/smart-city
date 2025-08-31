import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPermissions() {
  try {
    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@smart-city.rs' },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
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

    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log(`\n👤 User: ${adminUser.email}`);
    console.log(`   Name: ${adminUser.firstName} ${adminUser.lastName}`);
    console.log(`   Active: ${adminUser.isActive}`);
    
    console.log('\n📋 Roles:');
    for (const userRole of adminUser.userRoles) {
      console.log(`   - ${userRole.role.name}`);
      console.log(`     Permissions count: ${userRole.role.rolePermissions.length}`);
    }

    // Check for specific permission
    const hasAnalyticsPermission = adminUser.userRoles.some(ur => 
      ur.role.rolePermissions.some(rp => 
        rp.permission.name === 'dispatcher:view_analytics'
      )
    );

    console.log('\n🔍 Checking dispatcher:view_analytics permission:');
    console.log(hasAnalyticsPermission ? '✅ Permission found!' : '❌ Permission NOT found!');

    // List all dispatcher permissions
    console.log('\n📊 All dispatcher permissions:');
    const dispatcherPerms = new Set<string>();
    
    for (const userRole of adminUser.userRoles) {
      for (const rolePerm of userRole.role.rolePermissions) {
        if (rolePerm.permission.name.startsWith('dispatcher:')) {
          dispatcherPerms.add(rolePerm.permission.name);
        }
      }
    }

    Array.from(dispatcherPerms).sort().forEach(perm => {
      console.log(`   - ${perm}`);
    });

    // Check if permission exists in database
    const analyticsPermission = await prisma.permission.findUnique({
      where: { name: 'dispatcher:view_analytics' }
    });

    console.log('\n🗄️ Permission in database:');
    if (analyticsPermission) {
      console.log(`✅ Permission exists: ${analyticsPermission.name}`);
      console.log(`   Resource: ${analyticsPermission.resource}`);
      console.log(`   Action: ${analyticsPermission.action}`);
      
      // Check which roles have this permission
      const rolesWithPerm = await prisma.rolePermission.findMany({
        where: { permissionId: analyticsPermission.id },
        include: { role: true }
      });
      
      console.log(`\n   Roles with this permission:`);
      for (const rp of rolesWithPerm) {
        console.log(`   - ${rp.role.name}`);
      }
    } else {
      console.log('❌ Permission does not exist in database!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPermissions();