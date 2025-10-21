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

    // Vodovod - Main Menu (Level 1: 500000000000)
    { name: 'vodovod:view', resource: 'vodovod', action: 'view', description: 'Vodovod - Glavni Meni', descriptionSr: 'Vodovod', menuOrder: 500000000000 },

    // Vodovod - Submenu Level 2
    { name: 'water_meters_menu:view', resource: 'water_meters_menu', action: 'view', description: 'Vodovod - Vodomeri Meni', descriptionSr: 'Vodomeri', menuOrder: 501000000000 },
    { name: 'measuring_points_menu:view', resource: 'measuring_points_menu', action: 'view', description: 'Vodovod - Merna Mesta Meni', descriptionSr: 'Merna Mesta', menuOrder: 502000000000 },

    // Water Meter Types permissions (menuOrder: 501010000000 + offset)
    { name: 'water_meter_types:create', resource: 'water_meter_types', action: 'create', description: 'Kreiranje tipova vodomera', menuOrder: 501010000001 },
    { name: 'water_meter_types:view', resource: 'water_meter_types', action: 'view', description: 'Pregled tipova vodomera', menuOrder: 501010000000 },
    { name: 'water_meter_types:update', resource: 'water_meter_types', action: 'update', description: 'Ažuriranje tipova vodomera', menuOrder: 501010000002 },
    { name: 'water_meter_types:delete', resource: 'water_meter_types', action: 'delete', description: 'Brisanje tipova vodomera', menuOrder: 501010000003 },

    // Water Meter Availability permissions (menuOrder: 501020000000 + offset)
    { name: 'water_meter_availability:create', resource: 'water_meter_availability', action: 'create', description: 'Kreiranje dostupnosti vodomera', menuOrder: 501020000001 },
    { name: 'water_meter_availability:view', resource: 'water_meter_availability', action: 'view', description: 'Pregled dostupnosti vodomera', menuOrder: 501020000000 },
    { name: 'water_meter_availability:update', resource: 'water_meter_availability', action: 'update', description: 'Ažuriranje dostupnosti vodomera', menuOrder: 501020000002 },
    { name: 'water_meter_availability:delete', resource: 'water_meter_availability', action: 'delete', description: 'Brisanje dostupnosti vodomera', menuOrder: 501020000003 },

    // Water Meter Manufacturers permissions (menuOrder: 501030000000 + offset)
    { name: 'water_meter_manufacturers:create', resource: 'water_meter_manufacturers', action: 'create', description: 'Kreiranje proizvođača vodomera', menuOrder: 501030000001 },
    { name: 'water_meter_manufacturers:view', resource: 'water_meter_manufacturers', action: 'view', description: 'Pregled proizvođača vodomera', menuOrder: 501030000000 },
    { name: 'water_meter_manufacturers:update', resource: 'water_meter_manufacturers', action: 'update', description: 'Ažuriranje proizvođača vodomera', menuOrder: 501030000002 },
    { name: 'water_meter_manufacturers:delete', resource: 'water_meter_manufacturers', action: 'delete', description: 'Brisanje proizvođača vodomera', menuOrder: 501030000003 },

    // Water Meters permissions (menuOrder: 501040000000 + offset)
    { name: 'water_meters:create', resource: 'water_meters', action: 'create', description: 'Kreiranje vodomera', menuOrder: 501040000001 },
    { name: 'water_meters:view', resource: 'water_meters', action: 'view', description: 'Pregled vodomera', menuOrder: 501040000000 },
    { name: 'water_meters:update', resource: 'water_meters', action: 'update', description: 'Ažuriranje vodomera', menuOrder: 501040000002 },
    { name: 'water_meters:delete', resource: 'water_meters', action: 'delete', description: 'Brisanje vodomera', menuOrder: 501040000003 },

    // Replacement Water Meters permissions (menuOrder: 501050000000 + offset)
    { name: 'replacement_water_meters:create', resource: 'replacement_water_meters', action: 'create', description: 'Kreiranje zamenjenih vodomera', menuOrder: 501050000001 },
    { name: 'replacement_water_meters:view', resource: 'replacement_water_meters', action: 'view', description: 'Pregled zamenjenih vodomera', menuOrder: 501050000000 },
    { name: 'replacement_water_meters:update', resource: 'replacement_water_meters', action: 'update', description: 'Ažuriranje zamenjenih vodomera', menuOrder: 501050000002 },
    { name: 'replacement_water_meters:delete', resource: 'replacement_water_meters', action: 'delete', description: 'Brisanje zamenjenih vodomera', menuOrder: 501050000003 },

    // Water Meter Remarks (Readings) permissions (menuOrder: 501060000000 + offset)
    { name: 'water_meter_remarks:create', resource: 'water_meter_remarks', action: 'create', description: 'Kreiranje napomena vodomera', menuOrder: 501060000001 },
    { name: 'water_meter_remarks:view', resource: 'water_meter_remarks', action: 'view', description: 'Pregled napomena vodomera', menuOrder: 501060000000 },
    { name: 'water_meter_remarks:update', resource: 'water_meter_remarks', action: 'update', description: 'Ažuriranje napomena vodomera', menuOrder: 501060000002 },
    { name: 'water_meter_remarks:delete', resource: 'water_meter_remarks', action: 'delete', description: 'Brisanje napomena vodomera', menuOrder: 501060000003 },

    // Water Supply Notes permissions (menuOrder: 501065000000 + offset)
    { name: 'water_supply_notes:create', resource: 'water_supply_notes', action: 'create', description: 'Kreiranje beleški vodosnabdevanja', menuOrder: 501065000001 },
    { name: 'water_supply_notes:view', resource: 'water_supply_notes', action: 'view', description: 'Pregled beleški vodosnabdevanja', menuOrder: 501065000000 },
    { name: 'water_supply_notes:update', resource: 'water_supply_notes', action: 'update', description: 'Ažuriranje beleški vodosnabdevanja', menuOrder: 501065000002 },
    { name: 'water_supply_notes:delete', resource: 'water_supply_notes', action: 'delete', description: 'Brisanje beleški vodosnabdevanja', menuOrder: 501065000003 },

    // Note Categories permissions (menuOrder: 501066000000 + offset)
    { name: 'note_categories:create', resource: 'note_categories', action: 'create', description: 'Kreiranje kategorija beleški', menuOrder: 501066000001 },
    { name: 'note_categories:view', resource: 'note_categories', action: 'view', description: 'Pregled kategorija beleški', menuOrder: 501066000000 },
    { name: 'note_categories:update', resource: 'note_categories', action: 'update', description: 'Ažuriranje kategorija beleški', menuOrder: 501066000002 },
    { name: 'note_categories:delete', resource: 'note_categories', action: 'delete', description: 'Brisanje kategorija beleški', menuOrder: 501066000003 },

    // Complaints permissions (menuOrder: 501067000000 + offset)
    { name: 'complaints:create', resource: 'complaints', action: 'create', description: 'Kreiranje reklamacija', menuOrder: 501067000001 },
    { name: 'complaints:view', resource: 'complaints', action: 'view', description: 'Pregled reklamacija', menuOrder: 501067000000 },
    { name: 'complaints:update', resource: 'complaints', action: 'update', description: 'Ažuriranje reklamacija', menuOrder: 501067000002 },
    { name: 'complaints:delete', resource: 'complaints', action: 'delete', description: 'Brisanje reklamacija', menuOrder: 501067000003 },

    // Complaints By Assignee permissions (menuOrder: 501067100000 + offset)
    { name: 'complaints_by_assignee:view', resource: 'complaints_by_assignee', action: 'view', description: 'Pregled reklamacija za odgovorno lice', menuOrder: 501067100000 },
    { name: 'complaints_by_assignee:update', resource: 'complaints_by_assignee', action: 'update', description: 'Ažuriranje reklamacija za odgovorno lice', menuOrder: 501067100002 },

    // User Accounts permissions (menuOrder: 501068000000 + offset)
    { name: 'vodovod:user-accounts:create', resource: 'user_accounts', action: 'create', description: 'Kreiranje korisničkih naloga', menuOrder: 501068000001 },
    { name: 'vodovod:user-accounts:read', resource: 'user_accounts', action: 'read', description: 'Pregled korisničkih naloga', menuOrder: 501068000000 },
    { name: 'vodovod:user-accounts:update', resource: 'user_accounts', action: 'update', description: 'Ažuriranje korisničkih naloga', menuOrder: 501068000002 },
    { name: 'vodovod:user-accounts:delete', resource: 'user_accounts', action: 'delete', description: 'Brisanje korisničkih naloga', menuOrder: 501068000003 },

    // Water Services permissions (menuOrder: 501070000000 + offset)
    { name: 'water_services:create', resource: 'water_services', action: 'create', description: 'Kreiranje vodovod usluga', menuOrder: 501070000001 },
    { name: 'water_services:view', resource: 'water_services', action: 'view', description: 'Pregled vodovod usluga', menuOrder: 501070000000 },
    { name: 'water_services:update', resource: 'water_services', action: 'update', description: 'Ažuriranje vodovod usluga', menuOrder: 501070000002 },
    { name: 'water_services:delete', resource: 'water_services', action: 'delete', description: 'Brisanje vodovod usluga', menuOrder: 501070000003 },

    // Water Service Prices permissions (menuOrder: 501080000000 + offset)
    { name: 'water_service_prices:create', resource: 'water_service_prices', action: 'create', description: 'Kreiranje cenovnika vodovod usluga', menuOrder: 501080000001 },
    { name: 'water_service_prices:view', resource: 'water_service_prices', action: 'view', description: 'Pregled cenovnika vodovod usluga', menuOrder: 501080000000 },
    { name: 'water_service_prices:update', resource: 'water_service_prices', action: 'update', description: 'Ažuriranje cenovnika vodovod usluga', menuOrder: 501080000002 },
    { name: 'water_service_prices:delete', resource: 'water_service_prices', action: 'delete', description: 'Brisanje cenovnika vodovod usluga', menuOrder: 501080000003 },

    // Water Service Prices History permissions (menuOrder: 501090000000 + offset)
    { name: 'water_service_prices_history:view', resource: 'water_service_prices_history', action: 'view', description: 'Pregled istorije cenovnika vodovod usluga', menuOrder: 501090000000 },

    // Water Services Review permissions (menuOrder: 501100000000 + offset)
    { name: 'water_services_review:view', resource: 'water_services_review', action: 'view', description: 'Pregled usluga po mernom mestu', menuOrder: 501100000000 },

    // Measuring Points permissions (menuOrder: 502010000000 + offset)
    { name: 'measuring_points:create', resource: 'measuring_points', action: 'create', description: 'Kreiranje mernih mesta', menuOrder: 502010000001 },
    { name: 'measuring_points:view', resource: 'measuring_points', action: 'view', description: 'Pregled mernih mesta', menuOrder: 502010000000 },
    { name: 'measuring_points:update', resource: 'measuring_points', action: 'update', description: 'Ažuriranje mernih mesta', menuOrder: 502010000002 },
    { name: 'measuring_points:delete', resource: 'measuring_points', action: 'delete', description: 'Brisanje mernih mesta', menuOrder: 502010000003 },

    // Measuring Points By Address permissions (menuOrder: 502020000000)
    { name: 'measuring_points_by_address:view', resource: 'measuring_points_by_address', action: 'view', description: 'Pregled mernih mesta po adresi', menuOrder: 502020000000 },

    // Measuring Points Consumption permissions (menuOrder: 502030000000)
    { name: 'measuring_points_consumption:view', resource: 'measuring_points_consumption', action: 'view', description: 'Pregled potrošnje po mernom mestu', menuOrder: 502030000000 },

    // Water System Regions permissions (menuOrder: 503000000000 + offset)
    { name: 'water_system_regions:create', resource: 'water_system_regions', action: 'create', description: 'Kreiranje regiona vodovodnog sistema', menuOrder: 503000000001 },
    { name: 'water_system_regions:read', resource: 'water_system_regions', action: 'read', description: 'Čitanje regiona vodovodnog sistema', menuOrder: 503000000000 },
    { name: 'water_system_regions:view', resource: 'water_system_regions', action: 'view', description: 'Pregled regiona vodovodnog sistema', menuOrder: 503000000000 },
    { name: 'water_system_regions:update', resource: 'water_system_regions', action: 'update', description: 'Ažuriranje regiona vodovodnog sistema', menuOrder: 503000000002 },
    { name: 'water_system_regions:delete', resource: 'water_system_regions', action: 'delete', description: 'Brisanje regiona vodovodnog sistema', menuOrder: 503000000003 },

    // Water System Cities permissions (menuOrder: 503500000000 + offset)
    { name: 'water_system_cities:create', resource: 'water_system_cities', action: 'create', description: 'Kreiranje gradova/naselja vodovodnog sistema', menuOrder: 503500000001 },
    { name: 'water_system_cities:read', resource: 'water_system_cities', action: 'read', description: 'Čitanje gradova/naselja vodovodnog sistema', menuOrder: 503500000000 },
    { name: 'water_system_cities:view', resource: 'water_system_cities', action: 'view', description: 'Pregled gradova/naselja vodovodnog sistema', menuOrder: 503500000000 },
    { name: 'water_system_cities:update', resource: 'water_system_cities', action: 'update', description: 'Ažuriranje gradova/naselja vodovodnog sistema', menuOrder: 503500000002 },
    { name: 'water_system_cities:delete', resource: 'water_system_cities', action: 'delete', description: 'Brisanje gradova/naselja vodovodnog sistema', menuOrder: 503500000003 },

    // Water System Streets permissions (menuOrder: 504000000000 + offset)
    { name: 'water_system_streets:create', resource: 'water_system_streets', action: 'create', description: 'Kreiranje ulica vodovodnog sistema', menuOrder: 504000000001 },
    { name: 'water_system_streets:read', resource: 'water_system_streets', action: 'read', description: 'Čitanje ulica vodovodnog sistema', menuOrder: 504000000000 },
    { name: 'water_system_streets:view', resource: 'water_system_streets', action: 'view', description: 'Pregled ulica vodovodnog sistema', menuOrder: 504000000000 },
    { name: 'water_system_streets:update', resource: 'water_system_streets', action: 'update', description: 'Ažuriranje ulica vodovodnog sistema', menuOrder: 504000000002 },
    { name: 'water_system_streets:delete', resource: 'water_system_streets', action: 'delete', description: 'Brisanje ulica vodovodnog sistema', menuOrder: 504000000003 },

    // Water System Zones permissions (menuOrder: 505000000000 + offset)
    { name: 'water_system_zones:create', resource: 'water_system_zones', action: 'create', description: 'Kreiranje zona vodovodnog sistema', menuOrder: 505000000001 },
    { name: 'water_system_zones:read', resource: 'water_system_zones', action: 'read', description: 'Čitanje zona vodovodnog sistema', menuOrder: 505000000000 },
    { name: 'water_system_zones:view', resource: 'water_system_zones', action: 'view', description: 'Pregled zona vodovodnog sistema', menuOrder: 505000000000 },
    { name: 'water_system_zones:update', resource: 'water_system_zones', action: 'update', description: 'Ažuriranje zona vodovodnog sistema', menuOrder: 505000000002 },
    { name: 'water_system_zones:delete', resource: 'water_system_zones', action: 'delete', description: 'Brisanje zona vodovodnog sistema', menuOrder: 505000000003 },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
        menuOrder: permission.menuOrder,
      },
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