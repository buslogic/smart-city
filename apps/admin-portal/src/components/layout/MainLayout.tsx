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
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { usePermissions } from '../../hooks/usePermissions';
import { getAvatarUrl } from '../../utils/avatar';
import PermissionsDebugger from '../permissions/PermissionsDebugger';

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usersMenuOpen, setUsersMenuOpen] = useState(false);
  const [transportMenuOpen, setTransportMenuOpen] = useState(false);
  const [transportVehiclesMenuOpen, setTransportVehiclesMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { canViewUsers, canViewRoles, hasPermission } = usePermissions();

  // Debug - proveri permisije
  console.log('User permissions check:', {
    vehicles_read: hasPermission('vehicles:read'),
    vehicles_sync: hasPermission('vehicles:sync'),
    legacy_sync_view: hasPermission('legacy_sync.view'),
  });

  // Filtriranje navigacije na osnovu permisija
  const navigation = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      hasSubmenu: false,
    },
    {
      name: 'Korisnici',
      icon: Users,
      hasSubmenu: true,
      isOpen: usersMenuOpen,
      setOpen: setUsersMenuOpen,
      submenu: [
        canViewUsers() && {
          name: 'Administracija Korisnika',
          href: '/users/administration',
          icon: UserCog,
        },
        canViewRoles() && {
          name: 'Role i Permisije',
          href: '/users/roles-permissions',
          icon: Shield,
        },
      ].filter(Boolean), // Uklanja false vrednosti
    },
    {
      name: 'Autobuski Prevoznici',
      icon: Bus,
      hasSubmenu: true,
      isOpen: transportMenuOpen,
      setOpen: setTransportMenuOpen,
      submenu: [
        // Novi podfolder Vozila - prikaži samo ako ima bar jednu vidljivu opciju
        (() => {
          const hasVehiclePerms = hasPermission('vehicles:read') || hasPermission('vehicles:sync') || hasPermission('legacy_sync.view');
          console.log('Vozila submenu should show:', hasVehiclePerms);
          return hasVehiclePerms;
        })() && {
          name: 'Vozila',
          icon: Car,
          hasSubmenu: true,
          isOpen: transportVehiclesMenuOpen,
          setOpen: setTransportVehiclesMenuOpen,
          submenu: [
            hasPermission('vehicles:read') && {
              name: 'Vozila',
              href: '/transport/vehicles',
              icon: Car,
            },
            hasPermission('vehicles:sync') && {
              name: 'Sinhronizacija',
              href: '/transport/vehicle-sync',
              icon: RefreshCw,
            },
            hasPermission('legacy_sync.view') && {
              name: 'Legacy Sync',
              href: '/transport/legacy-sync',
              icon: RefreshCw,
            },
          ].filter(Boolean),
        },
        hasPermission('dispatcher:view_map') && {
          name: 'Dispečerski Modul - Mapa i vozila',
          href: '/transport/dispatcher/map-vehicles',
          icon: Map,
        },
        hasPermission('dispatcher:view_analytics') && {
          name: 'Dispečerski Modul - Analiza',
          href: '/transport/dispatcher/analytics',
          icon: BarChart3,
        },
        hasPermission('dispatcher:sync_gps') && {
          name: 'Dispečerski Modul - Sinhronizacija',
          href: '/transport/dispatcher/gps-sync',
          icon: RefreshCw,
        },
        hasPermission('dispatcher:view_sync_dashboard') && {
          name: 'Dispečerski Modul - Sinhronizacija Dashboard',
          href: '/transport/dispatcher/gps-sync-dashboard',
          icon: Activity,
        },
        hasPermission('safety:view_aggressive') && {
          name: 'Bezbednost - Agresivna vožnja',
          href: '/transport/safety/aggressive-driving',
          icon: AlertTriangle,
        },
        hasPermission('safety:view_report') && {
          name: 'Bezbednost - Mesečni izveštaj',
          href: '/transport/safety/monthly-report',
          icon: FileText,
        },
      ].filter(Boolean),
    },
    {
      name: 'Podešavanje',
      icon: Settings,
      hasSubmenu: true,
      isOpen: settingsMenuOpen,
      setOpen: setSettingsMenuOpen,
      submenu: [
        hasPermission('settings:general:read') && {
          name: 'Opšta Podešavanja',
          href: '/settings/general',
          icon: Sliders,
        },
      ].filter(Boolean),
    },
  ].filter(item => !item.hasSubmenu || (item.submenu && item.submenu.length > 0)); // Uklanja sekcije bez pristupnih stavki

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
            
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <h2 className="text-lg font-semibold">Smart City Admin</h2>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => (
                  <div key={item.name}>
                    {item.hasSubmenu ? (
                      <>
                        <button
                          onClick={() => item.setOpen?.(!item.isOpen)}
                          className="w-full group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        >
                          <item.icon className="mr-4 h-6 w-6" />
                          {item.name}
                          <ChevronDown 
                            className={`ml-auto h-4 w-4 transition-transform ${
                              item.isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {item.isOpen && (
                          <div className="ml-10 mt-1 space-y-1">
                            {item.submenu?.filter(Boolean).map((subitem: any) => (
                              subitem.hasSubmenu ? (
                                <div key={subitem.name}>
                                  <button
                                    onClick={() => subitem.setOpen?.(!subitem.isOpen)}
                                    className="w-full group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  >
                                    <subitem.icon className="mr-3 h-5 w-5" />
                                    {subitem.name}
                                    <ChevronDown 
                                      className={`ml-auto h-4 w-4 transition-transform ${
                                        subitem.isOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {subitem.isOpen && (
                                    <div className="ml-8 mt-1 space-y-1">
                                      {subitem.submenu?.filter(Boolean).map((nestedItem: any) => (
                                        <Link
                                          key={nestedItem.name}
                                          to={nestedItem.href}
                                          className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                          onClick={() => setSidebarOpen(false)}
                                        >
                                          <nestedItem.icon className="mr-3 h-4 w-4" />
                                          {nestedItem.name}
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Link
                                  key={subitem.name}
                                  to={subitem.href}
                                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  onClick={() => setSidebarOpen(false)}
                                >
                                  <subitem.icon className="mr-3 h-5 w-5" />
                                  {subitem.name}
                                </Link>
                              )
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        to={item.href || '/'}
                        className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="mr-4 h-6 w-6" />
                        {item.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white shadow">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <h2 className="text-lg font-semibold">Smart City Admin</h2>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <div key={item.name}>
                  {item.hasSubmenu ? (
                    <>
                      <button
                        onClick={() => item.setOpen?.(!item.isOpen)}
                        className="w-full group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                        <ChevronDown 
                          className={`ml-auto h-4 w-4 transition-transform ${
                            item.isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {item.isOpen && (
                        <div className="ml-8 mt-1 space-y-1">
                          {item.submenu?.filter(Boolean).map((subitem: any) => (
                            subitem.hasSubmenu ? (
                              <div key={subitem.name}>
                                <button
                                  onClick={() => subitem.setOpen?.(!subitem.isOpen)}
                                  className="w-full group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                >
                                  <subitem.icon className="mr-3 h-4 w-4" />
                                  {subitem.name}
                                  <ChevronDown 
                                    className={`ml-auto h-3 w-3 transition-transform ${
                                      subitem.isOpen ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                                {subitem.isOpen && (
                                  <div className="ml-6 mt-1 space-y-1">
                                    {subitem.submenu?.filter(Boolean).map((nestedItem: any) => (
                                      <Link
                                        key={nestedItem.name}
                                        to={nestedItem.href}
                                        className={`group flex items-center px-2 py-1.5 text-sm font-medium rounded-md ${
                                          location.pathname === nestedItem.href
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                      >
                                        <nestedItem.icon className="mr-3 h-4 w-4" />
                                        {nestedItem.name}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Link
                                key={subitem.name}
                                to={subitem.href}
                                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                  location.pathname === subitem.href
                                    ? 'bg-gray-100 text-gray-900'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                              >
                                <subitem.icon className="mr-3 h-4 w-4" />
                                {subitem.name}
                              </Link>
                            )
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      to={item.href || '/'}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        location.pathname === item.href
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
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

export default MainLayout;