import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  Badge,
  theme,
  ConfigProvider
} from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  DashboardOutlined,
  TeamOutlined,
  SettingOutlined,
  SafetyOutlined,
  CarOutlined,
  SyncOutlined,
  HeatMapOutlined,
  BarChartOutlined,
  WarningOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ApiOutlined,
  SecurityScanOutlined,
  UsergroupAddOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  RadarChartOutlined,
  AlertOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '../../stores/auth.store';
import { usePermissions } from '../../hooks/usePermissions';
import { getAvatarUrl } from '../../utils/avatar';
import PermissionsDebugger from '../permissions/PermissionsDebugger';
import '../../styles/menu-modern.css';

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>['items'][number] & {
  permissions?: string[];
  badge?: {
    count: number | string;
    color?: string;
  };
};

const ModernMenu: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { hasPermission } = usePermissions();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Funkcija za filtriranje stavki na osnovu permisija
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter(item => {
        if (!item) return false;
        const menuItem = item as MenuItem;

        // Ako nema permisije, prikaži
        if (!menuItem.permissions) return true;

        // Proveri da li korisnik ima bar jednu od potrebnih permisija
        return menuItem.permissions.some(p => hasPermission(p));
      })
      .map(item => {
        const menuItem = { ...item } as any;

        // Rekurzivno filtriraj podmeni
        if (menuItem.children && Array.isArray(menuItem.children)) {
          const filteredChildren = filterMenuItems(menuItem.children);

          // Ako nema dostupne pod-stavke, sakrij ceo meni
          if (filteredChildren.length === 0) {
            return null;
          }

          menuItem.children = filteredChildren;
        }

        // Dodaj badge ako postoji
        if (menuItem.badge) {
          menuItem.label = (
            <span className="flex items-center justify-between w-full">
              <span>{menuItem.label}</span>
              <Badge
                count={menuItem.badge.count}
                style={{
                  backgroundColor: menuItem.badge.color || '#ff4d4f',
                  marginLeft: 'auto'
                }}
              />
            </span>
          );
        }

        return menuItem;
      })
      .filter(Boolean) as MenuItem[];
  };

  // Definicija menija sa permisijama
  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        permissions: ['dashboard:view'],
      },
      {
        key: 'users',
        icon: <TeamOutlined />,
        label: 'Korisnici',
        children: [
          {
            key: '/users/administration',
            icon: <UsergroupAddOutlined />,
            label: 'Administracija',
            permissions: ['users:view'],
          },
          {
            key: '/users/roles-permissions',
            icon: <SecurityScanOutlined />,
            label: 'Role i Permisije',
            permissions: ['roles:view'],
          },
        ],
      },
      {
        key: 'transport',
        icon: <CarOutlined />,
        label: 'Autobuski Prevoznici',
        children: [
          {
            key: 'vehicles',
            icon: <CarOutlined />,
            label: 'Vozila',
            children: [
              {
                key: '/transport/vehicles',
                label: 'Lista Vozila',
                permissions: ['vehicles:read'],
              },
              {
                key: '/transport/vehicle-sync',
                icon: <SyncOutlined />,
                label: 'Sinhronizacija',
                permissions: ['vehicles.sync:view'],
              },
              {
                key: '/transport/gps-buffer-status',
                icon: <DatabaseOutlined />,
                label: 'GPS Real-Time Sync',
                permissions: ['dispatcher:sync_gps'],
              },
              {
                key: '/transport/legacy-sync',
                icon: <SyncOutlined />,
                label: 'Legacy Sync',
                permissions: ['legacy_sync.view'],
              },
              {
                key: '/migration',
                icon: <AlertOutlined className="text-red-500" />,
                label: <span className="text-red-500 font-semibold">🚨 GPS Migration</span>,
                permissions: ['system.manage'],
              },
            ],
          },
          {
            key: 'dispatcher',
            icon: <RadarChartOutlined />,
            label: 'Dispečerski Modul',
            children: [
              {
                key: '/transport/dispatcher/map-vehicles',
                icon: <EnvironmentOutlined />,
                label: 'Mapa',
                permissions: ['dispatcher:view_map'],
              },
              {
                key: '/transport/dispatcher/analytics',
                icon: <BarChartOutlined />,
                label: 'Analitika vozila',
                permissions: ['dispatcher:view_analytics'],
              },
              {
                key: '/transport/dispatcher/gps-sync',
                icon: <ThunderboltOutlined />,
                label: 'GPS Sync',
                permissions: ['dispatcher:sync_gps'],
                badge: { count: 'LIVE', color: '#ff4d4f' },
              } as MenuItem,
            ],
          },
          {
            key: 'safety',
            icon: <SafetyOutlined />,
            label: 'Bezbednost',
            children: [
              {
                key: '/transport/safety/aggressive-driving',
                icon: <WarningOutlined />,
                label: 'Agresivna Vožnja',
                permissions: ['safety.aggressive.driving:view'],
                badge: { count: 7, color: '#faad14' },
              } as MenuItem,
              {
                key: '/transport/safety/monthly-report',
                icon: <FileTextOutlined />,
                label: 'Mesečni Izveštaj',
                permissions: ['safety.reports:view'],
              },
              {
                key: '/transport/safety/data-recreation',
                icon: <SyncOutlined />,
                label: 'Rekreacija podataka',
                permissions: ['safety.data.recreation:view'],
              },
            ],
          },
          {
            key: 'maintenance',
            icon: <ToolOutlined />,
            label: 'Alati za održavanje',
            children: [
              {
                key: '/transport/maintenance/timescaledb',
                icon: <DatabaseOutlined />,
                label: 'TimescaleDB',
                permissions: ['maintenance.timescaledb:view'],
              },
            ],
          },
        ],
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Podešavanje',
        children: [
          {
            key: '/settings/general',
            icon: <SettingOutlined />,
            label: 'Opšta',
            permissions: ['settings.general:view'],
          },
          {
            key: '/settings/api-keys',
            icon: <ApiOutlined />,
            label: 'API Keys',
            permissions: ['api_keys:view'],
          },
        ],
      },
    ];

    return filterMenuItems(items);
  }, [hasPermission]);

  // Pronađi aktivnu rutu i otvori parent menije
  useEffect(() => {
    const path = location.pathname;
    const keys: string[] = [];

    // Pronađi sve parent ključeve
    if (path.includes('/users/')) keys.push('users');
    if (path.includes('/transport/')) {
      keys.push('transport');
      if (path.includes('/vehicle')) keys.push('vehicles');
      if (path.includes('/dispatcher/')) keys.push('dispatcher');
      if (path.includes('/safety/')) keys.push('safety');
      if (path.includes('/maintenance/')) keys.push('maintenance');
    }
    if (path.includes('/settings/')) keys.push('settings');

    setOpenKeys(keys);
  }, [location.pathname]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys);
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'Profil',
      icon: <UserOutlined />,
      onClick: () => navigate('/users/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Odjava',
      icon: <LogoutOutlined />,
      onClick: logout,
      danger: true,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            siderBg: '#f8f9fa',
            triggerBg: '#e9ecef',
            triggerColor: '#495057',
          },
          Menu: {
            itemBg: '#f8f9fa',
            subMenuItemBg: '#ffffff',
            itemSelectedBg: '#e3f2fd',
            popupBg: '#ffffff',
            itemHoverBg: '#e9ecef',
            itemColor: '#495057',
            itemSelectedColor: '#1890ff',
            itemHoverColor: '#212529',
          },
        },
      }}
    >
      <Layout className="h-screen">
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={256}
          className="overflow-auto shadow-xl"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-center border-b border-gray-200">
            <div className="flex items-center space-x-3 px-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">#</span>
              </div>
              {!collapsed && (
                <span className="text-lg font-semibold text-gray-800 tracking-wide">
                  Smart City
                </span>
              )}
            </div>
          </div>

          {/* Menu */}
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={handleOpenChange}
            onClick={handleMenuClick}
            items={menuItems}
            className="border-r-0"
            style={{
              background: 'transparent',
              marginTop: '16px',
            }}
          />
        </Sider>

        <Layout>
          <Header
            style={{
              padding: 0,
              background: colorBgContainer,
              boxShadow: '0 1px 4px rgba(0,21,41,.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="flex items-center">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: 64,
                  height: 64,
                }}
              />
              <h1 className="text-xl font-semibold text-gray-800 ml-2">
                {menuItems.find(item =>
                  item?.key === location.pathname ||
                  (item as any)?.children?.some((sub: any) =>
                    sub.key === location.pathname ||
                    sub?.children?.some((subsub: any) => subsub.key === location.pathname)
                  )
                )?.label || 'Smart City Admin'}
              </h1>
            </div>

            <div className="flex items-center space-x-4 pr-6">
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                arrow
              >
                <Button
                  type="text"
                  className="flex items-center space-x-2 px-3 py-1 h-auto hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {user && (
                    <span className="text-sm font-medium text-gray-700 mr-2">
                      {user.firstName} {user.lastName}
                    </span>
                  )}
                  <Avatar
                    src={getAvatarUrl(user?.avatar)}
                    icon={!user?.avatar && <UserOutlined />}
                    size="default"
                    className="shadow-sm"
                  />
                </Button>
              </Dropdown>
            </div>
          </Header>

          <Content
            style={{
              margin: '24px 16px',
              padding: 24,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </Layout>

        {/* Permissions Debugger */}
        {process.env.NODE_ENV === 'development' && <PermissionsDebugger />}
      </Layout>
    </ConfigProvider>
  );
};

export default ModernMenu;