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
  AlertOutlined,
  TagsOutlined,
  BranchesOutlined,
  CalendarOutlined,
  MailOutlined,
  PrinterOutlined,
  LinkOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '../../stores/auth.store';
import { usePermissions } from '../../hooks/usePermissions';
import { getAvatarUrl } from '../../utils/avatar';
import PermissionsDebugger from '../permissions/PermissionsDebugger';
import '../../styles/menu-modern.css';

const { Header, Sider, Content } = Layout;

interface CustomMenuItem {
  key: string;
  menuOrder: number;
  icon?: React.ReactNode;
  label: React.ReactNode;
  children?: CustomMenuItem[];
  permissions?: string[];
  badge?: {
    count: number | string;
    color?: string;
  };
  type?: 'divider';
}

type MenuItem = CustomMenuItem;

const ModernMenu: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshAccessToken } = useAuthStore();
  const { hasPermission } = usePermissions();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Refresh profila pri mount-u
  useEffect(() => {
    refreshAccessToken();
  }, []);

  // Funkcija za sortiranje stavki po menuOrder
  const sortMenuItems = (items: CustomMenuItem[]): CustomMenuItem[] => {
    return items
      .sort((a, b) => a.menuOrder - b.menuOrder)
      .map(item => ({
        ...item,
        children: item.children ? sortMenuItems(item.children) : undefined
      }));
  };

  // Funkcija za filtriranje stavki na osnovu permisija sa hijerarhijskom logikom
  const filterMenuItems = (items: CustomMenuItem[]): MenuProps['items'] => {
    return items
      .map(item => {
        if (!item) return null;

        const menuItem = { ...item };

        // Rekurzivno filtriraj podmeni
        if (menuItem.children && Array.isArray(menuItem.children)) {
          const filteredChildren = filterMenuItems(menuItem.children);

          // Ako nema dostupne pod-stavke, sakrij ceo meni
          if (!filteredChildren || filteredChildren.length === 0) {
            return null;
          }

          // NOVA LOGIKA: Ako ima dostupne children, prikaži parent bez obzira na njegove permisije
          return {
            key: menuItem.key,
            icon: menuItem.icon,
            label: menuItem.badge ? (
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
            ) : menuItem.label,
            children: filteredChildren,
          };
        }

        // Za stavke bez children, proveri permisije normalno
        if (!item.permissions) return {
          key: menuItem.key,
          icon: menuItem.icon,
          label: menuItem.badge ? (
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
          ) : menuItem.label,
        };

        // Proveri da li korisnik ima bar jednu od potrebnih permisija
        const hasRequiredPermissions = item.permissions.some(p => hasPermission(p));
        if (!hasRequiredPermissions) return null;

        return {
          key: menuItem.key,
          icon: menuItem.icon,
          label: menuItem.badge ? (
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
          ) : menuItem.label,
        };
      })
      .filter(Boolean);
  };

  // Definicija menija sa permisijama
  const menuItems = useMemo(() => {
    const items: CustomMenuItem[] = [
      {
        key: '/dashboard',
        menuOrder: 100000000000,
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        permissions: ['dashboard:view'],
      },
      {
        key: 'users',
        menuOrder: 200000000000,
        icon: <TeamOutlined />,
        label: 'Korisnici',
        // permissions: ['users:view'], // ❌ Uklonjeno - hijerarhijska logika će automatski prikazati
        children: [
          {
            key: '/users/administration',
            menuOrder: 201000000000,
            icon: <UsergroupAddOutlined />,
            label: 'Administracija',
            permissions: ['users.administration:view'], // ✅ Specifična permisija umesto opšte
          },
          {
            key: '/users/roles-permissions',
            menuOrder: 202000000000,
            icon: <SecurityScanOutlined />,
            label: 'Role i Permisije',
            permissions: ['roles:view'],
          },
          {
            key: '/users/groups',
            menuOrder: 203000000000,
            icon: <UsergroupAddOutlined />,
            label: 'Grupe Korisnika',
            permissions: ['users.groups:view'],
          },
        ],
      },
      {
        key: 'transport',
        menuOrder: 300000000000,
        icon: <CarOutlined />,
        label: 'Autobuski Prevoznici',
        // permissions: ['transport:view'], // ❌ Uklonjeno - hijerarhijska logika će automatski prikazati
        children: [
          {
            key: 'vehicles',
            menuOrder: 301000000000,
            icon: <CarOutlined />,
            label: 'Vozila',
            // permissions: ['vehicles:view'], // ❌ Uklonjeno - hijerarhijska logika će automatski prikazati
            children: [
              {
                key: '/transport/vehicles',
                menuOrder: 301010000000,
                label: 'Lista Vozila',
                permissions: ['vehicles:read'],
              },
              {
                key: '/transport/vehicle-sync',
                menuOrder: 301020000000,
                icon: <SyncOutlined />,
                label: 'Sinhronizacija',
                permissions: ['vehicles.sync:view'],
              },
              {
                key: '/transport/gps-buffer-status',
                menuOrder: 301030000000,
                icon: <DatabaseOutlined />,
                label: 'GPS Real-Time Sync',
                permissions: ['gps.buffer.sync:view'],
              },
              {
                key: '/transport/legacy-sync',
                menuOrder: 301040000000,
                icon: <SyncOutlined />,
                label: 'Legacy Sync',
                permissions: ['legacy.sync:view'],
              },
              {
                key: '/migration',
                menuOrder: 301050000000,
                icon: <AlertOutlined className="text-red-500" />,
                label: <span className="text-red-500 font-semibold">🚨 GPS Migration</span>,
                permissions: ['system:view'],
              },
              {
                key: '/transport/vehicles/gps-lag-transfer',
                menuOrder: 301060000000,
                icon: <DatabaseOutlined />,
                label: 'GPS LAG Transfer',
                permissions: ['vehicles.gps.lag:view'],
              },
            ],
          },
          {
            key: 'administration',
            menuOrder: 301500000000,
            icon: <SettingOutlined />,
            label: 'Administracija',
            // permissions: ['transport.administration:view'], // ❌ Uklonjeno - hijerarhijska logika
            children: [
              {
                key: '/transport/administration/central-points',
                menuOrder: 301510000000,
                icon: <EnvironmentOutlined />,
                label: 'Centralne tačke',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.central_points:view',
                  'transport.administration.central_points.main:view',
                  'transport.administration.central_points.ticketing:view',
                  'transport.administration.central_points.city:view',
                ],
              },
              {
                key: '/transport/administration/stops-sync',
                menuOrder: 301515000000,
                icon: <EnvironmentOutlined />,
                label: 'Stajališta Sync.',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.stops_sync:view',
                  'transport.administration.stops_sync.main:view',
                  'transport.administration.stops_sync.ticketing:view',
                  'transport.administration.stops_sync.city:view',
                ],
              },
              {
                key: '/transport/administration/price-list-groups',
                menuOrder: 301520000000,
                icon: <TagsOutlined />,
                label: 'Grupe cenovnika',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.price_list_groups:view',
                  'transport.administration.price_list_groups.main:view',
                  'transport.administration.price_list_groups.ticketing:view',
                  'transport.administration.price_list_groups.city:view',
                ],
              },
              {
                key: '/transport/administration/lines-admin',
                menuOrder: 301525000000,
                icon: <BranchesOutlined />,
                label: 'Linije Administracija',
                permissions: ['transport.administration.lines_admin:view'],
              },
              {
                key: '/transport/administration/lines',
                menuOrder: 301530000000,
                icon: <BranchesOutlined />,
                label: 'Linije Sync.',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.lines:view',
                  'transport.administration.lines.main:view',
                  'transport.administration.lines.ticketing:view',
                  'transport.administration.lines.city:view',
                ],
              },
              {
                key: '/transport/administration/variations',
                menuOrder: 301535000000,
                icon: <TagsOutlined />,
                label: 'Varijacije',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.variations:view',
                  'transport.administration.variations.main:view',
                  'transport.administration.variations.ticketing:view',
                  'transport.administration.variations.city:view',
                ],
              },
              {
                key: '/transport/administration/timetable-dates',
                menuOrder: 301540000000,
                icon: <CalendarOutlined />,
                label: 'Grupe za RedVoznje',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.timetable_dates:view',
                  'transport.administration.timetable_dates.main:view',
                  'transport.administration.timetable_dates.ticketing:view',
                  'transport.administration.timetable_dates.city:view',
                ],
              },
              {
                key: '/transport/administration/timetable-sync',
                menuOrder: 301545000000,
                icon: <SyncOutlined />,
                label: 'RedVoznje Sync.',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.timetable_sync:view',
                  'transport.administration.timetable_sync.main:view',
                  'transport.administration.timetable_sync.ticketing:view',
                  'transport.administration.timetable_sync.city:view',
                ],
              },
              {
                key: '/transport/administration/turnusi-groups-sync',
                menuOrder: 301550000000,
                icon: <SyncOutlined />,
                label: 'Turnusi Grupe Sync',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.turnusi_sync:view',
                  'transport.administration.turnusi_sync.main:view',
                  'transport.administration.turnusi_sync.ticketing:view',
                  'transport.administration.turnusi_sync.city:view',
                ],
              },
              {
                key: '/transport/administration/turnusi',
                menuOrder: 301555000000,
                icon: <SyncOutlined />,
                label: 'Turnusi Sync',
                // Prikaži ako korisnik ima bar jednu view permisiju (kontejner ili bilo koji server)
                permissions: [
                  'transport.administration.turnusi:view',
                  'transport.administration.turnusi.main:view',
                  'transport.administration.turnusi.ticketing:view',
                  'transport.administration.turnusi.city:view',
                ],
              },
            ],
          },
          {
            key: 'dispatcher',
            menuOrder: 302000000000,
            icon: <RadarChartOutlined />,
            label: 'Dispečerski Modul',
            // permissions: ['dispatcher:view'], // ❌ Uklonjeno - hijerarhijska logika
            children: [
              {
                key: '/transport/dispatcher/map-vehicles',
                menuOrder: 302010000000,
                icon: <EnvironmentOutlined />,
                label: 'Mapa',
                permissions: ['dispatcher:view_map'],
              },
              {
                key: '/transport/dispatcher/analytics',
                menuOrder: 302020000000,
                icon: <BarChartOutlined />,
                label: 'Analitika vozila',
                permissions: ['dispatcher:view_analytics'],
              },
              {
                key: '/transport/dispatcher/gps-sync',
                menuOrder: 302030000000,
                icon: <ThunderboltOutlined />,
                label: 'GPS Sync',
                permissions: ['dispatcher.sync:view'],
                badge: { count: 'LIVE', color: '#ff4d4f' },
              } as MenuItem,
              {
                key: '/transport/dispatcher/driver-card',
                menuOrder: 302040000000,
                icon: <UserOutlined />,
                label: 'Karton Vozača',
                permissions: ['dispatcher.driver_card:view'],
              },
              {
                key: 'planning',
                menuOrder: 302050000000,
                icon: <CalendarOutlined />,
                label: 'Planiranje',
                // permissions: ['transport.planning:view'], // ❌ Uklonjeno - hijerarhijska logika
                children: [
                  {
                    key: '/transport/planning/schedule',
                    menuOrder: 302050010000,
                    icon: <CalendarOutlined />,
                    label: 'Raspored',
                    permissions: ['transport.planning.schedule:view'],
                  },
                  {
                    key: '/transport/planning/schedule-print',
                    menuOrder: 302050020000,
                    icon: <PrinterOutlined />,
                    label: 'Štampa Rasporeda',
                    permissions: ['transport.planning.schedule_print:view'],
                  },
                  {
                    key: '/transport/planning/turnus-defaults',
                    menuOrder: 302050030000,
                    icon: <UserOutlined />,
                    label: 'Default Turnusa',
                    permissions: ['transport.planning.turnus_defaults:view'],
                  },
                  {
                    key: '/transport/planning/linked-turnusi',
                    menuOrder: 302050040000,
                    icon: <LinkOutlined />,
                    label: 'Povezani turnusi',
                    permissions: ['transport.planning.linked_turnusi:view'],
                  },
                ],
              },
            ],
          },
          {
            key: 'safety',
            menuOrder: 303000000000,
            icon: <SafetyOutlined />,
            label: 'Bezbednost',
            // permissions: ['safety:view'], // ❌ Uklonjeno - hijerarhijska logika
            children: [
              {
                key: '/transport/safety/aggressive-driving',
                menuOrder: 303010000000,
                icon: <WarningOutlined />,
                label: 'Agresivna Vožnja',
                permissions: ['safety.aggressive.driving:view'],
              } as MenuItem,
              {
                key: '/transport/safety/monthly-report',
                menuOrder: 303020000000,
                icon: <FileTextOutlined />,
                label: 'Mesečni Izveštaj',
                permissions: ['safety.reports:view'],
              },
              {
                key: '/transport/safety/data-recreation',
                menuOrder: 303030000000,
                icon: <SyncOutlined />,
                label: 'Rekreacija podataka',
                permissions: ['safety.data.recreation:view'],
              },
            ],
          },
          {
            key: 'maintenance',
            menuOrder: 304000000000,
            icon: <ToolOutlined />,
            label: 'Alati za održavanje',
            // permissions: ['maintenance:view'], // ❌ Uklonjeno - hijerarhijska logika
            children: [
              {
                key: '/transport/maintenance/timescaledb',
                menuOrder: 304010000000,
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
        menuOrder: 400000000000,
        icon: <SettingOutlined />,
        label: 'Podešavanje',
        // permissions: ['settings:view'], // ❌ Uklonjeno - hijerarhijska logika će automatski prikazati
        children: [
          {
            key: '/settings/general',
            menuOrder: 401000000000,
            icon: <SettingOutlined />,
            label: 'Opšta',
            // Direktna opcija sa tabovima unutar stranice - bez children
            permissions: [
              'settings.company_info:read',
              'legacy_databases:read',
              'legacy_tables:read',
              'settings.email_templates:view',
            ],
          },
          {
            key: '/settings/api-keys',
            menuOrder: 402000000000,
            icon: <ApiOutlined />,
            label: 'API Keys',
            permissions: ['api_keys:view'],
          },
        ],
      },
    ];

    // Prvo sortiraj, pa onda filtriraj
    const sortedItems = sortMenuItems(items);
    return filterMenuItems(sortedItems);
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
      if (path.includes('/administration/')) keys.push('administration');
      if (path.includes('/dispatcher/')) keys.push('dispatcher');
      if (path.includes('/safety/')) keys.push('safety');
      if (path.includes('/maintenance/')) keys.push('maintenance');
      if (path.includes('/planning/')) {
        keys.push('dispatcher'); // Planning je unutar dispatcher-a
        keys.push('planning');
      }
      if (path.includes('/turnusi')) keys.push('administration');
    }
    if (path.includes('/settings/')) {
      keys.push('settings');
      // 'general' više nije folder, već direktna opcija - nema potrebe za push
    }

    setOpenKeys(keys);
  }, [location.pathname]);

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    if (info.key.startsWith('/')) {
      navigate(info.key);
    }
  };

  const handleOpenChange: MenuProps['onOpenChange'] = (keys: string[]) => {
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
        token: {
          // Globalni font
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
          fontSize: 14,
        },
        components: {
          Layout: {
            siderBg: '#f8f9fa',
            triggerBg: '#e9ecef',
            triggerColor: '#495057',
          },
          Menu: {
            // Osnovne boje
            itemBg: '#f8f9fa',
            subMenuItemBg: 'rgba(255, 255, 255, 0.95)',
            popupBg: '#ffffff',

            // Font i veličine - EKSPERIMENT
            fontSize: 14, // Osnovni font size
            itemHeight: 36, // Visina stavke
            horizontalLineHeight: 42,
            groupTitleFontSize: 12,

            // Razmaci
            itemMarginInline: 4,
            itemMarginBlock: 2,
            itemPaddingInline: 8, // Smanjen padding levo/desno

            // Boje teksta
            itemColor: 'rgb(55, 65, 81)', // text-gray-700
            itemHoverColor: 'rgb(17, 24, 39)', // text-gray-900
            itemSelectedColor: 'rgb(37, 99, 235)', // text-blue-600

            // Pozadine za hover i selected
            itemHoverBg: 'rgb(249, 250, 251)', // bg-gray-50
            itemSelectedBg: 'rgb(219, 234, 254)', // bg-blue-100

            // Ikone
            iconSize: 16,
            iconMarginInlineEnd: 10,
            collapsedIconSize: 20,
            collapsedWidth: 80,

            // Border radius
            itemBorderRadius: 8,
            subMenuItemBorderRadius: 6,

            // Dodatno
            motionDurationMid: '0.3s',
            motionEaseInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
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
                Smart City Admin
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