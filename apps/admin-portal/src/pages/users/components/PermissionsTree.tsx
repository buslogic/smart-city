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
  LayoutDashboard
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
  onPermissionToggle: (permissionId: number) => void;
  onBulkToggle: (permissionIds: number[], selected: boolean) => void;
}

const PermissionsTree: React.FC<PermissionsTreeProps> = ({
  allPermissions,
  selectedPermissions,
  onPermissionToggle,
  onBulkToggle,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['korisnici', 'autobuski-prevoznici', 'podesavanja']));

  // Organizuj permisije prema hijerarhiji menija
  const buildPermissionTree = (): PermissionNode[] => {
    const getPermissionColor = (action: string) => {
      switch(action) {
        case 'create': return 'text-green-600';
        case 'read': return 'text-blue-600';
        case 'update': return 'text-orange-600';
        case 'delete': return 'text-red-600';
        case 'manage': return 'text-purple-600';
        default: return 'text-gray-600';
      }
    };

    const tree: PermissionNode[] = [
      {
        id: 'dashboard',
        name: 'Dashboard',
        type: 'menu',
        icon: <LayoutDashboard className="h-5 w-5" />,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50',
        children: [
          {
            id: 'dashboard-settings',
            name: 'Dashboard podešavanja',
            type: 'section',
            icon: <Settings className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'dashboard')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'dashboard-widgets',
            name: 'Dashboard widget-i',
            type: 'section',
            icon: <LayoutDashboard className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource.startsWith('dashboard.widgets'))
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
      {
        id: 'korisnici',
        name: 'Korisnici',
        type: 'menu',
        icon: <Users className="h-5 w-5" />,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        children: [
          {
            id: 'administracija-korisnika',
            name: 'Administracija korisnika',
            type: 'submenu',
            icon: <UserCog className="h-4 w-4" />,
            color: 'text-blue-600',
            children: [
              {
                id: 'users-crud',
                name: 'Upravljanje korisnicima',
                type: 'section',
                icon: <Users className="h-4 w-4" />,
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
            ],
          },
          {
            id: 'role-i-permisije',
            name: 'Role i permisije',
            type: 'submenu',
            icon: <Shield className="h-4 w-4" />,
            color: 'text-indigo-600',
            children: [
              {
                id: 'roles-section',
                name: 'Upravljanje rolama',
                type: 'section',
                icon: <Shield className="h-4 w-4" />,
                children: allPermissions
                  .filter(p => p.resource === 'roles')
                  .map(p => ({
                    id: `perm-${p.id}`,
                    name: getPermissionLabel(p),
                    type: 'permission' as const,
                    permission: p,
                    color: getPermissionColor(p.action),
                  })),
              },
              {
                id: 'permissions-section',
                name: 'Upravljanje permisijama',
                type: 'section',
                icon: <Key className="h-4 w-4" />,
                children: allPermissions
                  .filter(p => p.resource === 'permissions')
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
      {
        id: 'autobuski-prevoznici',
        name: 'Autobuski Prevoznici',
        type: 'menu',
        icon: <Bus className="h-5 w-5" />,
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        children: [
          {
            id: 'administracija-vozila',
            name: 'Administracija Vozila',
            type: 'section',
            icon: <Car className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'vehicles' && p.action !== 'sync')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'sinhronizacija-vozila',
            name: 'Sinhronizacija Vozila',
            type: 'section',
            icon: <RefreshCw className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'vehicles' && p.action === 'sync')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'dispatcher-map-vehicles',
            name: 'Dispečerski Modul - Mapa i vozila',
            type: 'section',
            icon: <Map className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'dispatcher_map' || p.name === 'dispatcher:view_map')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'dispatcher-analytics',
            name: 'Dispečerski Modul - Analiza',
            type: 'section',
            icon: <BarChart3 className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'dispatcher_analytics' || p.name === 'dispatcher:view_analytics')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'dispatcher-sync',
            name: 'Dispečerski Modul - Sinhronizacija',
            type: 'section',
            icon: <RefreshCw className="h-4 w-4" />,
            children: allPermissions
              .filter(p => 
                p.name === 'dispatcher:sync_gps' || 
                p.name === 'dispatcher:view_sync_dashboard' ||
                p.name === 'dispatcher.manage_cron' ||
                p.name === 'dispatcher.manage_gps' ||
                p.name === 'dispatcher.view_dashboard'
              )
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
            name: 'Legacy GPS Sinhronizacija',
            type: 'section',
            icon: <Database className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'legacy_sync')
              .map(p => ({
                id: `perm-${p.id}`,
                name: getPermissionLabel(p),
                type: 'permission' as const,
                permission: p,
                color: getPermissionColor(p.action),
              })),
          },
          {
            id: 'safety-aggressive',
            name: 'Bezbednost - Agresivna vožnja',
            type: 'section',
            icon: <AlertTriangle className="h-4 w-4" />,
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
            id: 'safety-report',
            name: 'Bezbednost - Mesečni izveštaj',
            type: 'section',
            icon: <FileText className="h-4 w-4" />,
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
        ],
      },
      {
        id: 'podesavanja',
        name: 'Podešavanja',
        type: 'menu',
        icon: <Settings className="h-5 w-5" />,
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        children: [
          {
            id: 'opsta-podesavanja',
            name: 'Opšta Podešavanja',
            type: 'section',
            icon: <Sliders className="h-4 w-4" />,
            children: allPermissions
              .filter(p => p.resource === 'settings' || p.resource === 'legacy_databases' || p.resource === 'legacy_tables')
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

    // Filtriraj prazne sekcije
    return tree.map(menu => ({
      ...menu,
      children: menu.children?.filter(submenu => {
        if (submenu.type === 'section') {
          return submenu.children && submenu.children.length > 0;
        }
        return true;
      }),
    })).filter(menu => menu.children && menu.children.length > 0);
  };

  const getPermissionLabel = (permission: Permission): string => {
    // Specifični labeli za dispatcher permisije
    if (permission.resource === 'dispatcher') {
      const dispatcherLabels: Record<string, string> = {
        'manage_cron': 'Upravljanje cron procesima',
        'view_dashboard': 'Pregled dashboard-a',
        'manage_gps': 'Upravljanje GPS sistemom',
      };
      if (dispatcherLabels[permission.action]) {
        return dispatcherLabels[permission.action];
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
    
    const labels: Record<string, string> = {
      'create': 'Kreiranje',
      'read': 'Pregled',
      'update': 'Ažuriranje',
      'delete': 'Brisanje',
      'manage': 'Upravljanje',
    };
    
    return permission.description || labels[permission.action] || permission.name;
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
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
    if (node.type === 'permission' && node.permission) {
      onPermissionToggle(node.permission.id);
    } else {
      const nodePermissions = getNodePermissions(node);
      const selectionState = isNodeSelected(node);
      onBulkToggle(nodePermissions, selectionState !== 'all');
    }
  };

  const renderNode = (node: PermissionNode, level: number = 0) => {
    const isExpanded = isNodeExpanded(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const selectionState = isNodeSelected(node);
    
    const paddingLeft = level * 20;
    
    // Definiši stil za različite tipove nodova
    const getNodeStyling = () => {
      switch (node.type) {
        case 'menu':
          return `${node.bgColor || 'bg-gray-50'} border-l-4 border-l-blue-500 font-bold text-base py-3`;
        case 'submenu':
          return 'bg-gray-25 font-semibold text-sm py-2.5 border-l-2 border-l-gray-300';
        case 'section':
          return 'font-medium text-sm py-2 bg-white';
        case 'permission':
          return 'text-sm py-1.5 bg-white hover:bg-blue-25';
        default:
          return '';
      }
    };
    
    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            flex items-center px-3 cursor-pointer transition-colors duration-150
            hover:bg-blue-50 group
            ${getNodeStyling()}
            ${selectionState === 'all' ? 'bg-blue-50' : ''}
          `}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          {/* Expand/Collapse ikona */}
          {hasChildren && node.type !== 'permission' && (
            <button
              onClick={() => toggleNode(node.id)}
              className="mr-3 p-1 hover:bg-white hover:shadow-sm rounded transition-all duration-150"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          )}
          
          {/* Checkbox */}
          <button
            onClick={() => handleNodeToggle(node)}
            className="mr-3 flex-shrink-0 p-1 hover:bg-white hover:shadow-sm rounded transition-all duration-150"
          >
            {selectionState === 'all' ? (
              <CheckSquare className="h-5 w-5 text-green-600" />
            ) : selectionState === 'some' ? (
              <div className="relative">
                <Square className="h-5 w-5 text-orange-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2.5 w-2.5 bg-orange-500 rounded-sm"></div>
                </div>
              </div>
            ) : (
              <Square className="h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            )}
          </button>
          
          {/* Ikona */}
          {node.icon && (
            <span className={`mr-3 flex-shrink-0 ${node.color || 'text-gray-500'}`}>
              {node.icon}
            </span>
          )}
          
          {/* Fallback ikone */}
          {!node.icon && node.type !== 'permission' && (
            <span className="mr-3 flex-shrink-0">
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-gray-500" />
              )}
            </span>
          )}
          
          {!node.icon && node.type === 'permission' && (
            <span className="mr-3 flex-shrink-0">
              <Lock className={`h-3.5 w-3.5 ${node.color || 'text-gray-400'}`} />
            </span>
          )}
          
          {/* Naziv */}
          <span className={`
            flex-grow
            ${node.type === 'permission' ? 'text-sm' : ''}
            ${node.color || (selectionState === 'all' ? 'text-green-700' : 'text-gray-700')}
            ${selectionState === 'all' && node.type !== 'permission' ? 'font-semibold' : ''}
          `}>
            {node.name}
          </span>
          
          {/* Badge za permisije akciju */}
          {node.type === 'permission' && node.permission && (
            <span className={`
              ml-2 px-2 py-0.5 text-xs font-medium rounded-full
              ${getActionBadgeColor(node.permission.action)}
            `}>
              {node.permission.action.toUpperCase()}
            </span>
          )}
          
          {/* Broj permisija */}
          {node.type !== 'permission' && hasChildren && (
            <span className="ml-3 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full font-medium">
              {getNodePermissions(node).length}
            </span>
          )}
        </div>
        
        {/* Prikaži decu ako je node otvoren */}
        {hasChildren && isExpanded && (
          <div className={`${node.type === 'menu' ? 'border-l border-l-gray-200 ml-6' : ''}`}>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getActionBadgeColor = (action: string) => {
    switch(action) {
      case 'create': return 'bg-green-100 text-green-700 border border-green-200';
      case 'read': return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'update': return 'bg-orange-100 text-orange-700 border border-orange-200';
      case 'delete': return 'bg-red-100 text-red-700 border border-red-200';
      case 'manage': return 'bg-purple-100 text-purple-700 border border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const tree = buildPermissionTree();

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-blue-900">Permisije organizovane po meniju</h3>
        </div>
        <p className="text-xs text-blue-700 mt-1">Odaberite permisije koje želite dodeliti ovoj ulozi</p>
      </div>
      <div className="max-h-96 overflow-y-auto bg-gray-50">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
};

export default PermissionsTree;