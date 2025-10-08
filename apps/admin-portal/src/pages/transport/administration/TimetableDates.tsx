import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, Card, Typography } from 'antd';
import {
  CalendarOutlined,
  TagOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../hooks/usePermissions';
import MainServerTab from './components/timetable-dates/MainServerTab';
import TicketingServerTab from './components/timetable-dates/TicketingServerTab';
import CityServerTab from './components/timetable-dates/CityServerTab';

const { Title } = Typography;

const TimetableDates: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('main-server');

  const tabItems = [
    {
      key: 'main-server',
      label: (
        <span>
          <CalendarOutlined />
          Glavni server
        </span>
      ),
      children: (
        <div className="p-4">
          <MainServerTab />
        </div>
      ),
      permission: 'transport.administration.timetable_dates.main:view',
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
      permission: 'transport.administration.timetable_dates.ticketing:view',
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
      permission: 'transport.administration.timetable_dates.city:view',
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
        <Title level={2}>Grupe za RedVoznje</Title>
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

export default TimetableDates;
