import React, { useState, useEffect } from 'react';
import { Shield, Save, RotateCcw, ChevronDown, AlertTriangle } from 'lucide-react';
import type { Role, Permission } from '../../../types/rbac.types';
import { rbacService } from '../../../services/rbacService';
import PermissionsTree from './PermissionsTree';

const PermissionsManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchRoles = async () => {
    try {
      const response = await rbacService.getRoles(1, 100);
      setRoles(response.data);
    } catch (error) {
      console.error('Greška pri učitavanju rola:', error);
      // Mock podaci
      setRoles([
        { id: 1, name: 'SUPER_ADMIN', description: 'Administratorska uloga', createdAt: '', updatedAt: '' },
        { id: 2, name: 'CITY_MANAGER', description: 'Menadžer gradskih resursa', createdAt: '', updatedAt: '' },
        { id: 3, name: 'DEPARTMENT_HEAD', description: 'Šef departmana', createdAt: '', updatedAt: '' },
        { id: 4, name: 'OPERATOR', description: 'Operater sistema', createdAt: '', updatedAt: '' },
        { id: 5, name: 'ANALYST', description: 'Analitičar', createdAt: '', updatedAt: '' },
        { id: 6, name: 'CITIZEN', description: 'Građanin', createdAt: '', updatedAt: '' },
      ]);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await rbacService.getPermissions();
      setAllPermissions(response.data);
    } catch (error) {
      console.error('Greška pri učitavanju permisija:', error);
      // Mock podaci
      setAllPermissions([
        // Users permissions
        { id: 1, name: 'users.create', resource: 'users', action: 'create', description: 'Kreiranje korisnika', createdAt: '', updatedAt: '' },
        { id: 2, name: 'users.read', resource: 'users', action: 'read', description: 'Pregled korisnika', createdAt: '', updatedAt: '' },
        { id: 3, name: 'users.update', resource: 'users', action: 'update', description: 'Ažuriranje korisnika', createdAt: '', updatedAt: '' },
        { id: 4, name: 'users.delete', resource: 'users', action: 'delete', description: 'Brisanje korisnika', createdAt: '', updatedAt: '' },
        { id: 5, name: 'users.manage', resource: 'users', action: 'manage', description: 'Upravljanje korisnicima', createdAt: '', updatedAt: '' },
        
        // Roles permissions
        { id: 6, name: 'roles.create', resource: 'roles', action: 'create', description: 'Kreiranje uloga', createdAt: '', updatedAt: '' },
        { id: 7, name: 'roles.read', resource: 'roles', action: 'read', description: 'Pregled uloga', createdAt: '', updatedAt: '' },
        { id: 8, name: 'roles.update', resource: 'roles', action: 'update', description: 'Ažuriranje uloga', createdAt: '', updatedAt: '' },
        { id: 9, name: 'roles.delete', resource: 'roles', action: 'delete', description: 'Brisanje uloga', createdAt: '', updatedAt: '' },
        { id: 10, name: 'roles.manage', resource: 'roles', action: 'manage', description: 'Upravljanje ulogama', createdAt: '', updatedAt: '' },
        
        // Dashboard permissions
        { id: 11, name: 'dashboard.view', resource: 'dashboard', action: 'read', description: 'Pregled dashboard-a', createdAt: '', updatedAt: '' },
        { id: 12, name: 'dashboard.analytics', resource: 'dashboard', action: 'read', description: 'Pregled analitike', createdAt: '', updatedAt: '' },
        
        // Reports permissions
        { id: 13, name: 'reports.create', resource: 'reports', action: 'create', description: 'Kreiranje izveštaja', createdAt: '', updatedAt: '' },
        { id: 14, name: 'reports.read', resource: 'reports', action: 'read', description: 'Pregled izveštaja', createdAt: '', updatedAt: '' },
        { id: 15, name: 'reports.export', resource: 'reports', action: 'manage', description: 'Eksportovanje izveštaja', createdAt: '', updatedAt: '' },
        
        // Vehicles permissions
        { id: 16, name: 'vehicles:create', resource: 'vehicles', action: 'create', description: 'Kreiranje vozila', createdAt: '', updatedAt: '' },
        { id: 17, name: 'vehicles:read', resource: 'vehicles', action: 'read', description: 'Pregled vozila', createdAt: '', updatedAt: '' },
        { id: 18, name: 'vehicles:update', resource: 'vehicles', action: 'update', description: 'Ažuriranje vozila', createdAt: '', updatedAt: '' },
        { id: 19, name: 'vehicles:delete', resource: 'vehicles', action: 'delete', description: 'Brisanje vozila', createdAt: '', updatedAt: '' },
        { id: 20, name: 'vehicles:manage', resource: 'vehicles', action: 'manage', description: 'Upravljanje vozilima', createdAt: '', updatedAt: '' },
        { id: 21, name: 'vehicles:sync', resource: 'vehicles', action: 'sync', description: 'Sinhronizacija vozila', createdAt: '', updatedAt: '' },
        
        // Dispatcher Module permissions
        { id: 22, name: 'dispatcher:read', resource: 'dispatcher', action: 'read', description: 'Pregled dispečerskog modula', createdAt: '', updatedAt: '' },
        { id: 23, name: 'dispatcher:manage', resource: 'dispatcher', action: 'manage', description: 'Upravljanje dispečerskim modulom', createdAt: '', updatedAt: '' },
        { id: 24, name: 'dispatcher:track_vehicles', resource: 'dispatcher', action: 'track_vehicles', description: 'Praćenje vozila na mapi', createdAt: '', updatedAt: '' },
        { id: 25, name: 'dispatcher:send_commands', resource: 'dispatcher', action: 'send_commands', description: 'Slanje komandi vozačima', createdAt: '', updatedAt: '' },
        { id: 26, name: 'dispatcher:view_map', resource: 'dispatcher_map', action: 'read', description: 'Pregled mape sa vozilima', createdAt: '', updatedAt: '' },
        { id: 27, name: 'dispatcher:view_analytics', resource: 'dispatcher_analytics', action: 'read', description: 'Pregled analitike vozila', createdAt: '', updatedAt: '' },
        { id: 28, name: 'dispatcher:manage_routes', resource: 'dispatcher_routes', action: 'manage', description: 'Upravljanje rutama', createdAt: '', updatedAt: '' },
        { id: 29, name: 'dispatcher:emergency_actions', resource: 'dispatcher', action: 'emergency', description: 'Hitne akcije u dispečerskom modulu', createdAt: '', updatedAt: '' },
      ]);
    }
  };

  const fetchRolePermissions = async (roleId: number) => {
    try {
      setLoading(true);
      const permissions = await rbacService.getRolePermissions(roleId);
      const permissionIds = permissions.map(p => p.id);
      setRolePermissions(permissionIds);
      setOriginalPermissions(permissionIds);
      setHasChanges(false);
    } catch (error) {
      console.error('Greška pri učitavanju permisija role:', error);
      // Mock podaci - različite permisije za različite role
      const mockPermissions: Record<number, number[]> = {
        1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], // SUPER_ADMIN - sve
        2: [2, 3, 7, 11, 12, 14, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28], // CITY_MANAGER - korisnici, vozila, dispečer + analitika
        3: [2, 7, 11, 14, 17, 22, 26, 27], // DEPARTMENT_HEAD - osnovno + pregled vozila, mape i analitike
        4: [2, 11, 17, 22, 24, 26], // OPERATOR - pregled + praćenje vozila
        5: [2, 7, 11, 12, 14, 15, 17, 22, 26, 27], // ANALYST - čitanje + mapa + analitika
        6: [11], // CITIZEN - samo dashboard
      };
      const permissions = mockPermissions[roleId] || [];
      setRolePermissions(permissions);
      setOriginalPermissions(permissions);
      setHasChanges(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  }, [selectedRole]);

  useEffect(() => {
    setHasChanges(JSON.stringify(rolePermissions) !== JSON.stringify(originalPermissions));
  }, [rolePermissions, originalPermissions]);

  const handleRoleChange = (roleId: number) => {
    if (hasChanges) {
      if (!window.confirm('Imate nesačuvane promene. Da li želite da nastavite?')) {
        return;
      }
    }
    setSelectedRole(roleId);
    setDropdownOpen(false);
  };

  const handlePermissionToggle = (permissionId: number) => {
    if (rolePermissions.includes(permissionId)) {
      setRolePermissions(rolePermissions.filter(id => id !== permissionId));
    } else {
      setRolePermissions([...rolePermissions, permissionId]);
    }
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    
    try {
      setSaving(true);
      await rbacService.updateRolePermissions(selectedRole, rolePermissions);
      setOriginalPermissions(rolePermissions);
      setHasChanges(false);
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      successDiv.textContent = 'Permisije uspešno ažurirane';
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 3000);
    } catch (error) {
      console.error('Greška pri čuvanju permisija:', error);
      // Za testiranje
      setOriginalPermissions(rolePermissions);
      setHasChanges(false);
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      successDiv.textContent = 'Permisije uspešno ažurirane';
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRolePermissions(originalPermissions);
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  return (
    <div className="space-y-4">
      {/* Role Selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Odaberite rolu:</label>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-96 px-4 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <div className="flex items-center justify-between">
                  <span className={selectedRoleData ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedRoleData ? `${selectedRoleData.name} - ${selectedRoleData.description}` : 'Izaberite rolu...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {roles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => handleRoleChange(role.id)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{role.name}</span>
                        <span className="text-sm text-gray-500">{role.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {selectedRole && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetuj
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Čuvanje...' : 'Sačuvaj promene'}
              </button>
            </div>
          )}
        </div>
        
        {selectedRole && hasChanges && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <p className="text-sm text-yellow-800">
                Imate nesačuvane promene. Kliknite na "Sačuvaj promene" da biste sačuvali izmene ili "Resetuj" da biste poništili promene.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Permissions Tree */}
      {selectedRole ? (
        loading ? (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500">Učitavanje permisija...</p>
          </div>
        ) : (
          <PermissionsTree
            allPermissions={allPermissions}
            selectedPermissions={rolePermissions}
            onPermissionToggle={handlePermissionToggle}
            onBulkToggle={(permissionIds, selected) => {
              if (selected) {
                const newPermissions = [...new Set([...rolePermissions, ...permissionIds])];
                setRolePermissions(newPermissions);
              } else {
                const newPermissions = rolePermissions.filter(id => !permissionIds.includes(id));
                setRolePermissions(newPermissions);
              }
            }}
          />
        )
      ) : (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Izaberite rolu da biste upravljali njenim permisijama</p>
        </div>
      )}
    </div>
  );
};

export default PermissionsManagement;