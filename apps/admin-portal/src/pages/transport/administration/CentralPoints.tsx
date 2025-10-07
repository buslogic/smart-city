import React, { useState } from 'react';
import { Tabs, Card, Typography } from 'antd';
import {
  EnvironmentOutlined,
  TagOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../hooks/usePermissions';
import MainServerTab from './components/MainServerTab';
import TicketingServerTab from './components/TicketingServerTab';
import CityServerTab from './components/CityServerTab';

const { Title } = Typography;

const CentralPoints: React.FC = () => {
  const [activeTab, setActiveTab] = useState('main-server');
  const { hasPermission } = usePermissions();

  const tabItems = [
    {
      key: 'main-server',
      label: (
        <span>
          <EnvironmentOutlined />
          Glavni server
        </span>
      ),
      children: (
        <div className="p-4">
          <MainServerTab />
        </div>
      ),
      permission: 'transport.administration.central_points:view',
    },
    {
      key: 'ticketing-server',
      label: (
        <span>
          <TagOutlined />
          Tiketing Server
        </span>
      ),
      children: (
        <div className="p-4">
          <TicketingServerTab />
        </div>
      ),
      permission: 'transport.administration.central_points.ticketing:view',
    },
    {
      key: 'city-server',
      label: (
        <span>
          <GlobalOutlined />
          Gradski server
        </span>
      ),
      children: (
        <div className="p-4">
          <CityServerTab />
        </div>
      ),
      permission: 'transport.administration.central_points.city:view',
    },
  ];

  // Filtriraj tabove na osnovu permisija
  const visibleTabItems = tabItems.filter(tab => {
    const hasAccess = !tab.permission || hasPermission(tab.permission);
    console.log(`Tab "${tab.key}" - Permission: "${tab.permission}" - HasAccess: ${hasAccess}`);
    return hasAccess;
  });

  console.log('Total visible tabs:', visibleTabItems.length, visibleTabItems.map(t => t.key));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Title level={2}>Centralne tačke</Title>
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

export default CentralPoints;
