import React, { useState } from 'react';
import { Tabs, Card, Typography } from 'antd';
import { DatabaseOutlined, SettingOutlined, MailOutlined, CloudServerOutlined, TableOutlined, BuildOutlined } from '@ant-design/icons';
import { usePermissions } from '../../hooks/usePermissions';
import CompanyInfo from './components/CompanyInfo';
import LegacyDatabases from './components/LegacyDatabases';
import LegacyTableMappings from './components/LegacyTableMappings';
import EmailTemplates from './components/EmailTemplates';

const { Title } = Typography;

const GeneralSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('company-info');
  const { hasPermission } = usePermissions();

  const tabItems = [
    {
      key: 'company-info',
      label: (
        <span>
          <BuildOutlined />
          Informacije o Kompaniji
        </span>
      ),
      children: (
        <div className="p-4">
          <CompanyInfo />
        </div>
      ),
      permission: 'settings.company_info:read',
    },
    {
      key: 'legacy-databases',
      label: (
        <span>
          <DatabaseOutlined />
          Legacy Baze
        </span>
      ),
      children: (
        <div className="p-4">
          <LegacyDatabases />
        </div>
      ),
      permission: 'legacy_databases:read',
    },
    {
      key: 'legacy-tables',
      label: (
        <span>
          <TableOutlined />
          Legacy Tabele
        </span>
      ),
      children: (
        <div className="p-4">
          <LegacyTableMappings />
        </div>
      ),
      permission: 'legacy_tables:read',
    },
    {
      key: 'email-templates',
      label: (
        <span>
          <MailOutlined />
          Email Šabloni
        </span>
      ),
      children: (
        <div className="p-4">
          <EmailTemplates />
        </div>
      ),
      permission: 'settings.email_templates:view',
    },
    {
      key: 'system-settings',
      label: (
        <span>
          <CloudServerOutlined />
          Sistemska Podešavanja
        </span>
      ),
      children: (
        <div className="p-4">
          <div>Sistemska Podešavanja - Uskoro</div>
        </div>
      ),
      permission: 'settings:system:read',
      disabled: true,
    },
    {
      key: 'general-config',
      label: (
        <span>
          <SettingOutlined />
          Opšta Konfiguracija
        </span>
      ),
      children: (
        <div className="p-4">
          <div>Opšta Konfiguracija - Uskoro</div>
        </div>
      ),
      permission: 'settings:general:read',
      disabled: true,
    },
  ];

  // Filtriraj tabove na osnovu permisija
  const visibleTabItems = tabItems.filter(tab => 
    !tab.permission || hasPermission(tab.permission)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Title level={2}>Opšta Podešavanja</Title>
      </div>

      <Card className="shadow-sm">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          type="card"
          items={visibleTabItems}
        />
      </Card>
    </div>
  );
};

export default GeneralSettings;