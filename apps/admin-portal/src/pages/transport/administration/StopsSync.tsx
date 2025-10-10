import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, Card, Typography } from 'antd';
import {
  EnvironmentOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../hooks/usePermissions';
import MainServerTab from './components/stops-sync/MainServerTab';
import TicketingServerTab from './components/stops-sync/TicketingServerTab';
import CityServerTab from './components/stops-sync/CityServerTab';

const { Title } = Typography;

const StopsSync: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('ticketing-server');

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
      permission: 'transport.administration.stops_sync.main:view',
    },
    {
      key: 'ticketing-server',
      label: (
        <span>
          <EnvironmentOutlined />
          Tiketing Server
        </span>
      ),
      children: (
        <div className="p-4">
          <TicketingServerTab />
        </div>
      ),
      permission: 'transport.administration.stops_sync.ticketing:view',
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
      permission: 'transport.administration.stops_sync.city:view',
    },
  ];

  // Filtriraj tabove na osnovu permisija
  const visibleTabItems = useMemo(() => {
    return tabItems.filter(tab => {
      const hasAccess = !tab.permission || hasPermission(tab.permission);
      return hasAccess;
    });
  }, [hasPermission]);

  // Automatski postavi prvi dostupan tab kao aktivan ako trenutni nije dostupan
  useEffect(() => {
    if (visibleTabItems.length > 0) {
      const isActiveTabVisible = visibleTabItems.some(tab => tab.key === activeTab);
      if (!isActiveTabVisible) {
        setActiveTab(visibleTabItems[0].key);
      }
    }
  }, [visibleTabItems, activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Title level={2}>Stajališta Sync.</Title>
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

export default StopsSync;
