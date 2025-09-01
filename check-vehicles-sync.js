const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('🔍 Provera vehicles:sync permisije...\n');
  
  // 1. Proveri da li permisija postoji
  const permission = await prisma.permission.findFirst({
    where: {
      resource: 'vehicles',
      action: 'sync'
    }
  });
  
  if (permission) {
    console.log('✅ Permisija postoji:', permission);
  } else {
    console.log('❌ Permisija NE postoji!');
    return;
  }
  
  // 2. Proveri koje role imaju ovu permisiju
  console.log('\n📋 Role sa vehicles:sync permisijom:');
  const rolesWithPermission = await prisma.role.findMany({
    where: {
      rolePermissions: {
        some: {
          permissionId: permission.id
        }
      }
    },
    select: {
      name: true,
      description: true
    }
  });
  
  rolesWithPermission.forEach(role => {
    console.log(`  - ${role.name}: ${role.description}`);
  });
  
  // 3. Proveri admin korisnika
  console.log('\n👤 Admin korisnik:');
  const admin = await prisma.user.findFirst({
    where: {
      email: 'admin@smart-city.rs'
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });
  
  if (admin) {
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:`, admin.userRoles.map(ur => ur.role.name).join(', '));
    
    // Proveri da li admin ima vehicles:sync permisiju
    const hasPermission = admin.userRoles.some(ur => 
      rolesWithPermission.some(r => r.name === ur.role.name)
    );
    
    if (hasPermission) {
      console.log('  ✅ Admin IMA vehicles:sync permisiju!');
    } else {
      console.log('  ❌ Admin NEMA vehicles:sync permisiju!');
    }
  }
  
  // 4. Lista sve vehicles permisije
  console.log('\n📑 Sve vehicles permisije:');
  const vehiclePerms = await prisma.permission.findMany({
    where: {
      resource: 'vehicles'
    },
    select: {
      name: true,
      action: true,
      description: true
    }
  });
  
  vehiclePerms.forEach(p => {
    console.log(`  - ${p.name} (${p.action}): ${p.description}`);
  });
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());