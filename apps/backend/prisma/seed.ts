import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Administratorska uloga sa potpunim pristupom' },
    { name: 'CITY_MANAGER', description: 'Menadžer gradskih resursa' },
    { name: 'DEPARTMENT_HEAD', description: 'Šef departmana' },
    { name: 'OPERATOR', description: 'Operater sistema' },
    { name: 'ANALYST', description: 'Analitičar' },
    { name: 'CITIZEN', description: 'Građanin' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('Roles created');

  // Create permissions
  const permissions = [
    // User permissions
    { name: 'users.create', resource: 'users', action: 'create', description: 'Kreiranje korisnika' },
    { name: 'users.read', resource: 'users', action: 'read', description: 'Pregled korisnika' },
    { name: 'users.update', resource: 'users', action: 'update', description: 'Ažuriranje korisnika' },
    { name: 'users.delete', resource: 'users', action: 'delete', description: 'Brisanje korisnika' },
    { name: 'users.manage', resource: 'users', action: 'manage', description: 'Upravljanje korisnicima' },
    
    // Role permissions
    { name: 'roles.create', resource: 'roles', action: 'create', description: 'Kreiranje uloga' },
    { name: 'roles.read', resource: 'roles', action: 'read', description: 'Pregled uloga' },
    { name: 'roles.update', resource: 'roles', action: 'update', description: 'Ažuriranje uloga' },
    { name: 'roles.delete', resource: 'roles', action: 'delete', description: 'Brisanje uloga' },
    { name: 'roles.manage', resource: 'roles', action: 'manage', description: 'Upravljanje ulogama' },
    
    // Settings permissions
    { name: 'settings.general.read', resource: 'settings', action: 'read', description: 'Pregled opštih podešavanja' },
    { name: 'settings.general.update', resource: 'settings', action: 'update', description: 'Ažuriranje opštih podešavanja' },
    { name: 'settings.general.manage', resource: 'settings', action: 'manage', description: 'Upravljanje opštim podešavanjima' },
    
    // Legacy Database permissions
    { name: 'legacy_databases:create', resource: 'legacy_databases', action: 'create', description: 'Kreiranje konfiguracije legacy baza' },
    { name: 'legacy_databases:read', resource: 'legacy_databases', action: 'read', description: 'Pregled konfiguracija legacy baza' },
    { name: 'legacy_databases:update', resource: 'legacy_databases', action: 'update', description: 'Ažuriranje konfiguracija legacy baza' },
    { name: 'legacy_databases:delete', resource: 'legacy_databases', action: 'delete', description: 'Brisanje konfiguracija legacy baza' },
    { name: 'legacy_databases:manage', resource: 'legacy_databases', action: 'manage', description: 'Upravljanje legacy bazama' },
    
    // API Settings permissions  
    { name: 'settings.api.read', resource: 'api_settings', action: 'read', description: 'Pregled API podešavanja' },
    { name: 'settings.api.update', resource: 'api_settings', action: 'update', description: 'Ažuriranje API podešavanja' },
    
    // System Settings permissions
    { name: 'settings.system.read', resource: 'system_settings', action: 'read', description: 'Pregled sistemskih podešavanja' },
    { name: 'settings.system.update', resource: 'system_settings', action: 'update', description: 'Ažuriranje sistemskih podešavanja' },
    
    // Legacy Tables permissions
    { name: 'legacy_tables:create', resource: 'legacy_tables', action: 'create', description: 'Kreiranje mapiranja tabela' },
    { name: 'legacy_tables:read', resource: 'legacy_tables', action: 'read', description: 'Pregled mapiranja tabela' },
    { name: 'legacy_tables:update', resource: 'legacy_tables', action: 'update', description: 'Ažuriranje mapiranja tabela' },
    { name: 'legacy_tables:delete', resource: 'legacy_tables', action: 'delete', description: 'Brisanje mapiranja tabela' },
    
    // Vehicles permissions
    { name: 'vehicles:create', resource: 'vehicles', action: 'create', description: 'Kreiranje vozila' },
    { name: 'vehicles:read', resource: 'vehicles', action: 'read', description: 'Pregled vozila' },
    { name: 'vehicles:update', resource: 'vehicles', action: 'update', description: 'Ažuriranje vozila' },
    { name: 'vehicles:delete', resource: 'vehicles', action: 'delete', description: 'Brisanje vozila' },
    { name: 'vehicles:manage', resource: 'vehicles', action: 'manage', description: 'Upravljanje vozilima' },
    { name: 'vehicles:sync', resource: 'vehicles', action: 'sync', description: 'Sinhronizacija vozila' },
    
    // Dispatcher Module permissions
    { name: 'dispatcher:read', resource: 'dispatcher', action: 'read', description: 'Pregled dispečerskog modula' },
    { name: 'dispatcher:manage', resource: 'dispatcher', action: 'manage', description: 'Upravljanje dispečerskim modulom' },
    { name: 'dispatcher:track_vehicles', resource: 'dispatcher', action: 'track_vehicles', description: 'Praćenje vozila na mapi' },
    { name: 'dispatcher:send_commands', resource: 'dispatcher', action: 'send_commands', description: 'Slanje komandi vozačima' },
    { name: 'dispatcher:view_map', resource: 'dispatcher_map', action: 'read', description: 'Pregled mape sa vozilima' },
    { name: 'dispatcher:view_analytics', resource: 'dispatcher_analytics', action: 'read', description: 'Pregled analitike vozila' },
    { name: 'dispatcher:manage_routes', resource: 'dispatcher_routes', action: 'manage', description: 'Upravljanje rutama' },
    { name: 'dispatcher:emergency_actions', resource: 'dispatcher', action: 'emergency', description: 'Hitne akcije u dispečerskom modulu' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }

  console.log('Permissions created');

  // Create test users
  const hashedPassword = await bcrypt.hash('Test123!', 10);
  
  const users = [
    {
      email: 'admin@smart-city.rs',
      firstName: 'Marko',
      lastName: 'Marković',
      password: hashedPassword,
      isActive: true,
      role: 'SUPER_ADMIN',
    },
    {
      email: 'petar.petrovic@smart-city.rs',
      firstName: 'Petar',
      lastName: 'Petrović',
      password: hashedPassword,
      isActive: true,
      role: 'CITY_MANAGER',
    },
    {
      email: 'milica.nikolic@smart-city.rs',
      firstName: 'Milica',
      lastName: 'Nikolić',
      password: hashedPassword,
      isActive: true,
      role: 'OPERATOR',
    },
    {
      email: 'stefan.stojanovic@smart-city.rs',
      firstName: 'Stefan',
      lastName: 'Stojanović',
      password: hashedPassword,
      isActive: false,
      role: 'ANALYST',
    },
    {
      email: 'ana.anic@smart-city.rs',
      firstName: 'Ana',
      lastName: 'Anić',
      password: hashedPassword,
      isActive: true,
      role: 'DEPARTMENT_HEAD',
    },
  ];

  for (const userData of users) {
    const { role, ...userDataWithoutRole } = userData;
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userDataWithoutRole,
    });

    // Assign role to user
    const roleRecord = await prisma.role.findUnique({
      where: { name: role },
    });

    if (roleRecord) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: roleRecord.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: roleRecord.id,
        },
      });
    }
  }

  console.log('Users created');

  // Assign permissions to roles
  const rolePermissions = {
    SUPER_ADMIN: await prisma.permission.findMany(), // All permissions
    CITY_MANAGER: await prisma.permission.findMany({
      where: {
        OR: [
          { resource: 'users', action: { in: ['read', 'update'] } },
          { resource: 'roles', action: 'read' },
          { resource: 'legacy_tables', action: 'read' },
          { resource: 'vehicles', action: { in: ['read', 'create', 'update', 'sync'] } },
          { resource: 'dispatcher', action: { in: ['read', 'manage', 'track_vehicles', 'send_commands'] } },
          { resource: 'dispatcher_map', action: 'read' },
          { resource: 'dispatcher_analytics', action: 'read' },
          { resource: 'dispatcher_routes', action: 'manage' },
        ],
      },
    }),
    DEPARTMENT_HEAD: await prisma.permission.findMany({
      where: {
        OR: [
          { resource: 'users', action: 'read' },
          { resource: 'roles', action: 'read' },
        ],
      },
    }),
    OPERATOR: await prisma.permission.findMany({
      where: {
        OR: [
          { resource: 'users', action: 'read' },
          { resource: 'vehicles', action: 'read' },
          { resource: 'dispatcher', action: { in: ['read', 'track_vehicles'] } },
          { resource: 'dispatcher_map', action: 'read' },
        ],
      },
    }),
    ANALYST: await prisma.permission.findMany({
      where: {
        action: 'read',
      },
    }),
    CITIZEN: [],
  };

  for (const [roleName, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (role) {
      for (const permission of permissions) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  console.log('Role permissions assigned');
  
  // Test vozila više ne kreiramo jer imamo prava vozila iz legacy baze
  // console.log('Test bus vehicles skipped - using real vehicles from legacy database');
  
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });