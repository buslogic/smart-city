// PermissionsTreeMenuOrder.tsx - Nova implementacija koja koristi menuOrder za hijerarhiju
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  CheckSquare,
  Square,
  Users,
  Settings,
  Database,
  LayoutDashboard,
  Bus
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
  onBulkToggle?: (permissionIds: number[], checked: boolean) => void;
  readOnly?: boolean;
}

const PermissionsTreeMenuOrder: React.FC<PermissionsTreeProps> = ({
  allPermissions,
  selectedPermissions,
  expandedNodes,
  onExpandedNodesChange,
  onPermissionToggle,
  onBulkToggle,
  readOnly = false,
}) => {

  // Organizuj permisije prema hijerarhiji menija koristeći menuOrder
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
        case 'export': return 'text-emerald-600';
        default: return 'text-gray-600';
      }
    };

    const getMenuIcon = (menuOrder: number | null): React.ReactNode => {
      if (!menuOrder) return <Database className="h-5 w-5" />;

      const firstLevel = Math.floor(menuOrder / 100000000000);
      switch(firstLevel) {
        case 1: return <LayoutDashboard className="h-5 w-5" />; // Dashboard
        case 2: return <Users className="h-5 w-5" />;           // Korisnici
        case 3: return <Bus className="h-5 w-5" />;             // Transport
        case 4: return <Settings className="h-5 w-5" />;       // Podešavanje
        default: return <Database className="h-5 w-5" />;
      }
    };

    const getMenuColor = (menuOrder: number | null): { text: string, bg: string } => {
      if (!menuOrder) return { text: 'text-gray-700', bg: 'bg-gray-50' };

      const firstLevel = Math.floor(menuOrder / 100000000000);
      switch(firstLevel) {
        case 1: return { text: 'text-purple-700', bg: 'bg-purple-50' };
        case 2: return { text: 'text-indigo-700', bg: 'bg-indigo-50' };
        case 3: return { text: 'text-green-700', bg: 'bg-green-50' };
        case 4: return { text: 'text-orange-700', bg: 'bg-orange-50' };
        default: return { text: 'text-gray-700', bg: 'bg-gray-50' };
      }
    };

    // Mapiranje menuOrder na nazive menija na osnovu stvarnih menuOrder vrednosti iz ModernMenu
    const getMenuName = (menuOrder: number): string => {
      // Glavni nivoi (100000000000, 200000000000, 300000000000, 400000000000)
      if (menuOrder === 100000000000) return 'Dashboard';
      if (menuOrder === 200000000000) return 'Korisnici';
      if (menuOrder === 300000000000) return 'Autobuski Prevoznici';
      if (menuOrder === 400000000000) return 'Podešavanje';

      // Drugi nivo - Korisnici
      if (menuOrder === 201000000000) return 'Administracija';
      if (menuOrder === 202000000000) return 'Role i Permisije';
      if (menuOrder === 203000000000) return 'Grupe Korisnika';

      // Drugi nivo - Transport
      if (menuOrder === 301000000000) return 'Vozila';
      if (menuOrder === 301500000000) return 'Administracija';
      if (menuOrder === 302000000000) return 'Dispečerski Modul';
      if (menuOrder === 303000000000) return 'Bezbednost i Analiza';
      if (menuOrder === 304000000000) return 'Održavanje Sistema';

      // Treći nivo - Vozila
      if (menuOrder === 301010000000) return 'Lista Vozila';
      if (menuOrder === 301020000000) return 'Sinhronizacija';
      if (menuOrder === 301030000000) return 'GPS Real-Time Sync';
      if (menuOrder === 301040000000) return 'Legacy Sync';
      if (menuOrder === 301050000000) return 'GPS Migration';
      if (menuOrder === 301060000000) return 'GPS LAG Transfer';

      // Treći nivo - Administracija
      if (menuOrder === 301510000000) return 'Centralne tačke';

      // Treći nivo - Dispečerski Modul
      if (menuOrder === 302010000000) return 'Mapa';
      if (menuOrder === 302020000000) return 'Analitika vozila';
      if (menuOrder === 302030000000) return 'GPS Sync';
      if (menuOrder === 302040000000) return 'Karton Vozača';

      // Treći nivo - Bezbednost i Analiza
      if (menuOrder === 303010000000) return 'Agresivna vožnja';
      if (menuOrder === 303020000000) return 'Mesečni izveštaj';
      if (menuOrder === 303030000000) return 'Rekreacija podataka';

      // Treći nivo - Održavanje Sistema
      if (menuOrder === 304010000000) return 'TimescaleDB';

      // Drugi nivo - Podešavanje
      if (menuOrder === 401000000000) return 'Opšte informacije';
      if (menuOrder === 402000000000) return 'API Ključevi';
      if (menuOrder === 403000000000) return 'Email šabloni';

      // Treći nivo - Settings pod-opcije
      if (menuOrder >= 401010000000 && menuOrder < 401020000000) return 'Informacije o Kompaniji';
      if (menuOrder >= 401020000000 && menuOrder < 401030000000) return 'Legacy Baze';
      if (menuOrder >= 401030000000 && menuOrder < 401040000000) return 'Legacy Tabele';
      if (menuOrder >= 401040000000 && menuOrder < 401050000000) return 'Email Šabloni';
      if (menuOrder >= 401050000000 && menuOrder < 401060000000) return 'API Podešavanja';
      if (menuOrder >= 401060000000 && menuOrder < 401070000000) return 'Sistemska Podešavanja';

      // Fallback za permisije - koristi resource ili description
      const permission = allPermissions.find(p => p.menuOrder === menuOrder);
      if (permission) {
        // Pokušaj da napraviš prijazan naziv na osnovu resource i action
        const resource = permission.resource;
        const action = permission.action;

        // Specifični nazivi za poznate permisije
        if (resource === 'vehicles' && action === 'read') return 'Lista Vozila';
        if (resource === 'vehicles.sync' && action === 'view') return 'Sinhronizacija Vozila';
        if (resource === 'gps.buffer.sync' && action === 'view') return 'GPS Real-Time Sync';
        if (resource === 'gps.buffer.status' && action === 'view') return 'GPS Buffer Status';
        if (resource === 'legacy.sync' && action === 'view') return 'Legacy Sync';
        if (resource === 'system' && action === 'view') return 'GPS Migration';
        if (resource === 'vehicles.gps.lag' && action === 'view') return 'GPS LAG Transfer';
        if (resource === 'dispatcher' && action === 'view_map') return 'Mapa Vozila';
        if (resource === 'dispatcher' && action === 'view_analytics') return 'Analitika Vozila';
        if (resource === 'dispatcher.sync' && action === 'view') return 'GPS Sync Dashboard';
        if (resource === 'safety.aggressive.driving' && action === 'view') return 'Agresivna Vožnja';
        if (resource === 'safety.reports' && action === 'view') return 'Mesečni Izveštaj';
        if (resource === 'safety' && action === 'data_recreation') return 'Rekreacija Podataka';
        if (resource === 'system.timescaledb' && action === 'view') return 'TimescaleDB Management';

        // Koristi description ako postoji, inače kombinaciju resource i action
        if (permission.description) {
          return permission.description;
        }

        return `${resource}:${action}`;
      }

      return 'Nepoznato';
    };

    const getPermissionLabel = (permission: Permission): string => {
      // Prvo proverava da li permisija ima srpski opis (description_sr)
      if (permission.descriptionSr) {
        return permission.descriptionSr;
      }

      // Ako permisija ima menuOrder, koristi getMenuName logiku
      if (permission.menuOrder) {
        return getMenuName(permission.menuOrder);
      }

      // Inače koristi description ili name
      return permission.description || permission.name;
    };

    // Podeli permisije na one sa menuOrder i bez
    const menuPermissions = allPermissions.filter(p => p.menuOrder != null);
    const otherPermissions = allPermissions.filter(p => p.menuOrder == null);

    // Rekurzivna funkcija za kreiranje hijerarhije na bilo kom nivou
    const buildHierarchy = (permissions: Permission[], levelDepth: number = 0): PermissionNode[] => {
      // Grupiši permisije po trenutnom nivou koristeći string slicing
      // menuOrder struktura: XXYYZZ000000 (12 cifara)
      // levelDepth 0: grupiši po XX (pozicije 0-2)
      // levelDepth 1: grupiši po XXYY (pozicije 0-4)
      // levelDepth 2: grupiši po XXYYZZ (pozicije 0-6)
      const groups = permissions.reduce((acc, permission) => {
        const menuOrder = permission.menuOrder!;
        const menuOrderStr = menuOrder.toString().padStart(12, '0');

        // Uzmi cifre do trenutnog nivoa (uključivo)
        const currentGroupDigits = (levelDepth + 1) * 2;
        const groupKey = menuOrderStr.substring(0, currentGroupDigits);

        // Proveri da li ima sledeći nivo
        const nextLevelStart = currentGroupDigits;
        const nextLevelEnd = nextLevelStart + 2;
        const nextLevelDigits = menuOrderStr.substring(nextLevelStart, nextLevelEnd);
        const hasSubLevel = nextLevelDigits !== '00';

        if (!acc[groupKey]) {
          acc[groupKey] = {
            mainPermissions: [],
            subPermissions: []
          };
        }

        if (!hasSubLevel) {
          acc[groupKey].mainPermissions.push(permission);
        } else {
          acc[groupKey].subPermissions.push(permission);
        }

        return acc;
      }, {} as Record<string, { mainPermissions: Permission[], subPermissions: Permission[] }>);

      // Kreiraj nodove
      return Object.entries(groups).map(([groupKey, group]) => {
        const hasSubItems = group.subPermissions.length > 0;
        const firstPermission = group.mainPermissions[0] || group.subPermissions[0];
        const colors = getMenuColor(firstPermission.menuOrder!);

        const node: PermissionNode = {
          id: `level-${levelDepth}-${groupKey}`,
          name: getMenuName(firstPermission.menuOrder!),
          type: levelDepth === 0 ? 'menu' : 'submenu',
          icon: levelDepth === 0 ? getMenuIcon(firstPermission.menuOrder!) : undefined,
          color: colors.text,
          bgColor: colors.bg,
          children: []
        };

        // Ako nema pod-stavki i ima samo jednu glavnu permisiju
        if (!hasSubItems && group.mainPermissions.length === 1) {
          const permission = group.mainPermissions[0];

          // Proverava da li je ovo meni opcija (resource sadrži '.administration', '.roles', itd.)
          // ili je obična permisija (dashboard widgets, configurations)
          const isMenuOption = permission.resource.includes('.administration') ||
                             permission.resource.includes('.roles') ||
                             permission.resource.includes('.groups') ||
                             permission.resource.includes('.driver_card') ||
                             permission.action === 'view' && (
                               permission.resource.endsWith('.administration') ||
                               permission.resource.endsWith('.management') ||
                               permission.resource === 'roles' ||
                               permission.resource === 'users' ||
                               permission.resource === 'users.groups' ||
                               permission.resource === 'dashboard' ||
                               permission.resource === 'transport' ||
                               permission.resource === 'settings' ||
                               permission.resource.startsWith('settings.') ||
                               permission.resource === 'api_settings' ||
                               permission.resource === 'system_settings' ||
                               permission.resource === 'legacy_databases' ||
                               permission.resource === 'legacy_tables' ||
                               // Transport related menu options (treći nivo)
                               permission.resource === 'vehicles' ||
                               permission.resource.startsWith('vehicles.') ||
                               permission.resource.startsWith('dispatcher') ||
                               permission.resource === 'dispatcher.driver_card' ||
                               permission.resource.startsWith('safety.') ||
                               permission.resource.startsWith('maintenance.') ||
                               permission.resource.startsWith('gps.') ||
                               permission.resource.startsWith('legacy.') ||
                               permission.resource === 'system'
                             );

          // Ako je meni opcija, kreiraj kontejner čak i bez pod-stavki
          if (isMenuOption) {
            node.children = [{
              id: `perm-${permission.id}`,
              name: getPermissionLabel(permission),
              type: 'permission' as const,
              permission,
              color: getPermissionColor(permission.action)
            }];
            return node;
          }

          // Inače vrati kao direktnu permisiju
          return {
            id: `perm-${permission.id}`,
            name: getPermissionLabel(permission),
            type: 'permission' as const,
            permission,
            color: getPermissionColor(permission.action)
          };
        }

        // Ako nema pod-stavki ali ima više glavnih permisija, kreiraj kontejner
        if (!hasSubItems && group.mainPermissions.length > 1) {
          node.children = group.mainPermissions
            .sort((a, b) => (a.menuOrder! - b.menuOrder!))
            .map(permission => ({
              id: `perm-${permission.id}`,
              name: getPermissionLabel(permission),
              type: 'permission' as const,
              permission,
              color: getPermissionColor(permission.action)
            }));
        }

        // Ako ima pod-stavke, rekurzivno ih obradi
        if (hasSubItems) {
          const subNodes = buildHierarchy(group.subPermissions, levelDepth + 1);

          // Proverava da li subNodes sadrže folder/grupe (menu/submenu tipove)
          const hasSubFolders = subNodes.some(subNode =>
            subNode.type === 'menu' || subNode.type === 'submenu'
          );

          // Ako ima sub-folder/grupe, ne dodavaj glavne view permisije
          // Ako nema sub-folder/grupe (samo finalne permisije), dodaj glavne permisije
          if (hasSubFolders) {
            // Samo sub-folder/grupe, bez glavnih view permisija
            node.children = subNodes;
          } else {
            // Dodaj glavne permisije pre finalnih permisija
            const mainPermissionNodes = group.mainPermissions.map(permission => ({
              id: `perm-${permission.id}`,
              name: getPermissionLabel(permission),
              type: 'permission' as const,
              permission,
              color: getPermissionColor(permission.action)
            }));
            node.children = [...mainPermissionNodes, ...subNodes];
          }
        }

        return node;
      }).sort((a, b) => {
        // Sortiraju se po groupKey numerički (3010, 3015, 3020...)
        const aGroupKey = parseInt(a.id.split('-')[2]); // level-1-3010 -> 3010
        const bGroupKey = parseInt(b.id.split('-')[2]); // level-1-3015 -> 3015
        return aGroupKey - bGroupKey;
      });
    };

    let finalMenuTree = buildHierarchy(menuPermissions);

    // Dodaj ostale permisije (bez menuOrder) na kraju
    if (otherPermissions.length > 0) {
      finalMenuTree.push({
        id: 'other-permissions',
        name: 'Ostale Permisije',
        type: 'menu',
        icon: <Database className="h-5 w-5" />,
        color: 'text-gray-700',
        bgColor: 'bg-gray-50',
        children: otherPermissions
          .sort((a, b) => a.resource.localeCompare(b.resource) || a.action.localeCompare(b.action))
          .map(p => ({
            id: `perm-${p.id}`,
            name: getPermissionLabel(p),
            type: 'permission' as const,
            permission: p,
            color: getPermissionColor(p.action),
          }))
      });
    }

    return finalMenuTree.filter(menu => menu.children && menu.children.length > 0);
  };

  const tree = buildPermissionTree();

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    onExpandedNodesChange(newExpanded);
  };

  const getPermissionIds = (node: PermissionNode): number[] => {
    if (node.type === 'permission' && node.permission) {
      return [node.permission.id];
    }
    if (node.children) {
      return node.children.flatMap(getPermissionIds);
    }
    return [];
  };

  const handleBulkToggle = (node: PermissionNode, checked: boolean) => {
    if (!onBulkToggle) return;
    const permissionIds = getPermissionIds(node);
    onBulkToggle(permissionIds, checked);
  };

  const renderNode = (node: PermissionNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    if (node.type === 'permission' && node.permission) {
      const isSelected = selectedPermissions.includes(node.permission.id);
      return (
        <div
          key={node.id}
          className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-gray-50"
          style={{
            marginLeft: depth === 1 ? '2.5rem' : depth === 2 ? '3.5rem' : depth === 3 ? '4.5rem' : depth > 3 ? '5.5rem' : '0'
          }}
        >
          <button
            onClick={() => !readOnly && onPermissionToggle(node.permission!.id)}
            disabled={readOnly}
            className="flex items-center space-x-2 flex-grow text-left"
          >
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
            ) : (
              <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
            <span className={`text-sm ${node.color || 'text-gray-700'} truncate`}>
              {node.name}
            </span>
          </button>
        </div>
      );
    }

    const permissionIds = getPermissionIds(node);
    const selectedCount = permissionIds.filter(id => selectedPermissions.includes(id)).length;
    const isAllSelected = selectedCount === permissionIds.length && permissionIds.length > 0;
    const isPartialSelected = selectedCount > 0 && selectedCount < permissionIds.length;

    return (
      <div key={node.id} style={{
        marginLeft: depth === 1 ? '2rem' : depth === 2 ? '3rem' : depth === 3 ? '4rem' : depth > 3 ? '5rem' : '0'
      }}>
        <div
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer ${
            node.type === 'menu' ? node.bgColor || 'bg-gray-50' : ''
          }`}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(node.id)}
              className="flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </button>
          )}

          {!hasChildren && <div className="w-4" />}

          {node.icon && <div className="flex-shrink-0">{node.icon}</div>}

          <button
            onClick={() => {
              if (!readOnly && onBulkToggle && permissionIds.length > 0) {
                handleBulkToggle(node, !isAllSelected);
              }
              if (hasChildren) {
                toggleExpanded(node.id);
              }
            }}
            disabled={readOnly}
            className="flex items-center space-x-2 flex-grow text-left"
          >
            {permissionIds.length > 0 && (
              <>
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                ) : isPartialSelected ? (
                  <div className="h-4 w-4 border border-blue-600 bg-blue-100 flex-shrink-0 rounded-sm flex items-center justify-center">
                    <div className="h-2 w-2 bg-blue-600 rounded-sm" />
                  </div>
                ) : (
                  <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </>
            )}

            <span className={`font-medium text-sm ${node.color || 'text-gray-700'} truncate`}>
              {node.name}
            </span>

            {permissionIds.length > 0 && (
              <span className="text-xs text-gray-500 ml-auto">
                {selectedCount}/{permissionIds.length}
              </span>
            )}
          </button>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {tree.map(node => renderNode(node))}
    </div>
  );
};

export default PermissionsTreeMenuOrder;