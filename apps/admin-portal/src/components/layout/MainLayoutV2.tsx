import React, { useState } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Button, Space, Tag } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import {
  Users,
  ChevronDown,
  Menu as MenuIcon,
  X,
  Shield,
  UserCog,
  Settings,
  Sliders,
  Bus,
  Car,
  RefreshCw,
  Map,
  Navigation,
  BarChart3,
  AlertTriangle,
  FileText,
  Activity,
  LayoutDashboard,
  ChevronRight,
  Circle,
  Wrench,
  Calendar,
  FileClock,
  AlertCircle,
  Database,
  Radio,
  Route,
  MapPin,
  TrendingUp,
  UserCheck,
  Fuel,
  Gauge,
  Wifi,
  WifiOff,
  Battery,
  Download,
  Upload,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { usePermissions } from '../../hooks/usePermissions';
import { getAvatarUrl } from '../../utils/avatar';
import PermissionsDebugger from '../permissions/PermissionsDebugger';

interface MenuItem {
  name: string;
  icon?: any;
  href?: string;
  hasSubmenu?: boolean;
  isOpen?: boolean;
  setOpen?: (open: boolean) => void;
  submenu?: MenuItem[];
  permissions?: string[];
  badge?: {
    text: string;
    color: 'red' | 'yellow' | 'green' | 'blue';
  };
  divider?: boolean;
}

const MainLayoutEnhanced: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { hasPermission } = usePermissions();

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  // Filtriranje navigacije na osnovu permisija
  const navigation: MenuItem[] = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      permissions: ['dashboard.view'],
    },
    
    {
      name: 'Korisnici',
      icon: Users,
      hasSubmenu: true,
      isOpen: expandedSections.has('Korisnici'),
      setOpen: () => toggleSection('Korisnici'),
      submenu: [
        {
          name: 'Administracija Korisnika',
          href: '/users/administration',
          icon: UserCog,
          permissions: ['users:read'],
        },
        {
          name: 'Role i Permisije',
          icon: Shield,
          hasSubmenu: true,
          isOpen: expandedSections.has('Role i Permisije'),
          setOpen: () => toggleSection('Role i Permisije'),
          submenu: [
            {
              name: 'Upravljanje Rolama',
              href: '/users/roles-permissions',
              icon: Shield,
              permissions: ['roles:read'],
            },
            {
              name: 'Audit Log',
              icon: FileText,
              hasSubmenu: true,
              isOpen: expandedSections.has('Audit Log'),
              setOpen: () => toggleSection('Audit Log'),
              submenu: [
                {
                  name: 'Istorija Prijavljivanja',
                  href: '/users/audit/login-history',
                  icon: UserCheck,
                  permissions: ['audit:login:read'],
                },
                {
                  name: 'Izmene Permisija',
                  href: '/users/audit/permission-changes',
                  icon: Shield,
                  permissions: ['audit:permissions:read'],
                },
                {
                  name: 'Izmene Podataka',
                  href: '/users/audit/data-changes',
                  icon: FileClock,
                  permissions: ['audit:data:read'],
                  badge: { text: '12', color: 'red' },
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
        },
      ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
    },
    
    {
      name: 'Autobuski Prevoznici',
      icon: Bus,
      hasSubmenu: true,
      isOpen: expandedSections.has('Autobuski Prevoznici'),
      setOpen: () => toggleSection('Autobuski Prevoznici'),
      submenu: [
        {
          name: 'Upravljanje Vozilima',
          icon: Car,
          hasSubmenu: true,
          isOpen: expandedSections.has('Upravljanje Vozilima'),
          setOpen: () => toggleSection('Upravljanje Vozilima'),
          submenu: [
            {
              name: 'Administracija Vozila',
              href: '/transport/vehicles',
              icon: Car,
              permissions: ['vehicles:read'],
            },
            {
              name: 'Sinhronizacija Vozila',
              href: '/transport/vehicle-sync',
              icon: RefreshCw,
              permissions: ['vehicles:sync'],
            },
            {
              name: 'Održavanje',
              icon: Wrench,
              hasSubmenu: true,
              isOpen: expandedSections.has('Održavanje'),
              setOpen: () => toggleSection('Održavanje'),
              submenu: [
                {
                  name: 'Raspored Servisa',
                  href: '/transport/vehicles/maintenance/schedule',
                  icon: Calendar,
                  permissions: ['maintenance:view'],
                },
                {
                  name: 'Istorija Servisa',
                  href: '/transport/vehicles/maintenance/history',
                  icon: FileClock,
                  permissions: ['maintenance:history'],
                },
                {
                  name: 'Upozorenja',
                  href: '/transport/vehicles/maintenance/alerts',
                  icon: AlertCircle,
                  permissions: ['maintenance:alerts'],
                  badge: { text: '3', color: 'yellow' },
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
        },
        
        {
          name: 'Dispečerski Modul',
          icon: Navigation,
          hasSubmenu: true,
          isOpen: expandedSections.has('Dispečerski Modul'),
          setOpen: () => toggleSection('Dispečerski Modul'),
          submenu: [
            {
              name: 'Praćenje Uživo',
              icon: Radio,
              hasSubmenu: true,
              isOpen: expandedSections.has('Praćenje Uživo'),
              setOpen: () => toggleSection('Praćenje Uživo'),
              submenu: [
                {
                  name: 'Mapa i Vozila',
                  href: '/transport/dispatcher/map-vehicles',
                  icon: Map,
                  permissions: ['dispatcher:view_map'],
                },
                {
                  name: 'Aktivne Rute',
                  href: '/transport/dispatcher/active-routes',
                  icon: Route,
                  permissions: ['dispatcher:view_routes'],
                  badge: { text: 'LIVE', color: 'red' },
                },
                {
                  name: 'Geofence Zone',
                  href: '/transport/dispatcher/geofence',
                  icon: MapPin,
                  permissions: ['dispatcher:geofence'],
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
            },
            {
              name: 'Analitika',
              icon: BarChart3,
              hasSubmenu: true,
              isOpen: expandedSections.has('Analitika'),
              setOpen: () => toggleSection('Analitika'),
              submenu: [
                {
                  name: 'Analiza Vozila',
                  href: '/transport/dispatcher/analytics',
                  icon: TrendingUp,
                  permissions: ['dispatcher:view_analytics'],
                },
                {
                  name: 'Analiza Vozača',
                  href: '/transport/dispatcher/driver-analytics',
                  icon: UserCheck,
                  permissions: ['dispatcher:driver_analytics'],
                },
                {
                  name: 'Potrošnja Goriva',
                  href: '/transport/dispatcher/fuel-analytics',
                  icon: Fuel,
                  permissions: ['dispatcher:fuel_analytics'],
                },
                {
                  name: 'Analiza Brzine',
                  href: '/transport/dispatcher/speed-analytics',
                  icon: Gauge,
                  permissions: ['dispatcher:speed_analytics'],
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
            },
            {
              name: 'Sinhronizacija',
              icon: RefreshCw,
              hasSubmenu: true,
              isOpen: expandedSections.has('Sinhronizacija'),
              setOpen: () => toggleSection('Sinhronizacija'),
              submenu: [
                {
                  name: 'GPS Sinhronizacija',
                  href: '/transport/dispatcher/gps-sync',
                  icon: RefreshCw,
                  permissions: ['dispatcher:sync_gps'],
                },
                {
                  name: 'Dashboard Sinhronizacije',
                  href: '/transport/dispatcher/gps-sync-dashboard',
                  icon: Activity,
                  permissions: ['dispatcher:view_sync_dashboard'],
                },
                {
                  name: 'Status Konekcije',
                  icon: Wifi,
                  hasSubmenu: true,
                  isOpen: expandedSections.has('Status Konekcije'),
                  setOpen: () => toggleSection('Status Konekcije'),
                  submenu: [
                    {
                      name: 'Online Vozila (127/150)',
                      href: '/transport/dispatcher/sync/online',
                      icon: Wifi,
                      permissions: ['dispatcher:sync_status'],
                    },
                    {
                      name: 'Offline Vozila (23/150)',
                      href: '/transport/dispatcher/sync/offline',
                      icon: WifiOff,
                      permissions: ['dispatcher:sync_status'],
                    },
                    {
                      name: 'Status Baterije',
                      href: '/transport/dispatcher/sync/battery',
                      icon: Battery,
                      permissions: ['dispatcher:sync_battery'],
                    },
                  ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
        },
        
        {
          name: 'Legacy Integracija',
          icon: Database,
          hasSubmenu: true,
          isOpen: expandedSections.has('Legacy Integracija'),
          setOpen: () => toggleSection('Legacy Integracija'),
          submenu: [
            {
              name: 'GPS Sinhronizacija',
              href: '/transport/legacy-sync',
              icon: RefreshCw,
              permissions: ['legacy_sync.view'],
            },
            {
              name: 'Import Podataka',
              href: '/transport/legacy/import',
              icon: Download,
              permissions: ['legacy:import'],
            },
            {
              name: 'Export Podataka',
              href: '/transport/legacy/export',
              icon: Upload,
              permissions: ['legacy:export'],
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
        },
        
        {
          name: 'Bezbednost',
          icon: AlertTriangle,
          hasSubmenu: true,
          isOpen: expandedSections.has('Bezbednost'),
          setOpen: () => toggleSection('Bezbednost'),
          submenu: [
            {
              name: 'Analiza Vožnje',
              icon: Gauge,
              hasSubmenu: true,
              isOpen: expandedSections.has('Analiza Vožnje'),
              setOpen: () => toggleSection('Analiza Vožnje'),
              submenu: [
                {
                  name: 'Agresivna Vožnja',
                  href: '/transport/safety/aggressive-driving',
                  icon: AlertTriangle,
                  permissions: ['safety:view_aggressive'],
                  badge: { text: '7', color: 'red' },
                },
                {
                  name: 'Prekoračenje Brzine',
                  href: '/transport/safety/speeding',
                  icon: Zap,
                  permissions: ['safety:view_speeding'],
                },
                {
                  name: 'Nagli Manevri',
                  icon: AlertCircle,
                  hasSubmenu: true,
                  isOpen: expandedSections.has('Nagli Manevri'),
                  setOpen: () => toggleSection('Nagli Manevri'),
                  submenu: [
                    {
                      name: 'Naglo Kočenje',
                      href: '/transport/safety/harsh-braking',
                      permissions: ['safety:harsh_braking'],
                    },
                    {
                      name: 'Naglo Ubrzanje',
                      href: '/transport/safety/harsh-acceleration',
                      permissions: ['safety:harsh_acceleration'],
                    },
                    {
                      name: 'Naglo Skretanje',
                      href: '/transport/safety/harsh-cornering',
                      permissions: ['safety:harsh_cornering'],
                    },
                  ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
            },
            {
              name: 'Izveštaji',
              icon: FileText,
              hasSubmenu: true,
              isOpen: expandedSections.has('Izveštaji'),
              setOpen: () => toggleSection('Izveštaji'),
              submenu: [
                {
                  name: 'Mesečni Izveštaj',
                  href: '/transport/safety/monthly-report',
                  icon: Calendar,
                  permissions: ['safety:view_report'],
                },
                {
                  name: 'Bodovanje Vozača',
                  href: '/transport/safety/driver-score',
                  icon: TrendingUp,
                  permissions: ['safety:driver_score'],
                },
                {
                  name: 'Incidenti',
                  href: '/transport/safety/incidents',
                  icon: AlertCircle,
                  permissions: ['safety:incidents'],
                },
              ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
        },
      ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p)) || item.hasSubmenu),
    },
    
    {
      name: 'Podešavanje',
      icon: Settings,
      hasSubmenu: true,
      isOpen: expandedSections.has('Podešavanje'),
      setOpen: () => toggleSection('Podešavanje'),
      submenu: [
        {
          name: 'Opšta Podešavanja',
          href: '/settings/general',
          icon: Sliders,
          permissions: ['settings:general:read'],
        },
      ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
    },
  ].filter(item => 
    !item.permissions || 
    item.permissions.some(p => hasPermission(p)) || 
    (item.hasSubmenu && item.submenu && item.submenu.length > 0)
  );

  // Rekurzivna funkcija za renderovanje menija
  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    if (item.divider) {
      return <div key={`divider-${level}`} className="my-2 border-t border-gray-200" />;
    }

    const hasAccess = !item.permissions || item.permissions.some(p => hasPermission(p));
    if (!hasAccess && !item.hasSubmenu) return null;

    const paddingLeft = `${(level + 1) * 12}px`;
    const iconSize = level === 0 ? 'h-5 w-5' : level === 1 ? 'h-4 w-4' : level === 2 ? 'h-3 w-3' : 'h-2 w-2';
    
    // Stilovi po nivoima
    const getLevelStyles = () => {
      switch(level) {
        case 0:
          return {
            text: 'text-gray-700 font-semibold',
            hover: 'hover:text-blue-600',
            active: 'text-blue-700 font-bold',
            icon: 'text-gray-400',
            activeIcon: 'text-blue-600',
            hoverBg: 'hover:bg-gradient-to-r hover:from-transparent hover:via-blue-50/50 hover:to-transparent',
            activeBg: 'bg-gradient-to-r from-transparent via-blue-100/70 to-transparent',
            leftAccent: '',
            size: 'text-sm'
          };
        case 1:
          return {
            text: 'text-gray-600 font-medium',
            hover: 'hover:text-indigo-600',
            active: 'text-indigo-700 font-semibold',
            icon: 'text-gray-400',
            activeIcon: 'text-indigo-500',
            hoverBg: 'hover:bg-gradient-to-r hover:from-transparent hover:via-indigo-50/40 hover:to-transparent',
            activeBg: 'bg-gradient-to-r from-transparent via-indigo-100/60 to-transparent',
            leftAccent: 'border-l-2 border-transparent hover:border-indigo-300',
            size: 'text-sm'
          };
        case 2:
          return {
            text: 'text-gray-500 font-normal',
            hover: 'hover:text-purple-600',
            active: 'text-purple-700 font-medium',
            icon: 'text-gray-350',
            activeIcon: 'text-purple-500',
            hoverBg: 'hover:bg-gradient-to-r hover:from-transparent hover:via-purple-50/30 hover:to-transparent',
            activeBg: 'bg-gradient-to-r from-transparent via-purple-100/50 to-transparent',
            leftAccent: 'border-l-2 border-transparent hover:border-purple-300',
            size: 'text-xs'
          };
        case 3:
          return {
            text: 'text-gray-400 font-light',
            hover: 'hover:text-emerald-600',
            active: 'text-emerald-700 font-normal',
            icon: 'text-gray-300',
            activeIcon: 'text-emerald-500',
            hoverBg: 'hover:bg-gradient-to-r hover:from-transparent hover:via-emerald-50/20 hover:to-transparent',
            activeBg: 'bg-gradient-to-r from-transparent via-emerald-100/40 to-transparent',
            leftAccent: 'border-l-2 border-transparent hover:border-emerald-300',
            size: 'text-xs'
          };
        default:
          return {
            text: 'text-gray-400 font-light',
            hover: 'hover:text-gray-600',
            active: 'text-gray-700',
            icon: 'text-gray-300',
            activeIcon: 'text-gray-500',
            hoverBg: 'hover:bg-gray-50/50',
            activeBg: 'bg-gray-100/50',
            leftAccent: 'border-l border-gray-200',
            size: 'text-xs'
          };
      }
    };
    
    const styles = getLevelStyles();
    const isActive = location.pathname === item.href;

    if (item.hasSubmenu) {
      const hasAccessibleChildren = item.submenu?.some(child => 
        !child.permissions || child.permissions.some(p => hasPermission(p))
      );
      
      if (!hasAccessibleChildren) return null;

      return (
        <div key={item.name} className="relative">
          {level > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent opacity-50" 
                 style={{ marginLeft: `${level * 12}px` }} />
          )}
          <button
            onClick={() => item.setOpen?.(!item.isOpen)}
            className={`w-full group relative flex items-center px-3 py-1.5 transition-all duration-200 ${styles.text} ${styles.hover} ${styles.size} ${
              item.isOpen ? `${styles.activeBg} ${styles.active}` : styles.hoverBg
            } ${styles.leftAccent}`}
            style={{ paddingLeft }}
          >
            {level > 0 && item.isOpen && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${
                level === 1 ? 'from-blue-400 to-blue-600' :
                level === 2 ? 'from-purple-400 to-purple-600' :
                level === 3 ? 'from-emerald-400 to-emerald-600' :
                'from-gray-400 to-gray-600'
              }" />
            )}
            {item.icon && (
              <item.icon className={`mr-2.5 ${iconSize} transition-all duration-200 ${
                item.isOpen ? styles.activeIcon : styles.icon
              } group-hover:scale-110 group-hover:${styles.activeIcon}`} />
            )}
            {!item.icon && level > 0 && (
              <div className={`mr-2.5 ${iconSize} rounded-full opacity-60 bg-gradient-to-br ${
                level === 1 ? 'from-blue-300 to-blue-400' :
                level === 2 ? 'from-purple-300 to-purple-400' :
                level === 3 ? 'from-emerald-300 to-emerald-400' :
                'from-gray-300 to-gray-400'
              }`} />
            )}
            <span className="flex-1 text-left transition-all duration-200 group-hover:translate-x-0.5">
              {item.name}
            </span>
            {item.badge && (
              <span className={`mr-1 px-2 py-0.5 text-xs font-bold rounded-full shadow-sm ${
                item.badge.color === 'red' ? 'bg-gradient-to-r from-red-100 to-red-50 text-red-700 animate-pulse' :
                item.badge.color === 'yellow' ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-700' :
                item.badge.color === 'green' ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700' :
                'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700'
              }`}>
                {item.badge.text}
              </span>
            )}
            <ChevronRight className={`ml-1 h-3.5 w-3.5 transition-all duration-300 ${
              item.isOpen ? 'rotate-90 scale-110' : 'group-hover:translate-x-0.5'
            } ${styles.icon} opacity-60`} />
          </button>
          {item.isOpen && (
            <div className="mt-0.5 space-y-0">
              {item.submenu?.map((subitem) => renderMenuItem(subitem, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={item.name} className="relative">
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent opacity-50" 
               style={{ marginLeft: `${level * 12}px` }} />
        )}
        <Link
          to={item.href || '/'}
          className={`group relative flex items-center px-3 py-1.5 transition-all duration-200 ${
            isActive ? `${styles.activeBg} ${styles.active}` : `${styles.text} ${styles.hover} ${styles.hoverBg}`
          } ${styles.size} ${styles.leftAccent}`}
          style={{ paddingLeft }}
          onClick={() => setSidebarOpen(false)}
        >
          {isActive && level > 0 && (
            <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${
              level === 1 ? 'from-blue-400 to-blue-600' :
              level === 2 ? 'from-purple-400 to-purple-600' :
              level === 3 ? 'from-emerald-400 to-emerald-600' :
              'from-gray-400 to-gray-600'
            }`} />
          )}
          {item.icon && (
            <item.icon className={`mr-2.5 ${iconSize} transition-all duration-200 ${
              isActive ? styles.activeIcon : styles.icon
            } group-hover:scale-110 group-hover:${styles.activeIcon}`} />
          )}
          {!item.icon && level > 0 && (
            <div className={`mr-2.5 ${iconSize} rounded-full opacity-60 bg-gradient-to-br ${
              level === 1 ? 'from-blue-300 to-blue-400' :
              level === 2 ? 'from-purple-300 to-purple-400' :
              level === 3 ? 'from-emerald-300 to-emerald-400' :
              'from-gray-300 to-gray-400'
            }`} />
          )}
          <span className={`flex-1 transition-all duration-200 group-hover:translate-x-0.5`}>
            {item.name}
          </span>
          {item.badge && (
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full shadow-sm ${
              item.badge.color === 'red' ? 'bg-gradient-to-r from-red-100 to-red-50 text-red-700 animate-pulse' :
              item.badge.color === 'yellow' ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-700' :
              item.badge.color === 'green' ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700' :
              'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700'
            }`}>
              {item.badge.text}
            </span>
          )}
          {isActive && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-current opacity-60" />
          )}
        </Link>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 flex z-40">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto bg-gradient-to-b from-white to-gray-50">
              <div className="flex-shrink-0 flex items-center px-4 mb-2">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Smart City Admin</h2>
              </div>
              <div className="px-4 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Navigacija</div>
              </div>
              <nav className="px-2 space-y-0.5">
                {navigation.map((item) => renderMenuItem(item))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white shadow">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto bg-gradient-to-b from-white to-gray-50">
            <div className="flex items-center flex-shrink-0 px-4 mb-2">
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Smart City Admin</h2>
            </div>
            <div className="px-4 mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Navigacija</div>
            </div>
            <nav className="flex-1 px-2 space-y-0.5">
              {navigation.map((item) => renderMenuItem(item))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 lg:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white shadow">
          <button
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white shadow">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  onClick={() => setSidebarOpen(true)}
                >
                  <MenuIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center">
                <Space>
                  <div className="text-sm text-gray-600">
                    <div>{user?.firstName} {user?.lastName}</div>
                    <div className="text-xs text-gray-400">
                      {user?.roles?.map(role => (
                        <Tag key={role} color="blue">
                          {role}
                        </Tag>
                      ))}
                    </div>
                  </div>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'profile',
                          icon: <UserOutlined />,
                          label: 'Profil',
                          onClick: () => navigate('/users/profile'),
                        },
                        {
                          type: 'divider',
                        },
                        {
                          key: 'logout',
                          icon: <LogoutOutlined />,
                          label: 'Odjavi se',
                          onClick: logout,
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <Button type="text" icon={
                      <Avatar 
                        size="small" 
                        src={getAvatarUrl(user?.avatar)} 
                        icon={!user?.avatar && <UserOutlined />} 
                      />
                    }>
                      {user?.firstName}
                    </Button>
                  </Dropdown>
                </Space>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Permissions Debugger FAB */}
      <PermissionsDebugger />
    </div>
  );
};

export default MainLayoutEnhanced;