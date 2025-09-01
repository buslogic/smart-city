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
  
  // 2. Proveri koje role imaju ovu permisiju preko RolePermission tabele
  console.log('\n📋 Role sa vehicles:sync permisijom:');
  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      permissionId: permission.id
    },
    include: {
      role: true
    }
  });
  
  if (rolePermissions.length > 0) {
    rolePermissions.forEach(rp => {
      console.log(`  - ${rp.role.name}: ${rp.role.description}`);
    });
  } else {
    console.log('  ❌ Nijedna rola nema ovu permisiju!');
  }
  
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
    const adminRoleIds = admin.userRoles.map(ur => ur.roleId);
    const hasPermission = rolePermissions.some(rp => 
      adminRoleIds.includes(rp.roleId)
    );
    
    if (hasPermission) {
      console.log('  ✅ Admin IMA vehicles:sync permisiju!');
    } else {
      console.log('  ❌ Admin NEMA vehicles:sync permisiju!');
    }
  } else {
    console.log('  ❌ Admin korisnik ne postoji!');
  }
  
  // 4. Lista sve vehicles permisije
  console.log('\n📑 Sve vehicles permisije:');
  const vehiclePerms = await prisma.permission.findMany({
    where: {
      resource: 'vehicles'
    },
    select: {
      id: true,
      name: true,
      action: true,
      description: true
    }
  });
  
  vehiclePerms.forEach(p => {
    console.log(`  - [${p.id}] ${p.name} (${p.action}): ${p.description}`);
  });
  
  // 5. Debug: Proveri sve RolePermission zapise za vehicles:sync
  console.log('\n🔍 RolePermission zapisi za vehicles:sync (ID:', permission.id, '):');
  const allRolePerms = await prisma.rolePermission.findMany({
    where: {
      permissionId: permission.id
    }
  });
  console.log('  Broj zapisa:', allRolePerms.length);
  if (allRolePerms.length === 0) {
    console.log('  ⚠️  PROBLEM: Permisija postoji ali nije dodeljena nijednoj roli!');
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());