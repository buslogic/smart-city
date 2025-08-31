import React, { useState } from 'react';
import { Shield, Key } from 'lucide-react';
import RolesManagement from './components/RolesManagementNew';
import PermissionsManagement from './components/PermissionsManagementNew';

const RolesPermissions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles');

  const tabs = [
    { id: 'roles', label: 'Upravljanje Rolama', icon: Shield },
    { id: 'permissions', label: 'Upravljanje Permisijama', icon: Key },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-6">
              <Shield className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                Role i Permisije
              </h1>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      py-2 px-1 border-b-2 font-medium text-sm flex items-center
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <tab.icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'roles' && <RolesManagement />}
              {activeTab === 'permissions' && <PermissionsManagement />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesPermissions;