import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Button } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
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
  Database,
  Radio,
  Gauge,
  Hash,
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
    if (path.includes('/maintenance/')) {
      expandedSections.add('Autobuski Prevoznici');
      expandedSections.add('Alati za održavanje');
    }
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
          name: 'Vozila',
          icon: Car,
          hasSubmenu: true,
          isOpen: expandedSections.has('Vozila'),
          setOpen: () => toggleSection('Vozila'),
          submenu: [
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
              name: 'GPS Real-Time Sync',
              href: '/transport/gps-buffer-status',
              icon: Database,
              permissions: ['dispatcher:sync_gps'],
              description: 'Status GPS buffer tabele',
            },
            {
              name: 'Legacy Sync',
              href: '/transport/legacy-sync',
              icon: RefreshCw,
              permissions: ['legacy_sync.view'],
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
        },
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
              badge: { text: 'LIVE', type: 'danger' as const },
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
              badge: { text: '7', type: 'warning' as const },
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
          name: 'Alati za održavanje',
          icon: Settings,
          hasSubmenu: true,
          isOpen: expandedSections.has('Alati za održavanje'),
          setOpen: () => toggleSection('Alati za održavanje'),
          submenu: [
            {
              name: 'TimescaleDB',
              href: '/transport/maintenance/timescaledb',
              icon: Database,
              permissions: ['maintenance.timescaledb:view'],
            },
          ].filter(item => !item.permissions || item.permissions.some(p => hasPermission(p))),
        },
      ].filter((item: any) => item.hasSubmenu || !item.permissions || item.permissions.some((p: string) => hasPermission(p))),
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
  ].filter(item => {
    if (!item.permissions || item.permissions.some(p => hasPermission(p))) {
      return true;
    }
    if (item.hasSubmenu === true) {
      const submenuItems = (item as any).submenu;
      return submenuItems && Array.isArray(submenuItems) && submenuItems.length > 0;
    }
    return false;
  }) as MenuItem[];

  // Hijerarhijski rendering sa pravilnim uvlačenjem
  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasAccess = !item.permissions || item.permissions.some(p => hasPermission(p));
    if (!hasAccess && !item.hasSubmenu) return null;

    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    const paddingLeft = `${level * 6 + 12}px`;

    if (item.hasSubmenu) {
      const hasAccessibleChildren = item.submenu?.some(child => 
        !child.permissions || child.permissions.some(p => hasPermission(p))
      );
      
      if (!hasAccessibleChildren) return null;

      return (
        <div key={item.name} className={`${
          level === 0 && item.name === 'Dashboard' ? 'mb-1' : ''
        }`}>
          <button
            onClick={() => item.setOpen?.(!item.isOpen)}
            onMouseEnter={() => setHoveredItem(item.name)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{ paddingLeft, paddingTop: level === 0 ? '0.6875rem' : undefined, paddingBottom: level === 0 ? '0.6875rem' : undefined }}
            className={`w-full flex items-center justify-between pr-3 bg-white ${
              level === 0 ? 'border-b border-gray-100' : 
              level === 1 && item.hasSubmenu ? 'py-1 border-b border-gray-100' : 'py-1'
            } ${
              level === 0 && item.isOpen ? 'text-lg' : 
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
            <div className={`relative ${level === 0 ? 'mb-4' : ''}`}>
              {/* Vertikalna linija za povezivanje */}
              {level === 0 && (
                <div 
                  className="absolute w-px bg-gray-100" 
                  style={{ 
                    left: `${level * 6 + 28}px`,
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
        style={{ paddingLeft, paddingTop: level === 0 ? '0.6875rem' : undefined, paddingBottom: level === 0 ? '0.6875rem' : undefined }}
        className={`flex items-center justify-between pr-3 bg-white ${
          level === 0 ? 'border-b border-gray-100' : 'py-1'
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
        level === 0 && item.name === 'Dashboard' ? 'mb-1' : ''
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

  const userMenuItems = [
    {
      key: 'profile',
      label: 'Profil',
      icon: <UserOutlined />,
      onClick: () => navigate('/users/profile'),
    },
    {
      type: 'divider' as const,
      key: 'divider',
    },
    {
      key: 'logout',
      label: 'Odjava',
      icon: <LogoutOutlined />,
      onClick: logout,
    },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
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
        {/* Header */}
        <header className="bg-white shadow-sm h-16">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-full">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
              </button>
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                {/* Dinamički naslov na osnovu trenutne rute */}
                {navigation.find(item => 
                  item.href === location.pathname || 
                  item.submenu?.some(sub => sub.href === location.pathname)
                )?.name || 
                navigation.flatMap(item => item.submenu || [])
                  .find(sub => sub.href === location.pathname)?.name || 
                'Smart City Admin'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User menu */}
              <Dropdown 
                menu={{ items: userMenuItems }} 
                placement="bottomRight"
                arrow
              >
                <Button type="text" className="flex items-center space-x-2 px-2 py-1">
                  {user && (
                    <span className="text-sm font-medium text-gray-700">
                      {user.firstName} {user.lastName}
                    </span>
                  )}
                  <Avatar 
                    src={getAvatarUrl(user?.avatar)} 
                    icon={!user?.avatar && <UserOutlined />}
                    size="default"
                  />
                </Button>
              </Dropdown>
            </div>
          </div>
        </header>

        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-gray-50">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>

        {/* Permissions Debugger */}
        {process.env.NODE_ENV === 'development' && <PermissionsDebugger />}
      </div>
    </div>
  );
};

export default ModernMenuV1;