import React, { useState, useEffect } from 'react';
import { Shield, Save, RotateCcw, ChevronDown, AlertTriangle } from 'lucide-react';
import type { Role, Permission } from '../../../types/rbac.types';
import { rbacService } from '../../../services/rbacService';
import PermissionsTree from './PermissionsTree';
import { usePermissions } from '../../../hooks/usePermissions';

const PermissionsManagement: React.FC = () => {
  const { canAccess } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Check permissions
  const canView = canAccess(['permissions:view']);
  const canUpdate = canAccess(['permissions:update']);

  const fetchRoles = async () => {
    try {
      const response = await rbacService.getRoles(1, 100);
      if (response.data && response.data.length > 0) {
        // Sortiraj role po ID u ascending redosledu
        const sortedRoles = response.data.sort((a: Role, b: Role) => a.id - b.id);
        setRoles(sortedRoles);
      } else {
        console.error('Nema rola u bazi');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
        errorDiv.textContent = 'Upozorenje: Nema rola u bazi podataka';
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
      }
    } catch (error) {
      console.error('Greška pri učitavanju rola:', error);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      errorDiv.textContent = 'Greška pri učitavanju rola. Proverite konekciju sa serverom.';
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await rbacService.getPermissions();
      if (response.data && response.data.length > 0) {
        setAllPermissions(response.data);
      } else {
        // Ako API vraća praznu listu, prikaži grešku
        console.error('API vraća praznu listu permisija');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
        errorDiv.textContent = 'Greška: Nema permisija u bazi. Kontaktirajte administratora.';
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
      }
    } catch (error) {
      console.error('Greška pri učitavanju permisija:', error);
      // Prikaži grešku korisniku
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      errorDiv.textContent = 'Greška pri učitavanju permisija iz baze podataka';
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
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
      setRolePermissions([]);
      setOriginalPermissions([]);
      setHasChanges(false);
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      errorDiv.textContent = 'Greška pri učitavanju permisija za ovu rolu';
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
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
    setExpandedNodes(new Set()); // Reset expanded nodes when changing role
  };

  const handlePermissionToggle = (permissionId: number) => {
    if (!canUpdate) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      errorDiv.textContent = 'Nemate dozvolu za izmenu permisija';
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 2000);
      return;
    }
    
    if (rolePermissions.includes(permissionId)) {
      setRolePermissions(rolePermissions.filter(id => id !== permissionId));
    } else {
      setRolePermissions([...rolePermissions, permissionId]);
    }
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    
    if (!canUpdate) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      errorDiv.textContent = 'Nemate dozvolu za ažuriranje permisija';
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
      return;
    }
    
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
      const errorDiv = document.createElement('div');
      errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
      errorDiv.textContent = 'Greška pri čuvanju permisija. Pokušajte ponovo.';
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRolePermissions(originalPermissions);
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  // Ako korisnik nema permissions:view, prikaži poruku
  if (!canView) {
    return (
      <div className="bg-white p-12 rounded-lg shadow text-center">
        <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-700 font-semibold mb-2">Pristup odbijen</p>
        <p className="text-gray-500">Nemate dozvolu za pregled permisija</p>
      </div>
    );
  }

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
                className="w-[36rem] px-4 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <div className="flex items-center justify-between">
                  <span className={selectedRoleData ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedRoleData ? (
                      <>
                        <span className="font-medium">ID: {selectedRoleData.id}</span>
                        <span className="mx-3">•</span>
                        <span className="font-semibold">{selectedRoleData.name}</span>
                        <span className="mx-3">-</span>
                        <span className="text-gray-600">{selectedRoleData.description}</span>
                      </>
                    ) : 'Izaberite rolu...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {roles.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500 text-sm text-center">
                      Nema dostupnih rola
                    </div>
                  ) : (
                    roles.map(role => (
                      <button
                        key={role.id}
                        onClick={() => handleRoleChange(role.id)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-blue-600 min-w-[3rem]">ID: {role.id}</span>
                          <span className="font-semibold text-gray-900 min-w-[10rem]">{role.name}</span>
                          <span className="text-sm text-gray-500 flex-1">{role.description}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          
          {selectedRole && (
            <div className="flex items-center space-x-2">
              {canUpdate && (
                <>
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
                </>
              )}
              {!canUpdate && hasChanges && (
                <span className="text-sm text-gray-500 italic">Nemate dozvolu za ažuriranje permisija</span>
              )}
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
            expandedNodes={expandedNodes}
            onExpandedNodesChange={setExpandedNodes}
            onPermissionToggle={handlePermissionToggle}
            onBulkToggle={(permissionIds, selected) => {
              if (!canUpdate) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
                errorDiv.textContent = 'Nemate dozvolu za izmenu permisija';
                document.body.appendChild(errorDiv);
                setTimeout(() => errorDiv.remove(), 2000);
                return;
              }
              
              if (selected) {
                const newPermissions = [...new Set([...rolePermissions, ...permissionIds])];
                setRolePermissions(newPermissions);
              } else {
                const newPermissions = rolePermissions.filter(id => !permissionIds.includes(id));
                setRolePermissions(newPermissions);
              }
            }}
            readOnly={!canUpdate}
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