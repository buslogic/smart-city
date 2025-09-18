import { RoutePermissionDto } from '../dto/permission-debug.dto';

export const routePermissionsConfig: RoutePermissionDto[] = [
  // Dashboard
  {
    route: '/dashboard',
    requiredPermissions: ['dashboard:view'],
    optionalPermissions: ['dashboard:update'],
  },

  // Users Management
  {
    route: '/users',
    requiredPermissions: ['users:view'],
    optionalPermissions: ['users:create', 'users:update', 'users:delete'],
  },
  {
    route: '/users/roles-permissions',
    requiredPermissions: ['roles:view', 'permissions:view'],
    optionalPermissions: [
      'roles:create',
      'roles:update',
      'roles:delete',
      'permissions:create',
      'permissions:update',
      'permissions:delete',
    ],
  },

  // Vehicles
  {
    route: '/transport/vehicles',
    requiredPermissions: ['vehicles:read'],
    optionalPermissions: [
      'vehicles:create',
      'vehicles:update',
      'vehicles:delete',
    ],
  },
  {
    route: '/transport/vehicles/sync',
    requiredPermissions: ['vehicles.sync:view'],
    optionalPermissions: [
      'vehicles.sync:start',
      'vehicles.sync:stop',
      'vehicles.sync:configure',
    ],
  },

  // GPS & Tracking
  {
    route: '/transport/gps/tracking',
    requiredPermissions: ['gps:view_tracking'],
    optionalPermissions: ['gps:export'],
  },
  {
    route: '/transport/gps/analytics',
    requiredPermissions: ['gps:view_analytics'],
    optionalPermissions: ['gps:export'],
  },
  {
    route: '/transport/gps/sync',
    requiredPermissions: ['gps:sync'],
    optionalPermissions: [],
  },

  // Safety & Reports
  {
    route: '/transport/safety/aggressive-driving',
    requiredPermissions: ['safety.aggressive.driving:view'],
    optionalPermissions: ['safety.aggressive.driving:export'],
  },
  {
    route: '/transport/safety/monthly-report',
    requiredPermissions: ['vehicles:read', 'safety.reports:view'],
    optionalPermissions: [
      'safety.reports:create',
      'safety.reports:export',
      'safety.reports:configure',
    ],
  },

  // Reports
  {
    route: '/reports',
    requiredPermissions: ['reports.read'],
    optionalPermissions: ['reports.create', 'reports.export'],
  },

  // Settings
  {
    route: '/settings',
    requiredPermissions: ['settings.view'],
    optionalPermissions: ['settings.edit'],
  },
  {
    route: '/settings/system',
    requiredPermissions: ['system:configure'],
    optionalPermissions: [],
  },

  // Profile
  {
    route: '/profile',
    requiredPermissions: [], // Everyone can view their profile
    optionalPermissions: ['profile.edit'],
  },

  // Legacy Databases
  {
    route: '/legacy-databases',
    requiredPermissions: ['legacy_databases:read'],
    optionalPermissions: [
      'legacy_databases:create',
      'legacy_databases:update',
      'legacy_databases:delete',
    ],
  },
];
