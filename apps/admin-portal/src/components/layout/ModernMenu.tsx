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
  ExperimentOutlined,
  DropboxOutlined,
  HomeOutlined,
  MoneyCollectOutlined,
  ReadOutlined,
  FileSearchOutlined,
  UserAddOutlined,
  CalculatorOutlined,
  ShopOutlined,
  PrinterOutlined,
  LineChartOutlined,
  AuditOutlined,
  CheckCircleOutlined
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
            // Bez permissions - hijerarhijska logika: prikaži ako GeneralSettings komponenta ima vidljive tabove
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
      {
        key: 'vodovod',
        menuOrder: 500000000000,
        icon: <ExperimentOutlined />,
        label: 'Vodovod',
        children: [
          // Vodovodni sistem
          {
            key: 'vodovodniSistem',
            menuOrder: 510000000000,
            icon: <HomeOutlined />,
            label: 'Vodovodni sistem',
            children: [
              {
                key: '/vodovod/regioni',
                menuOrder: 511000000000,
                label: 'Rejoni',
                permissions: ['water_system.regions:view'],
              },
              {
                key: '/vodovod/gradovi',
                menuOrder: 512000000000,
                label: 'Gradovi',
                permissions: ['water_system.cities:view'],
              },
              {
                key: '/vodovod/zone',
                menuOrder: 513000000000,
                label: 'Zone',
                permissions: ['water_system_zones:view'],
              },
              {
                key: '/vodovod/ulice',
                menuOrder: 514000000000,
                label: 'Ulice',
                permissions: ['water_system_streets:view'],
              },
            ],
          },
          // Vodomeri
          {
            key: 'vodomeri',
            menuOrder: 520000000000,
            icon: <DropboxOutlined />,
            label: 'Vodomeri',
            children: [
              {
                key: '/vodovod/vodomeri',
                menuOrder: 521000000000,
                label: 'Evidencija vodomera',
                permissions: ['water_meters:view'],
              },
              {
                key: '/vodovod/tipovi-vodomera',
                menuOrder: 522000000000,
                label: 'Tipovi vodomera',
                permissions: ['water_meter_types:view'],
              },
              {
                key: '/vodovod/proizvodjaci-vodomera',
                menuOrder: 523000000000,
                label: 'Proizvođači vodomera',
                permissions: ['water_meter_manufacturers:view'],
              },
              {
                key: '/vodovod/dostupnost-vodomera',
                menuOrder: 524000000000,
                label: 'Dostupnost vodomera',
                permissions: ['water_meter_availability:view'],
              },
              {
                key: '/vodovod/zamena-vodomera',
                menuOrder: 525000000000,
                label: 'Zamena vodomera',
                permissions: ['water_meter_replacement:view'],
              },
              {
                key: '/vodovod/napomene-vodomera',
                menuOrder: 526000000000,
                label: 'Napomene',
                permissions: ['water_meter_remarks:view'],
              },
              {
                key: '/vodovod/pregled-izmenjenih-vodomera',
                menuOrder: 527000000000,
                label: 'Pregled izmenjenih',
                permissions: ['water_meter_review:view'],
              },
            ],
          },
          // Merna mesta
          {
            key: 'mernaMesta',
            menuOrder: 530000000000,
            icon: <EnvironmentOutlined />,
            label: 'Merna mesta',
            children: [
              {
                key: '/vodovod/merna-mesta',
                menuOrder: 531000000000,
                label: 'Pregled mernih mesta',
                permissions: ['measuring_points:view'],
              },
              {
                key: '/vodovod/merna-mesta-po-adresi',
                menuOrder: 532000000000,
                label: 'Merna mesta po adresi',
                permissions: ['measuring_points_by_address:view'],
              },
              {
                key: '/vodovod/potrosnja-mernih-mesta',
                menuOrder: 533000000000,
                label: 'Potrošnja',
                permissions: ['measuring_points_consumption:view'],
              },
            ],
          },
          // Očitavanja
          {
            key: 'ocitavanja',
            menuOrder: 540000000000,
            icon: <ReadOutlined />,
            label: 'Očitavanja',
            children: [
              {
                key: '/vodovod/ocitavanja',
                menuOrder: 541000000000,
                label: 'Pregled očitavanja',
                permissions: ['readings:view'],
              },
              {
                key: '/vodovod/liste-ocitavanja',
                menuOrder: 542000000000,
                label: 'Liste očitavanja',
                permissions: ['reading_lists:view'],
              },
              {
                key: '/vodovod/stampa-lista',
                menuOrder: 544000000000,
                label: 'Štampa lista',
                permissions: ['reading_lists_print:view'],
              },
              {
                key: '/vodovod/anomalije-ocitavanja',
                menuOrder: 545000000000,
                label: 'Anomalije',
                permissions: ['reading_anomalies:view'],
              },
              {
                key: '/vodovod/ocitaci',
                menuOrder: 546000000000,
                label: 'Očitači',
                permissions: ['water_readers:view'],
              },
            ],
          },
          // Usluge
          {
            key: 'usluge',
            menuOrder: 550000000000,
            icon: <ToolOutlined />,
            label: 'Usluge',
            children: [
              {
                key: '/vodovod/usluge',
                menuOrder: 551000000000,
                label: 'Pregled usluga',
                permissions: ['water_services:view'],
              },
              {
                key: '/vodovod/upravljanje-uslugama',
                menuOrder: 552000000000,
                label: 'Upravljanje uslugama',
                permissions: ['water_services_manage:view'],
              },
              {
                key: '/vodovod/cenovnik-usluga',
                menuOrder: 553000000000,
                label: 'Cenovnik',
                permissions: ['water_services_pricelist:view'],
              },
              {
                key: '/vodovod/istorija-cenovnika',
                menuOrder: 554000000000,
                label: 'Istorija cenovnika',
                permissions: ['water_service_pricelist_history:view'],
              },
              {
                key: '/vodovod/pregled-usluga',
                menuOrder: 555000000000,
                label: 'Pregled izvršenih usluga',
                permissions: ['water_services_review:view'],
              },
            ],
          },
          // Obračun
          {
            key: 'obracun',
            menuOrder: 560000000000,
            icon: <CalculatorOutlined />,
            label: 'Obračun',
            children: [
              {
                key: '/vodovod/obracuni-vodomera',
                menuOrder: 561000000000,
                label: 'Obračuni vodomera',
                permissions: ['water_meter_calculation:view'],
              },
              {
                key: '/vodovod/kampanja-obracuna',
                menuOrder: 562000000000,
                label: 'Kampanje obračuna',
                permissions: ['billing_campaign:view'],
              },
              {
                key: '/vodovod/kampanja',
                menuOrder: 563000000000,
                label: 'Kampanje',
                permissions: ['campaign:view'],
              },
              {
                key: '/vodovod/pod-kampanja',
                menuOrder: 564000000000,
                label: 'Pod-kampanje',
                permissions: ['sub_campaign:view'],
              },
              {
                key: '/vodovod/stanje-unosa-obracuna',
                menuOrder: 565000000000,
                label: 'Stanje unosa',
                permissions: ['input_calculation_state:view'],
              },
            ],
          },
          // Naplata
          {
            key: 'naplata',
            menuOrder: 570000000000,
            icon: <MoneyCollectOutlined />,
            label: 'Naplata',
            children: [
              {
                key: '/vodovod/uplate',
                menuOrder: 571000000000,
                label: 'Uplate',
                permissions: ['payments:view'],
              },
              {
                key: '/vodovod/uplate-po-nacinu-placanja',
                menuOrder: 572000000000,
                label: 'Uplate po načinu plaćanja',
                permissions: ['payments_by_method:view'],
              },
              {
                key: '/vodovod/blagajna',
                menuOrder: 573000000000,
                label: 'Blagajna',
                permissions: ['cash_register:view'],
              },
              {
                key: '/vodovod/blagajnici',
                menuOrder: 574000000000,
                label: 'Blagajnici',
                permissions: ['cashiers:view'],
              },
              {
                key: '/vodovod/sesija-blagajnika',
                menuOrder: 575000000000,
                label: 'Sesije blagajnika',
                permissions: ['cashiers_session:view'],
              },
              {
                key: '/vodovod/izvestaj-blagajne',
                menuOrder: 576000000000,
                label: 'Izveštaj blagajne',
                permissions: ['cash_register_report:view'],
              },
              {
                key: '/vodovod/fiskalni-uredjaj',
                menuOrder: 577000000000,
                label: 'Fiskalni uređaj',
                permissions: ['fiscal_device:view'],
              },
            ],
          },
          // Subvencije
          {
            key: 'subvencije',
            menuOrder: 580000000000,
            icon: <MoneyCollectOutlined />,
            label: 'Subvencije',
            children: [
              {
                key: '/vodovod/subvencije',
                menuOrder: 581000000000,
                label: 'Pregled subvencija',
                permissions: ['subsidies:view'],
              },
              {
                key: '/vodovod/dodela-subvencija',
                menuOrder: 582000000000,
                label: 'Dodela subvencija',
                permissions: ['subsidies_assignment:view'],
              },
            ],
          },
          // Korisnički nalozi
          {
            key: 'korisnici-vodovod',
            menuOrder: 590000000000,
            icon: <UserAddOutlined />,
            label: 'Korisnički nalozi',
            children: [
              {
                key: '/vodovod/korisnicki-nalozi',
                menuOrder: 591000000000,
                label: 'Pregled naloga',
                permissions: ['user_accounts:view'],
              },
              {
                key: '/vodovod/kucivetnici',
                menuOrder: 592000000000,
                label: 'Kućivetnici',
                permissions: ['house_council:view'],
              },
            ],
          },
          // Reklamacije
          {
            key: 'reklamacije',
            menuOrder: 600000000000,
            icon: <FileSearchOutlined />,
            label: 'Reklamacije',
            children: [
              {
                key: '/vodovod/reklamacije',
                menuOrder: 601000000000,
                label: 'Pregled reklamacija',
                permissions: ['complaints:view'],
              },
              {
                key: '/vodovod/reklamacije-za-odgovorno-lice',
                menuOrder: 602000000000,
                label: 'Za odgovorno lice',
                permissions: ['complaints_by_assignee:view'],
              },
              {
                key: '/vodovod/prioriteti-reklamacija',
                menuOrder: 603000000000,
                label: 'Prioriteti',
                permissions: ['complaint_priorities:view'],
              },
            ],
          },
          // Napomene
          {
            key: 'napomene',
            menuOrder: 610000000000,
            icon: <FileTextOutlined />,
            label: 'Napomene',
            children: [
              {
                key: '/vodovod/beleske',
                menuOrder: 611000000000,
                label: 'Beleške',
                permissions: ['water_supply_notes:view'],
              },
              {
                key: '/vodovod/kategorije-beleski',
                menuOrder: 612000000000,
                label: 'Kategorije beleški',
                permissions: ['note_categories:view'],
              },
            ],
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
      if (path.includes('/dispatcher/')) keys.push('dispatcher');
      if (path.includes('/safety/')) keys.push('safety');
      if (path.includes('/maintenance/')) keys.push('maintenance');
    }
    if (path.includes('/settings/')) keys.push('settings');
    if (path.includes('/vodovod/')) {
      keys.push('vodovod');
      // Sub-meniji
      if (path.includes('/vodovod/regioni') || path.includes('/vodovod/gradovi') ||
          path.includes('/vodovod/zone') || path.includes('/vodovod/ulice')) {
        keys.push('vodovodniSistem');
      }
      if (path.includes('/vodovod/vodomeri') || path.includes('/vodovod/tipovi-vodomera') ||
          path.includes('/vodovod/proizvodjaci') || path.includes('/vodovod/dostupnost') ||
          path.includes('/vodovod/zamena') || path.includes('/vodovod/napomene-vodomera') ||
          path.includes('/vodovod/pregled-izmenjenih')) {
        keys.push('vodomeri');
      }
      if (path.includes('/vodovod/merna-mesta')) {
        keys.push('mernaMesta');
      }
      if (path.includes('/vodovod/ocitavanja') || path.includes('/vodovod/liste-ocitavanja') ||
          path.includes('/vodovod/stampa-lista') ||
          path.includes('/vodovod/anomalije') || path.includes('/vodovod/ocitaci')) {
        keys.push('ocitavanja');
      }
      if (path.includes('/vodovod/usluge') || path.includes('/vodovod/upravljanje-uslugama') ||
          path.includes('/vodovod/cenovnik') || path.includes('/vodovod/istorija-cenovnika') ||
          path.includes('/vodovod/pregled-usluga')) {
        keys.push('usluge');
      }
      if (path.includes('/vodovod/kalkulacija') || path.includes('/vodovod/kampanja') ||
          path.includes('/vodovod/stanje-unosa')) {
        keys.push('obracun');
      }
      if (path.includes('/vodovod/uplate') || path.includes('/vodovod/blagajna') ||
          path.includes('/vodovod/blagajnici') || path.includes('/vodovod/sesija') ||
          path.includes('/vodovod/izvestaj') || path.includes('/vodovod/fiskalni')) {
        keys.push('naplata');
      }
      if (path.includes('/vodovod/subvencije') || path.includes('/vodovod/dodela')) {
        keys.push('subvencije');
      }
      if (path.includes('/vodovod/korisnicki-nalozi') || path.includes('/vodovod/kucivetnici')) {
        keys.push('korisnici-vodovod');
      }
      if (path.includes('/vodovod/reklamacije') || path.includes('/vodovod/prioriteti')) {
        keys.push('reklamacije');
      }
      if (path.includes('/vodovod/napomene') || path.includes('/vodovod/kategorije')) {
        keys.push('napomene');
      }
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