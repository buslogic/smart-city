// Last updated: 2025-09-10 08:35:00 - Visual improvements: smaller checkboxes, gradients, better indentation
import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  FolderOpen, 
  CheckSquare, 
  Square,
  Users,
  Shield,
  Settings,
  Database,
  Key,
  Lock,
  UserCog,
  FileText,
  BarChart3,
  Globe,
  Server,
  Bus,
  Car,
  Map,
  Navigation,
  RefreshCw,
  AlertTriangle,
  Sliders,
  LayoutDashboard,
  Radio,
  Gauge
} from 'lucide-react';
import type { Permission } from '../../../types/rbac.types';

interface PermissionNode {
  id: string;
  name: string;
  type: 'menu' | 'submenu' | 'section' | 'permission';
  permission?: Permission;
  children?: PermissionNode[];
  icon?: React.ReactNode;
  color?: string;
  bgColor?: string;
}

interface PermissionsTreeProps {
  allPermissions: Permission[];
  selectedPermissions: number[];
  expandedNodes: Set<string>;
  onExpandedNodesChange: (nodes: Set<string>) => void;
  onPermissionToggle: (permissionId: number) => void;
  onBulkToggle: (permissionIds: number[], selected: boolean) => void;
  readOnly?: boolean;
}

const PermissionsTree: React.FC<PermissionsTreeProps> = ({
  allPermissions,
  selectedPermissions,
  expandedNodes,
  onExpandedNodesChange,
  onPermissionToggle,
  onBulkToggle,
  readOnly = false,
}) => {

  // Organizuj permisije prema hijerarhiji menija
  const buildPermissionTree = (): PermissionNode[] => {
    const getPermissionColor = (action: string) => {
      switch(action) {
        case 'create': return 'text-green-600';
        case 'read': return 'text-blue-600';
        case 'view': return 'text-blue-600';
        case 'update': return 'text-orange-600';
        case 'delete': return 'text-red-600';
        case 'manage': return 'text-purple-600';
        case 'start': return 'text-green-600';
        case 'stop': return 'text-red-600';
        case 'configure': return 'text-purple-600';
        case 'cleanup': return 'text-amber-600';
        case 'dashboard': return 'text-indigo-600';
        case 'sync_gps': return 'text-cyan-600';
        case 'view_map': return 'text-blue-600';
        case 'view_analytics': return 'text-indigo-600';
        case 'view_aggressive': return 'text-orange-600';
        case 'view_report': return 'text-purple-600';
        default: return 'text-gray-600';
      }
    };

    const tree: PermissionNode[] = [
      // Dashboard
      {
        id: 'dashboard',
        name: 'Dashboard',
        type: 'menu',
        icon: <LayoutDashboard className="h-5 w-5" />,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50',
        children: allPermissions
          .filter(p => p.resource === 'dashboard' || p.resource?.startsWith('dashboard.widgets'))
          .map(p => ({
            id: `perm-${p.id}`,
            name: getPermissionLabel(p),
            type: 'permission' as const,
            permission: p,
            color: getPermissionColor(p.action),
          })),
      },
      
      // Korisnici
      {
        id: 'korisnici',
        name: 'Korisnici',
        type: 'menu',
        icon: <Users className="h-5 w-5" />,
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50',
        children: [
          {
            id: 'administracija',
            name: 'Administracija',
            type: 'section',
            icon: <UserCog className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'users')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'role-i-permisije',
            name: 'Role i Permisije',
            type: 'section',
            icon: <Shield className="h-4 w-4" />,
            children: [
              ...allPermissions
                .filter(p => p.resource === 'roles')
                .map(p => ({
                  id: `perm-${p.id}`,
                  name: getPermissionLabel(p),
                  type: 'permission' as const,
                  permission: p,
                  color: getPermissionColor(p.action),
                })),
              ...allPermissions
                .filter(p => p.resource === 'permissions')
                .map(p => ({
                  id: `perm-${p.id}`,
                  name: getPermissionLabel(p),
                  type: 'permission' as const,
                  permission: p,
                  color: getPermissionColor(p.action),
                })),
            ],
          },
        ],
      },
      
      // Autobuski Prevoznici
      {
        id: 'autobuski-prevoznici',
        name: 'Autobuski Prevoznici',
        type: 'menu',
        icon: <Bus className="h-5 w-5" />,
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        children: [
          // Vozila submenu
          {
            id: 'vozila',
            name: 'Vozila',
            type: 'submenu',
            icon: <Car className="h-4 w-4" />,
            children: [
              {
                id: 'vozila-section',
                name: 'Vozila',
                type: 'section',
                children: allPermissions
                  .filter(p => p.resource === 'vehicles')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'sinhronizacija',
                name: 'Sinhronizacija',
                type: 'section',
                children: allPermissions
                  .filter(p => p.resource === 'vehicles.sync')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'gps-realtime-sync',
                name: 'GPS Real-Time Sync',
                type: 'section',
                children: allPermissions
                  .filter(p => p.resource === 'dispatcher.sync')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'legacy-sync',
                name: 'Legacy Sync',
                type: 'section',
                children: allPermissions
                  .filter(p => p.resource === 'legacy.sync')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
            ],
          },
          
          // Dispečerski Modul submenu
          {
            id: 'dispecerski-modul',
            name: 'Dispečerski Modul',
            type: 'submenu',
            icon: <Navigation className="h-4 w-4" />,
            children: [
              {
                id: 'mapa',
                name: 'Mapa',
                type: 'section',
                children: allPermissions
                  .filter(p => p.name === 'dispatcher:view_map' || p.resource === 'dispatcher_map')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'analitika',
                name: 'Analitika',
                type: 'section',
                children: allPermissions
                  .filter(p => p.name === 'dispatcher:view_analytics' || p.resource === 'dispatcher_analytics')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'gps-sync-dispatcher',
                name: 'GPS Sync',
                type: 'section',
                children: allPermissions
                  .filter(p => 
                    p.name === 'dispatcher:manage' || 
                    p.name === 'dispatcher:read' ||
                    p.name === 'dispatcher:track_vehicles' ||
                    p.name === 'dispatcher:send_commands' ||
                    p.name === 'dispatcher:emergency_actions'
                  )
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
            ],
          },
          
          // Bezbednost submenu
          {
            id: 'bezbednost',
            name: 'Bezbednost',
            type: 'submenu',
            icon: <AlertTriangle className="h-4 w-4" />,
            children: [
              {
                id: 'agresivna-voznja',
                name: 'Agresivna Vožnja',
                type: 'section',
                children: allPermissions
                  .filter(p => p.name === 'safety:view_aggressive' || p.name === 'safety:view_aggressive_driving')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'mesecni-izvestaj',
                name: 'Mesečni Izveštaj',
                type: 'section',
                children: allPermissions
                  .filter(p => p.name === 'safety:view_report' || p.name === 'safety:view_monthly_report')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'rekreacija-podataka',
                name: 'Rekreacija podataka',
                type: 'section',
                children: allPermissions
                  .filter(p => p.resource === 'safety.data-recreation')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
            ],
          },
          
          // Alati za održavanje submenu
          {
            id: 'alati-za-odrzavanje',
            name: 'Alati za održavanje',
            type: 'submenu',
            icon: <Settings className="h-4 w-4" />,
            children: [
              {
                id: 'timescaledb',
                name: 'TimescaleDB',
                type: 'section',
                children: allPermissions
                  .filter(p => p.resource === 'maintenance.timescaledb')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
            ],
          },
        ],
      },
      
      // Podešavanje
      {
        id: 'podesavanje',
        name: 'Podešavanje',
        type: 'menu',
        icon: <Settings className="h-5 w-5" />,
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        children: [
          {
            id: 'opsta',
            name: 'Opšta',
            type: 'section',
            icon: <Sliders className="h-4 w-4" />,
            children: allPermissions
              .filter(p => 
                p.resource === 'settings' || 
                p.resource === 'settings.general' ||
                p.resource === 'api_settings' ||
                p.resource === 'system_settings' ||
                p.resource === 'legacy_databases' ||
                p.resource === 'legacy_tables'
              )
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
        ],
      },
    ];

    // Filtriranje praznih sekcija
    return tree.map(menu => ({
      ...menu,
      children: menu.children?.filter(item => {
        if (item.type === 'section' || item.type === 'submenu') {
          if (item.children && item.children.length > 0) {
            return true;
          }
          return false;
        }
        return true;
      }).map(item => {
        if (item.type === 'submenu' && item.children) {
          return {
            ...item,
            children: item.children.filter(section => 
              section.children && section.children.length > 0
            ),
          };
        }
        return item;
      }),
    })).filter(menu => menu.children && menu.children.length > 0);
  };

  const getPermissionLabel = (permission: Permission): string => {
    // Specifični labeli za vehicles.sync permisije
    if (permission.resource === 'vehicles.sync') {
      const vehiclesSyncLabels: Record<string, string> = {
        'view': 'Pregled statusa sinhronizacije',
        'start': 'Pokretanje sinhronizacije',
        'stop': 'Zaustavljanje sinhronizacije',
        'configure': 'Konfiguracija parametara',
      };
      if (vehiclesSyncLabels[permission.action]) {
        return vehiclesSyncLabels[permission.action];
      }
    }
    
    // Specifični labeli za maintenance permisije
    if (permission.resource === 'maintenance.timescaledb') {
      const maintenanceLabels: Record<string, string> = {
        'view': 'Pregled TimescaleDB alata',
        'manage': 'Upravljanje TimescaleDB operacijama',
      };
      if (maintenanceLabels[permission.action]) {
        return maintenanceLabels[permission.action];
      }
    }
    
    // Specifični labeli za dispatcher permisije
    if (permission.resource === 'dispatcher') {
      const dispatcherLabels: Record<string, string> = {
        'read': 'Pregled dispečerskog modula',
        'manage': 'Upravljanje dispečerskim modulom',
        'track_vehicles': 'Praćenje vozila',
        'send_commands': 'Slanje komandi',
        'view_map': 'Pregled mape',
        'view_analytics': 'Pregled analitike',
        'sync_gps': 'GPS sinhronizacija',
        'emergency_actions': 'Hitne akcije',
      };
      if (dispatcherLabels[permission.action]) {
        return dispatcherLabels[permission.action];
      }
    }
    
    // Specifični labeli za safety permisije
    if (permission.resource === 'safety' || permission.name?.startsWith('safety:')) {
      if (permission.name === 'safety:view_aggressive' || permission.name === 'safety:view_aggressive_driving') {
        return 'Pregled agresivne vožnje';
      }
      if (permission.name === 'safety:view_report' || permission.name === 'safety:view_monthly_report') {
        return 'Pregled mesečnog izveštaja';
      }
    }
    
    // Specifični labeli za safety.data-recreation
    if (permission.resource === 'safety.data-recreation') {
      const recreationLabels: Record<string, string> = {
        'manage': 'Upravljanje rekreacijom podataka',
        'view': 'Pregled rekreacije podataka',
      };
      if (recreationLabels[permission.action]) {
        return recreationLabels[permission.action];
      }
    }
    
    // Specifični labeli za legacy_sync permisije
    if (permission.resource === 'legacy_sync') {
      const legacySyncLabels: Record<string, string> = {
        'view': 'Pregled Legacy sinhronizacije',
        'manage': 'Upravljanje Legacy sinhronizacijom',
        'start': 'Pokretanje Legacy sinhronizacije',
        'stop': 'Zaustavljanje Legacy sinhronizacije',
      };
      if (legacySyncLabels[permission.action]) {
        return legacySyncLabels[permission.action];
      }
    }
    
    // Dashboard widgets
    if (permission.resource && permission.resource.startsWith('dashboard.widgets')) {
      if (permission.resource === 'dashboard.widgets.gps') {
        return 'GPS Sync Widget';
      }
      if (permission.resource === 'dashboard.widgets.vehicles') {
        return 'Statistike Vozila Widget';
      }
      if (permission.resource === 'dashboard.widgets.users') {
        return 'Statistike Korisnika Widget';
      }
      if (permission.resource === 'dashboard.widgets.system') {
        return 'Zdravlje Sistema Widget';
      }
    }
    
    // Generički labeli
    const labels: Record<string, string> = {
      'create': 'Kreiranje',
      'read': 'Pregled',
      'view': 'Pregled',
      'update': 'Ažuriranje',
      'delete': 'Brisanje',
      'manage': 'Upravljanje',
      'sync': 'Sinhronizacija',
      'export': 'Eksportovanje',
      'configure': 'Konfiguracija',
      'start': 'Pokretanje',
      'stop': 'Zaustavljanje',
      'cleanup': 'Čišćenje',
      'dashboard': 'Dashboard Widget',
    };
    
    if (labels[permission.action]) {
      return labels[permission.action];
    }
    
    return permission.description || permission.name;
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    onExpandedNodesChange(newExpanded);
  };

  const isNodeExpanded = (nodeId: string) => expandedNodes.has(nodeId);

  const getNodePermissions = (node: PermissionNode): number[] => {
    if (node.type === 'permission' && node.permission) {
      return [node.permission.id];
    }
    if (node.children) {
      return node.children.flatMap(child => getNodePermissions(child));
    }
    return [];
  };

  const isNodeSelected = (node: PermissionNode): 'all' | 'some' | 'none' => {
    const nodePermissions = getNodePermissions(node);
    if (nodePermissions.length === 0) return 'none';
    
    const selectedCount = nodePermissions.filter(id => selectedPermissions.includes(id)).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === nodePermissions.length) return 'all';
    return 'some';
  };

  const handleNodeToggle = (node: PermissionNode) => {
    const nodePermissions = getNodePermissions(node);
    const selectionState = isNodeSelected(node);
    
    if (selectionState === 'all') {
      onBulkToggle(nodePermissions, false);
    } else {
      onBulkToggle(nodePermissions, true);
    }
  };

  const renderNode = (node: PermissionNode, level: number = 0) => {
    const isExpanded = isNodeExpanded(node.id);
    const selectionState = isNodeSelected(node);
    const hasChildren = node.children && node.children.length > 0;
    
    // Dinamički margini na osnovu nivoa i tipa parent node-a - koristimo piksele direktno
    const getMarginLeft = () => {
      if (node.type === 'menu') return 0;  // NIVO 1 - bez uvlačenja
      if (node.type === 'submenu') return 40;  // Submenu uvlačenje
      if (node.type === 'section') {
        // NIVO 2 - Section (Administracija, Role i Permisije)
        if (level === 1) return 40;  // Sekcija direktno pod menu (40px)
        if (level === 2) return 60;  // Sekcija pod submenu (60px)
        if (level === 3) return 80;  // Sekcija pod sekciju (80px)
        return 40;
      }
      if (node.type === 'permission') {
        // NIVO 3 - Permission (još više uvučene)
        if (level === 1) return 80;   // Permisija direktno pod menu (retko)
        if (level === 2) return 80;   // Permisija pod section koji je pod menu (80px)
        if (level === 3) return 100;  // Permisija pod section koji je pod submenu (100px)
        if (level === 4) return 120;  // Permisija pod section koji je pod section (120px)
        return 80;
      }
      return 0;
    };
    
    const marginLeft = getMarginLeft();
    
    return (
      <div key={node.id} className="select-none">
        <div 
          style={{ marginLeft: `${marginLeft}px` }}
          className={`
            flex items-center px-3 py-2.5 rounded-lg transition-all duration-150
            ${node.type === 'menu' ? `${node.bgColor} border-2 ${node.bgColor?.replace('bg-', 'border-').replace('50', '200')} mb-3 shadow-md hover:shadow-lg` : ''}
            ${node.type === 'submenu' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 mb-2 shadow-sm hover:from-blue-100 hover:to-indigo-100' : ''}
            ${node.type === 'section' ? 'bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 border-l-4 border-l-blue-500 mb-1.5' : ''}
            ${node.type === 'permission' ? 'bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-white border-l-2 border-l-gray-300 hover:border-l-blue-400' : ''}
          `}
        >
          {/* Expand/Collapse dugme */}
          {hasChildren && node.type !== 'permission' && (
            <button
              onClick={() => toggleNode(node.id)}
              className={`mr-3 p-1 rounded transition-all duration-150 ${
                node.type === 'menu' ? 'hover:bg-white/70' : 'hover:bg-gray-100'
              }`}
            >
              {isExpanded ? (
                <ChevronDown className={`h-4 w-4 transition-transform ${
                  node.type === 'menu' ? 'text-gray-700' : 'text-gray-500'
                }`} />
              ) : (
                <ChevronRight className={`h-4 w-4 transition-transform ${
                  node.type === 'menu' ? 'text-gray-700' : 'text-gray-500'
                }`} />
              )}
            </button>
          )}
          
          {/* Elegantniji checkbox */}
          <button
            onClick={() => !readOnly && handleNodeToggle(node)}
            className={`mr-2 flex-shrink-0 transition-all duration-150 ${
              readOnly ? 'cursor-not-allowed opacity-60' : ''
            }`}
            disabled={readOnly}
          >
            <div style={{
              position: 'relative',
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              transition: 'all 200ms',
              backgroundColor: selectionState === 'all' ? '#dcfce7' : 'white',
              border: `2px solid ${
                selectionState === 'all' ? '#86efac' :
                selectionState === 'none' ? '#d1d5db' : 
                '#6b7280'
              }`
            }}>
              {selectionState === 'all' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#1f2937',
                  borderRadius: '50%'
                }}></div>
              )}
              {selectionState === 'some' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#1f2937',
                  borderRadius: '50%'
                }}></div>
              )}
            </div>
          </button>
          
          {/* Ikona */}
          {node.icon && (
            <span className={`mr-3 flex-shrink-0 ${node.color || 'text-gray-500'}`}>
              {node.icon}
            </span>
          )}
          
          {/* Naziv */}
          <div className="flex-grow flex items-center gap-6">
            <span className={`
              ${node.type === 'menu' ? `font-bold text-base ${node.color}` : ''}
              ${node.type === 'submenu' ? 'font-semibold text-sm text-gray-800' : ''}
              ${node.type === 'section' ? 'font-medium text-sm text-blue-700' : ''}
              ${node.type === 'permission' ? 'text-sm text-gray-600' : ''}
            `}>
              {node.name}
            </span>
            
            {/* Permission name badge sa bojom na osnovu akcije */}
            {node.type === 'permission' && node.permission && (
              <span className={`ml-auto mr-4 px-3 py-1 text-xs font-mono rounded-md
                ${node.permission.action === 'create' ? 'bg-green-100 text-green-700 border border-green-200' : ''}
                ${node.permission.action === 'view' || node.permission.action === 'read' ? 'bg-blue-100 text-blue-700 border border-blue-200' : ''}
                ${node.permission.action === 'update' ? 'bg-amber-100 text-amber-700 border border-amber-200' : ''}
                ${node.permission.action === 'delete' ? 'bg-red-100 text-red-700 border border-red-200' : ''}
                ${node.permission.action === 'manage' || node.permission.action === 'configure' ? 'bg-purple-100 text-purple-700 border border-purple-200' : ''}
                ${node.permission.action === 'start' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : ''}
                ${node.permission.action === 'stop' ? 'bg-rose-100 text-rose-700 border border-rose-200' : ''}
                ${node.permission.action === 'sync_gps' ? 'bg-cyan-100 text-cyan-700 border border-cyan-200' : ''}
                ${!['create', 'view', 'read', 'update', 'delete', 'manage', 'configure', 'start', 'stop', 'sync_gps'].includes(node.permission.action) ? 'bg-gray-100 text-gray-600 border border-gray-200' : ''}
              `}>
                {node.permission.name}
              </span>
            )}
          </div>
          
        </div>
        
        {/* Children */}
        {isExpanded && hasChildren && (
          <div className={`
            ${node.type === 'menu' ? 'ml-2 mt-2 pl-2 border-l-2 border-gray-200' : ''}
            ${node.type === 'submenu' ? 'ml-2 mt-1 pl-2 border-l border-gray-200' : ''}
            ${node.type === 'section' ? 'mt-1' : ''}
          `}>
            {node.children?.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const permissionTree = buildPermissionTree();

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="space-y-2">
        {permissionTree.map(node => renderNode(node))}
      </div>
      
      {permissionTree.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Lock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Nema dostupnih permisija za prikaz</p>
        </div>
      )}
    </div>
  );
};

export default PermissionsTree;