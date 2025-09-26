import React, { useState } from 'react';
import { Tabs, Card, Typography } from 'antd';
import { TeamOutlined, KeyOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import RolesManagement from './components/RolesManagement';
import PermissionsManagement from './components/PermissionsManagement';

const { Title } = Typography;

const RolesPermissions: React.FC = () => {
  const [activeTab, setActiveTab] = useState('roles');

  const tabItems = [
    {
      key: 'roles',
      label: (
        <span>
          <TeamOutlined />
          Upravljanje Rolama
        </span>
      ),
      children: (
        <div className="p-4">
          <RolesManagement />
        </div>
      ),
    },
    {
      key: 'permissions',
      label: (
        <span>
          <KeyOutlined />
          Upravljanje Permisijama
        </span>
      ),
      children: (
        <div className="p-4">
          <PermissionsManagement />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Title level={2}>
          <SafetyCertificateOutlined className="mr-2" />
          Role i Permisije
        </Title>
      </div>

      <Card className="shadow-sm">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          type="card"
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default RolesPermissions;