import { NavigationItem } from '../types/navigation.types';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Shield,
  Bus,
  Car,
  RefreshCw,
  Map,
  Navigation,
  BarChart3,
  AlertTriangle,
  FileText,
  Activity,
  Settings,
  Sliders,
  Database,
  Clock,
  Gauge,
  Route,
  MapPin,
  TrendingUp,
  AlertCircle,
  Calendar,
  Download,
  Upload,
  Wifi,
  WifiOff,
  Battery,
  Fuel,
  Wrench,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Key,
  FileCheck,
  FileClock,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Zap,
  Radio,
} from 'lucide-react';

export const navigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    permissions: ['dashboard.view'],
    badge: {
      text: 'NEW',
      color: 'green',
    },
  },
  
  {
    id: 'users',
    name: 'Korisnici',
    icon: Users,
    children: [
      {
        id: 'users-admin',
        name: 'Administracija Korisnika',
        href: '/users/administration',
        icon: UserCog,
        permissions: ['users:read'],
      },
      {
        id: 'users-roles',
        name: 'Role i Permisije',
        icon: Shield,
        permissions: ['roles:read'],
        children: [
          {
            id: 'users-roles-manage',
            name: 'Upravljanje Rolama',
            href: '/users/roles-permissions',
            icon: Key,
            permissions: ['roles:manage'],
          },
          {
            id: 'users-roles-audit',
            name: 'Audit Log',
            icon: FileCheck,
            permissions: ['audit:read'],
            children: [
              {
                id: 'users-roles-audit-login',
                name: 'Istorija Prijavljivanja',
                href: '/users/audit/login-history',
                icon: UserCheck,
                permissions: ['audit:login:read'],
              },
              {
                id: 'users-roles-audit-changes',
                name: 'Izmene Permisija',
                href: '/users/audit/permission-changes',
                icon: Lock,
                permissions: ['audit:permissions:read'],
              },
              {
                id: 'users-roles-audit-data',
                name: 'Izmene Podataka',
                href: '/users/audit/data-changes',
                icon: FileClock,
                permissions: ['audit:data:read'],
                badge: {
                  text: '12',
                  color: 'red',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'users-divider',
        name: '',
        divider: true,
      },
      {
        id: 'users-sessions',
        name: 'Aktivne Sesije',
        href: '/users/sessions',
        icon: UserX,
        permissions: ['sessions:manage'],
        description: 'Online: 45',
      },
    ],
  },
  
  {
    id: 'transport',
    name: 'Autobuski Prevoznici',
    icon: Bus,
    children: [
      {
        id: 'transport-vehicles',
        name: 'Upravljanje Vozilima',
        icon: Car,
        children: [
          {
            id: 'transport-vehicles-admin',
            name: 'Administracija Vozila',
            href: '/transport/vehicles',
            icon: Car,
            permissions: ['vehicles:read'],
          },
          {
            id: 'transport-vehicles-sync',
            name: 'Sinhronizacija Vozila',
            href: '/transport/vehicle-sync',
            icon: RefreshCw,
            permissions: ['vehicles:sync'],
          },
          {
            id: 'transport-vehicles-maintenance',
            name: 'Održavanje',
            icon: Wrench,
            children: [
              {
                id: 'transport-vehicles-maintenance-schedule',
                name: 'Raspored Servisa',
                href: '/transport/vehicles/maintenance/schedule',
                icon: Calendar,
                permissions: ['maintenance:view'],
              },
              {
                id: 'transport-vehicles-maintenance-history',
                name: 'Istorija Servisa',
                href: '/transport/vehicles/maintenance/history',
                icon: FileClock,
                permissions: ['maintenance:history'],
              },
              {
                id: 'transport-vehicles-maintenance-alerts',
                name: 'Upozorenja',
                href: '/transport/vehicles/maintenance/alerts',
                icon: AlertCircle,
                permissions: ['maintenance:alerts'],
                badge: {
                  text: '3',
                  color: 'yellow',
                },
              },
            ],
          },
        ],
      },
      
      {
        id: 'transport-dispatcher',
        name: 'Dispečerski Modul',
        icon: Navigation,
        children: [
          {
            id: 'transport-dispatcher-live',
            name: 'Praćenje Uživo',
            icon: Radio,
            children: [
              {
                id: 'transport-dispatcher-map',
                name: 'Mapa i Vozila',
                href: '/transport/dispatcher/map-vehicles',
                icon: Map,
                permissions: ['dispatcher:view_map'],
              },
              {
                id: 'transport-dispatcher-routes',
                name: 'Aktivne Rute',
                href: '/transport/dispatcher/active-routes',
                icon: Route,
                permissions: ['dispatcher:view_routes'],
                badge: {
                  text: 'LIVE',
                  color: 'red',
                },
              },
              {
                id: 'transport-dispatcher-geofence',
                name: 'Geofence Zone',
                href: '/transport/dispatcher/geofence',
                icon: MapPin,
                permissions: ['dispatcher:geofence'],
              },
            ],
          },
          
          {
            id: 'transport-dispatcher-analytics',
            name: 'Analitika',
            icon: BarChart3,
            children: [
              {
                id: 'transport-dispatcher-analytics-vehicle',
                name: 'Analiza Vozila',
                href: '/transport/dispatcher/analytics',
                icon: TrendingUp,
                permissions: ['dispatcher:view_analytics'],
              },
              {
                id: 'transport-dispatcher-analytics-driver',
                name: 'Analiza Vozača',
                href: '/transport/dispatcher/driver-analytics',
                icon: UserCheck,
                permissions: ['dispatcher:driver_analytics'],
              },
              {
                id: 'transport-dispatcher-analytics-fuel',
                name: 'Potrošnja Goriva',
                href: '/transport/dispatcher/fuel-analytics',
                icon: Fuel,
                permissions: ['dispatcher:fuel_analytics'],
              },
              {
                id: 'transport-dispatcher-analytics-speed',
                name: 'Analiza Brzine',
                href: '/transport/dispatcher/speed-analytics',
                icon: Gauge,
                permissions: ['dispatcher:speed_analytics'],
              },
            ],
          },
          
          {
            id: 'transport-dispatcher-sync',
            name: 'Sinhronizacija',
            icon: RefreshCw,
            children: [
              {
                id: 'transport-dispatcher-sync-gps',
                name: 'GPS Sinhronizacija',
                href: '/transport/dispatcher/gps-sync',
                icon: RefreshCw,
                permissions: ['dispatcher:sync_gps'],
              },
              {
                id: 'transport-dispatcher-sync-dashboard',
                name: 'Dashboard Sinhronizacije',
                href: '/transport/dispatcher/gps-sync-dashboard',
                icon: Activity,
                permissions: ['dispatcher:view_sync_dashboard'],
              },
              {
                id: 'transport-dispatcher-sync-status',
                name: 'Status Konekcije',
                icon: Wifi,
                children: [
                  {
                    id: 'transport-dispatcher-sync-status-online',
                    name: 'Online Vozila',
                    href: '/transport/dispatcher/sync/online',
                    icon: Wifi,
                    permissions: ['dispatcher:sync_status'],
                    description: '127/150',
                  },
                  {
                    id: 'transport-dispatcher-sync-status-offline',
                    name: 'Offline Vozila',
                    href: '/transport/dispatcher/sync/offline',
                    icon: WifiOff,
                    permissions: ['dispatcher:sync_status'],
                    description: '23/150',
                  },
                  {
                    id: 'transport-dispatcher-sync-status-battery',
                    name: 'Status Baterije',
                    href: '/transport/dispatcher/sync/battery',
                    icon: Battery,
                    permissions: ['dispatcher:sync_battery'],
                  },
                ],
              },
            ],
          },
        ],
      },
      
      {
        id: 'transport-legacy',
        name: 'Legacy Integracija',
        icon: Database,
        children: [
          {
            id: 'transport-legacy-sync',
            name: 'GPS Sinhronizacija',
            href: '/transport/legacy-sync',
            icon: RefreshCw,
            permissions: ['legacy_sync.view'],
          },
          {
            id: 'transport-legacy-import',
            name: 'Import Podataka',
            href: '/transport/legacy/import',
            icon: Download,
            permissions: ['legacy:import'],
          },
          {
            id: 'transport-legacy-export',
            name: 'Export Podataka',
            href: '/transport/legacy/export',
            icon: Upload,
            permissions: ['legacy:export'],
          },
        ],
      },
      
      {
        id: 'transport-safety',
        name: 'Bezbednost',
        icon: AlertTriangle,
        children: [
          {
            id: 'transport-safety-driving',
            name: 'Analiza Vožnje',
            icon: Gauge,
            children: [
              {
                id: 'transport-safety-aggressive',
                name: 'Agresivna Vožnja',
                href: '/transport/safety/aggressive-driving',
                icon: AlertTriangle,
                permissions: ['safety:view_aggressive'],
                badge: {
                  text: '7',
                  color: 'red',
                },
              },
              {
                id: 'transport-safety-speeding',
                name: 'Prekoračenje Brzine',
                href: '/transport/safety/speeding',
                icon: Zap,
                permissions: ['safety:view_speeding'],
              },
              {
                id: 'transport-safety-harsh-events',
                name: 'Nagli Manevri',
                icon: AlertCircle,
                children: [
                  {
                    id: 'transport-safety-harsh-braking',
                    name: 'Naglo Kočenje',
                    href: '/transport/safety/harsh-braking',
                    permissions: ['safety:harsh_braking'],
                  },
                  {
                    id: 'transport-safety-harsh-acceleration',
                    name: 'Naglo Ubrzanje',
                    href: '/transport/safety/harsh-acceleration',
                    permissions: ['safety:harsh_acceleration'],
                  },
                  {
                    id: 'transport-safety-harsh-cornering',
                    name: 'Naglo Skretanje',
                    href: '/transport/safety/harsh-cornering',
                    permissions: ['safety:harsh_cornering'],
                  },
                ],
              },
            ],
          },
          {
            id: 'transport-safety-reports',
            name: 'Izveštaji',
            icon: FileText,
            children: [
              {
                id: 'transport-safety-monthly',
                name: 'Mesečni Izveštaj',
                href: '/transport/safety/monthly-report',
                icon: Calendar,
                permissions: ['safety:view_report'],
              },
              {
                id: 'transport-safety-driver-score',
                name: 'Bodovanje Vozača',
                href: '/transport/safety/driver-score',
                icon: TrendingUp,
                permissions: ['safety:driver_score'],
              },
              {
                id: 'transport-safety-incidents',
                name: 'Incidenti',
                href: '/transport/safety/incidents',
                icon: AlertCircle,
                permissions: ['safety:incidents'],
              },
            ],
          },
        ],
      },
    ],
  },
  
  {
    id: 'settings',
    name: 'Podešavanje',
    icon: Settings,
    children: [
      {
        id: 'settings-general',
        name: 'Opšta Podešavanja',
        href: '/settings/general',
        icon: Sliders,
        permissions: ['settings:general:read'],
      },
      {
        id: 'settings-system',
        name: 'Sistem',
        icon: Server,
        children: [
          {
            id: 'settings-system-database',
            name: 'Baza Podataka',
            icon: Database,
            children: [
              {
                id: 'settings-system-database-mysql',
                name: 'MySQL Status',
                href: '/settings/system/database/mysql',
                icon: HardDrive,
                permissions: ['system:database:view'],
              },
              {
                id: 'settings-system-database-timescale',
                name: 'TimescaleDB Status',
                href: '/settings/system/database/timescale',
                icon: Clock,
                permissions: ['system:database:view'],
              },
              {
                id: 'settings-system-database-redis',
                name: 'Redis Cache',
                href: '/settings/system/database/redis',
                icon: MemoryStick,
                permissions: ['system:cache:view'],
              },
            ],
          },
          {
            id: 'settings-system-performance',
            name: 'Performanse',
            icon: Cpu,
            children: [
              {
                id: 'settings-system-performance-monitoring',
                name: 'Monitoring',
                href: '/settings/system/performance/monitoring',
                icon: Activity,
                permissions: ['system:monitoring:view'],
              },
              {
                id: 'settings-system-performance-logs',
                name: 'Sistem Logovi',
                href: '/settings/system/performance/logs',
                icon: FileText,
                permissions: ['system:logs:view'],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Helper funkcija za dobijanje svih href-ova iz navigacije
export const getAllRoutes = (items: NavigationItem[] = navigationConfig): string[] => {
  const routes: string[] = [];
  
  const extractRoutes = (navItems: NavigationItem[]) => {
    navItems.forEach(item => {
      if (item.href) {
        routes.push(item.href);
      }
      if (item.children) {
        extractRoutes(item.children);
      }
    });
  };
  
  extractRoutes(items);
  return routes;
};

// Helper funkcija za pronalaženje stavke po ID-u
export const findNavigationItemById = (
  id: string, 
  items: NavigationItem[] = navigationConfig
): NavigationItem | null => {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    if (item.children) {
      const found = findNavigationItemById(id, item.children);
      if (found) return found;
    }
  }
  return null;
};

// Helper funkcija za dobijanje breadcrumb putanje
export const getBreadcrumbPath = (
  pathname: string,
  items: NavigationItem[] = navigationConfig
): NavigationItem[] => {
  const path: NavigationItem[] = [];
  
  const findPath = (navItems: NavigationItem[], currentPath: NavigationItem[]): boolean => {
    for (const item of navItems) {
      const newPath = [...currentPath, item];
      
      if (item.href === pathname) {
        path.push(...newPath);
        return true;
      }
      
      if (item.children) {
        if (findPath(item.children, newPath)) {
          return true;
        }
      }
    }
    return false;
  };
  
  findPath(items, []);
  return path;
};