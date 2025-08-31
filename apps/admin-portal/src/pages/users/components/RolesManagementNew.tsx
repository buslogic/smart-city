import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, Shield, X, Check } from 'lucide-react';
import type { Role } from '../../../types/rbac.types';
import { rbacService } from '../../../services/rbacService';

const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; description?: string }>({});

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await rbacService.getRoles(1, 100);
      setRoles(response.data);
    } catch (error) {
      console.error('Greška pri učitavanju rola:', error);
      // Mock podaci za testiranje
      const mockRoles: Role[] = [
        {
          id: 1,
          name: 'SUPER_ADMIN',
          description: 'Administratorska uloga sa potpunim pristupom',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 10 },
        },
        {
          id: 2,
          name: 'CITY_MANAGER',
          description: 'Menadžer gradskih resursa',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 7 },
        },
        {
          id: 3,
          name: 'DEPARTMENT_HEAD',
          description: 'Šef departmana',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 0, permissions: 5 },
        },
        {
          id: 4,
          name: 'OPERATOR',
          description: 'Operater sistema',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 2, permissions: 3 },
        },
        {
          id: 5,
          name: 'ANALYST',
          description: 'Analitičar',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 0, permissions: 2 },
        },
        {
          id: 6,
          name: 'CITIZEN',
          description: 'Građanin',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 0, permissions: 0 },
        },
      ];
      setRoles(mockRoles);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleAdd = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description || '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await rbacService.deleteRole(id);
      fetchRoles();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Greška pri brisanju role:', error);
      // Za testiranje
      setRoles(roles.filter(r => r.id !== id));
      setDeleteConfirmId(null);
    }
  };

  const validateForm = () => {
    const errors: { name?: string; description?: string } = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Naziv role je obavezan';
    } else if (!/^[A-Z_]+$/.test(formData.name)) {
      errors.name = 'Naziv mora biti u formatu VELIKA_SLOVA_SA_PODVLAKOM';
    }
    
    if (formData.description && formData.description.length > 255) {
      errors.description = 'Opis ne može biti duži od 255 karaktera';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingRole) {
        await rbacService.updateRole(editingRole.id, formData);
      } else {
        await rbacService.createRole(formData);
      }
      fetchRoles();
      setModalOpen(false);
    } catch (error) {
      console.error('Greška pri čuvanju role:', error);
      // Za testiranje
      if (editingRole) {
        setRoles(roles.map(r => r.id === editingRole.id ? { ...r, ...formData } : r));
      } else {
        const newRole: Role = {
          id: Math.max(...roles.map(r => r.id)) + 1,
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { users: 0, permissions: 0 },
        };
        setRoles([...roles, newRole]);
      }
      setModalOpen(false);
    }
  };

  const getRoleColor = (roleName: string) => {
    const colors: Record<string, string> = {
      'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
      'CITY_MANAGER': 'bg-blue-100 text-blue-800',
      'DEPARTMENT_HEAD': 'bg-green-100 text-green-800',
      'OPERATOR': 'bg-yellow-100 text-yellow-800',
      'ANALYST': 'bg-orange-100 text-orange-800',
      'CITIZEN': 'bg-gray-100 text-gray-800',
    };
    return colors[roleName] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Upravljanje Rolama</h2>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova rola
        </button>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Naziv
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opis
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statistika
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kreirana
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Akcije</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Učitavanje...
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Nema pronađenih rola
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(role.name)}`}>
                      {role.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {role.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-gray-400 mr-1" />
                        <span>{role._count?.users || 0} korisnika</span>
                      </div>
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 text-gray-400 mr-1" />
                        <span>{role._count?.permissions || 0} permisija</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(role.createdAt).toLocaleDateString('sr-RS')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Izmeni"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {deleteConfirmId === role.id ? (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Potvrdi"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Otkaži"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(role.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!!role._count?.users && role._count.users > 0}
                          title={role._count?.users && role._count.users > 0 ? "Ne možete obrisati rolu koja ima korisnike" : "Obriši"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingRole ? 'Izmeni rolu' : 'Nova rola'}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Naziv role
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formErrors.name ? 'border-red-300' : ''
                  }`}
                  placeholder="npr. DEPARTMENT_MANAGER"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Opis
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formErrors.description ? 'border-red-300' : ''
                  }`}
                  placeholder="Opis role i njenih odgovornosti"
                />
                {formErrors.description && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Otkaži
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sačuvaj
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RolesManagement;