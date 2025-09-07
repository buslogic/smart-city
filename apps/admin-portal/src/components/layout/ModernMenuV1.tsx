import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Users,
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
  LogOut,
  User,
  Hash,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { usePermissions } from '../../hooks/usePermissions';

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
    type: 'danger' | 'warning' | 'success' | 'info';
  };
  divider?: boolean;
  description?: string;
}

const ModernMenuV1: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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

  // Auto-expand active path
  useEffect(() => {
    const path = location.pathname;
    // Auto expand parent menus if child is active
    if (path.includes('/users/')) expandedSections.add('Korisnici');
    if (path.includes('/transport/')) expandedSections.add('Autobuski Prevoznici');
    if (path.includes('/settings/')) expandedSections.add('Podešavanje');
    if (path.includes('/dispatcher/')) expandedSections.add('Dispečerski Modul');
    if (path.includes('/safety/')) expandedSections.add('Bezbednost');
    setExpandedSections(new Set(expandedSections));
  }, [location.pathname]);

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
          name: 'Administracija',
          href: '/users/administration',
          icon: UserCog,
          permissions: ['users:read'],
        },
        {
          name: 'Role i Permisije',
          href: '/users/roles-permissions',
          icon: Shield,
          permissions: ['roles:read'],
        },
      ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
    },
    
    {
      name: 'Autobuski Prevoznici',
      icon: Bus,
      hasSubmenu: true,
      isOpen: expandedSections.has('Autobuski Prevoznici'),
      setOpen: () => toggleSection('Autobuski Prevoznici'),
      submenu: [
        {
          name: 'Dispečerski Modul',
          icon: Navigation,
          hasSubmenu: true,
          isOpen: expandedSections.has('Dispečerski Modul'),
          setOpen: () => toggleSection('Dispečerski Modul'),
          submenu: [
            {
              name: 'Mapa',
              href: '/transport/dispatcher/map-vehicles',
              icon: Map,
              permissions: ['dispatcher:view_map'],
            },
            {
              name: 'Analitika',
              href: '/transport/dispatcher/analytics',
              icon: BarChart3,
              permissions: ['dispatcher:view_analytics'],
            },
            {
              name: 'GPS Sync',
              href: '/transport/dispatcher/gps-sync',
              icon: Radio,
              permissions: ['dispatcher:sync_gps'],
              badge: { text: 'LIVE', type: 'danger' },
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
              name: 'Agresivna Vožnja',
              href: '/transport/safety/aggressive-driving',
              icon: Gauge,
              permissions: ['safety:view_aggressive'],
              badge: { text: '7', type: 'warning' },
            },
            {
              name: 'Mesečni Izveštaj',
              href: '/transport/safety/monthly-report',
              icon: FileText,
              permissions: ['safety:view_report'],
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
        },
        {
          name: 'Vozila',
          href: '/transport/vehicles',
          icon: Car,
          permissions: ['vehicles:read'],
        },
        {
          name: 'Sinhronizacija',
          href: '/transport/vehicle-sync',
          icon: RefreshCw,
          permissions: ['vehicles:sync'],
        },
        {
          name: 'Legacy Sync',
          href: '/transport/legacy-sync',
          icon: Database,
          permissions: ['legacy_sync.view'],
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
          name: 'Opšta',
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

  // Hijerarhijski rendering sa pravilnim uvlačenjem
  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasAccess = !item.permissions || item.permissions.some(p => hasPermission(p));
    if (!hasAccess && !item.hasSubmenu) return null;

    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    const paddingLeft = `${level * 20 + 12}px`;

    if (item.hasSubmenu) {
      const hasAccessibleChildren = item.submenu?.some(child => 
        !child.permissions || child.permissions.some(p => hasPermission(p))
      );
      
      if (!hasAccessibleChildren) return null;

      return (
        <div key={item.name} className={`${
          level === 0 && item.name === 'Dashboard' ? 'mb-4' : ''
        }`}>
          <button
            onClick={() => item.setOpen?.(!item.isOpen)}
            onMouseEnter={() => setHoveredItem(item.name)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{ paddingLeft }}
            className={`w-full flex items-center justify-between pr-3 ${
              level === 0 ? 'py-2.5 bg-white border-b border-gray-100' : 'py-1.5'
            } ${
              level === 0 ? 'text-base' : 'text-sm'
            } transition-all duration-200 ${
              item.isOpen 
                ? 'text-blue-600 font-medium' 
                : 'text-gray-700 hover:text-gray-900'
            } ${
              level === 0 ? 'font-semibold' : level === 1 ? 'font-medium' : 'font-normal'
            }`}
          >
            <div className="flex items-center space-x-2">
              {level > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              )}
              {Icon && (
                <Icon className={`${
                  level === 0 ? 'h-5 w-5' : level === 1 ? 'h-4 w-4' : 'h-3.5 w-3.5'
                } transition-colors ${
                  item.isOpen ? 'text-blue-600' : 'text-gray-400'
                }`} />
              )}
              <span>{item.name}</span>
            </div>
            <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${
              item.isOpen ? 'rotate-90 text-blue-500' : 'text-gray-400'
            }`} />
          </button>
          
          {item.isOpen && (
            <div className="relative">
              {/* Vertikalna linija za povezivanje */}
              {level === 0 && (
                <div 
                  className="absolute w-px bg-gray-100" 
                  style={{ 
                    left: `${level * 20 + 28}px`,
                    top: 0,
                    bottom: 0
                  }}
                />
              )}
              <div className="space-y-0">
                {item.submenu
                  ?.sort((a, b) => {
                    // Prvo prikaži foldere (hasSubmenu), zatim solo opcije
                    if (a.hasSubmenu && !b.hasSubmenu) return -1;
                    if (!a.hasSubmenu && b.hasSubmenu) return 1;
                    return 0;
                  })
                  .map((subitem) => renderMenuItem(subitem, level + 1))}
              </div>
            </div>
          )}
        </div>
      );
    }

    const content = (
      <div 
        style={{ paddingLeft }}
        className={`flex items-center justify-between pr-3 ${
          level === 0 ? 'py-2.5 bg-white border-b border-gray-100' : 'py-1.5'
        } transition-all duration-200 ${
        isActive 
          ? 'text-blue-600 font-medium' 
          : 'text-gray-600 hover:text-gray-900'
      } ${
        level === 0 ? 'text-base' : level === 1 ? 'text-sm' : 'text-xs'
      }`}>
        <div className="flex items-center space-x-2">
          {level > 0 && (
            <div className={`w-1.5 h-1.5 rounded-full ${
              isActive ? 'bg-blue-500' : 'bg-gray-300'
            }`} />
          )}
          {Icon && (
            <Icon className={`${
              level === 0 ? 'h-5 w-5' : level === 1 ? 'h-4 w-4' : 'h-3.5 w-3.5'
            } ${
              isActive ? 'text-blue-600' : 'text-gray-400'
            }`} />
          )}
          <span>{item.name}</span>
        </div>
        {item.badge && (
          <span className={`px-1.5 py-0.5 text-xs font-medium ${
            item.badge.type === 'danger' ? 'text-red-600' :
            item.badge.type === 'warning' ? 'text-yellow-600' :
            item.badge.type === 'success' ? 'text-green-600' :
            'text-blue-600'
          }`}>
            {item.badge.text}
          </span>
        )}
      </div>
    );

    return (
      <div key={item.name} className={`${
        level === 0 && item.name === 'Dashboard' ? 'mb-4' : ''
      }`}>
        {item.href ? (
          <Link
            to={item.href}
            onMouseEnter={() => setHoveredItem(item.name)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => setSidebarOpen(false)}
          >
            {content}
          </Link>
        ) : (
          <div
            onMouseEnter={() => setHoveredItem(item.name)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:flex lg:flex-shrink-0`}>
        <div className="flex flex-col w-64">
          <div className="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center h-16 px-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Hash className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-semibold text-gray-900">Smart City</span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-0">
              {navigation.map((item) => renderMenuItem(item))}
            </nav>

            {/* User section */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-white shadow-lg border border-gray-200"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ModernMenuV1;