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
    { name: 'users:create', resource: 'users', action: 'create', description: 'Kreiranje korisnika' },
    { name: 'users:view', resource: 'users', action: 'view', description: 'Pregled korisnika' },
    { name: 'users:update', resource: 'users', action: 'update', description: 'Ažuriranje korisnika' },
    { name: 'users:delete', resource: 'users', action: 'delete', description: 'Brisanje korisnika' },
    
    // Role permissions
    { name: 'roles:create', resource: 'roles', action: 'create', description: 'Kreiranje uloga' },
    { name: 'roles:view', resource: 'roles', action: 'view', description: 'Pregled uloga' },
    { name: 'roles:update', resource: 'roles', action: 'update', description: 'Ažuriranje uloga' },
    { name: 'roles:delete', resource: 'roles', action: 'delete', description: 'Brisanje uloga' },
    
    // Permission permissions
    { name: 'permissions:create', resource: 'permissions', action: 'create', description: 'Kreiranje permisija' },
    { name: 'permissions:view', resource: 'permissions', action: 'view', description: 'Pregled permisija' },
    { name: 'permissions:update', resource: 'permissions', action: 'update', description: 'Ažuriranje permisija' },
    { name: 'permissions:delete', resource: 'permissions', action: 'delete', description: 'Brisanje permisija' },
    
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
    
    // Vehicle Sync permissions
    { name: 'vehicles.sync:view', resource: 'vehicles.sync', action: 'view', description: 'Pregled statusa sinhronizacije vozila' },
    { name: 'vehicles.sync:start', resource: 'vehicles.sync', action: 'start', description: 'Pokretanje sinhronizacije vozila' },
    { name: 'vehicles.sync:stop', resource: 'vehicles.sync', action: 'stop', description: 'Zaustavljanje sinhronizacije vozila' },
    { name: 'vehicles.sync:configure', resource: 'vehicles.sync', action: 'configure', description: 'Konfiguracija parametara sinhronizacije' },
    
    // Dispatcher Module permissions
    { name: 'dispatcher:read', resource: 'dispatcher', action: 'read', description: 'Pregled dispečerskog modula' },
    { name: 'dispatcher:manage', resource: 'dispatcher', action: 'manage', description: 'Upravljanje dispečerskim modulom' },
    { name: 'dispatcher:track_vehicles', resource: 'dispatcher', action: 'track_vehicles', description: 'Praćenje vozila na mapi' },
    { name: 'dispatcher:send_commands', resource: 'dispatcher', action: 'send_commands', description: 'Slanje komandi vozačima' },
    { name: 'dispatcher:view_map', resource: 'dispatcher_map', action: 'read', description: 'Pregled mape sa vozilima' },
    { name: 'dispatcher:view_analytics', resource: 'dispatcher_analytics', action: 'read', description: 'Pregled analitike vozila' },
    { name: 'dispatcher:manage_routes', resource: 'dispatcher_routes', action: 'manage', description: 'Upravljanje rutama' },
    { name: 'dispatcher:emergency_actions', resource: 'dispatcher', action: 'emergency', description: 'Hitne akcije u dispečerskom modulu' },

    // Water Meter Types permissions
    { name: 'water_meter_types:create', resource: 'water_meter_types', action: 'create', description: 'Kreiranje tipova vodomera' },
    { name: 'water_meter_types:view', resource: 'water_meter_types', action: 'view', description: 'Pregled tipova vodomera' },
    { name: 'water_meter_types:update', resource: 'water_meter_types', action: 'update', description: 'Ažuriranje tipova vodomera' },
    { name: 'water_meter_types:delete', resource: 'water_meter_types', action: 'delete', description: 'Brisanje tipova vodomera' },

    // Water Meter Availability permissions
    { name: 'water_meter_availability:create', resource: 'water_meter_availability', action: 'create', description: 'Kreiranje dostupnosti vodomera' },
    { name: 'water_meter_availability:view', resource: 'water_meter_availability', action: 'view', description: 'Pregled dostupnosti vodomera' },
    { name: 'water_meter_availability:update', resource: 'water_meter_availability', action: 'update', description: 'Ažuriranje dostupnosti vodomera' },
    { name: 'water_meter_availability:delete', resource: 'water_meter_availability', action: 'delete', description: 'Brisanje dostupnosti vodomera' },

    // Water Meter Manufacturers permissions
    { name: 'water_meter_manufacturers:create', resource: 'water_meter_manufacturers', action: 'create', description: 'Kreiranje proizvođača vodomera' },
    { name: 'water_meter_manufacturers:view', resource: 'water_meter_manufacturers', action: 'view', description: 'Pregled proizvođača vodomera' },
    { name: 'water_meter_manufacturers:update', resource: 'water_meter_manufacturers', action: 'update', description: 'Ažuriranje proizvođača vodomera' },
    { name: 'water_meter_manufacturers:delete', resource: 'water_meter_manufacturers', action: 'delete', description: 'Brisanje proizvođača vodomera' },

    // Water Meters permissions
    { name: 'water_meters:create', resource: 'water_meters', action: 'create', description: 'Kreiranje vodomera' },
    { name: 'water_meters:view', resource: 'water_meters', action: 'view', description: 'Pregled vodomera' },
    { name: 'water_meters:update', resource: 'water_meters', action: 'update', description: 'Ažuriranje vodomera' },
    { name: 'water_meters:delete', resource: 'water_meters', action: 'delete', description: 'Brisanje vodomera' },

    // Replacement Water Meters permissions
    { name: 'replacement_water_meters:create', resource: 'replacement_water_meters', action: 'create', description: 'Kreiranje zamenjenih vodomera' },
    { name: 'replacement_water_meters:view', resource: 'replacement_water_meters', action: 'view', description: 'Pregled zamenjenih vodomera' },
    { name: 'replacement_water_meters:update', resource: 'replacement_water_meters', action: 'update', description: 'Ažuriranje zamenjenih vodomera' },
    { name: 'replacement_water_meters:delete', resource: 'replacement_water_meters', action: 'delete', description: 'Brisanje zamenjenih vodomera' },

    // Water Meter Remarks (Readings) permissions
    { name: 'water_meter_remarks:create', resource: 'water_meter_remarks', action: 'create', description: 'Kreiranje napomena vodomera' },
    { name: 'water_meter_remarks:view', resource: 'water_meter_remarks', action: 'view', description: 'Pregled napomena vodomera' },
    { name: 'water_meter_remarks:update', resource: 'water_meter_remarks', action: 'update', description: 'Ažuriranje napomena vodomera' },
    { name: 'water_meter_remarks:delete', resource: 'water_meter_remarks', action: 'delete', description: 'Brisanje napomena vodomera' },
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
          { resource: 'vehicles', action: { in: ['read', 'create', 'update'] } },
          { resource: 'vehicles.sync', action: { in: ['view', 'start', 'stop', 'configure'] } },
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