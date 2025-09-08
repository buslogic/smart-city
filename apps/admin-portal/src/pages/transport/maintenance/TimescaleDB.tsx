import React, { useEffect } from 'react';
import { Card, Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../../stores/auth.store';

const { Title } = Typography;

const TimescaleDB: React.FC = () => {
  const { user } = useAuthStore();
  
  useEffect(() => {
    // Debug log za permisije
    console.log('===== DEBUG PERMISIJE =====');
    console.log('Korisnik:', user?.email);
    console.log('Role:', user?.roles);
    console.log('Sve permisije korisnika:', user?.permissions);
    console.log('Maintenance permisije:', user?.permissions?.filter(p => p.includes('maintenance')));
    console.log('Da li ima maintenance.timescaledb.view?', user?.permissions?.includes('maintenance.timescaledb.view'));
    console.log('==========================');
  }, [user]);
  
  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <DatabaseOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">TimescaleDB</Title>
        </div>
        
        <div className="text-gray-600">
          <p>TimescaleDB stranica</p>
          
          {/* Debug info */}
          <div className="mt-8 p-4 bg-gray-100 rounded">
            <h4 className="font-bold mb-2">Debug informacije:</h4>
            <p>Email: {user?.email}</p>
            <p>Role: {user?.roles?.join(', ')}</p>
            <p>Maintenance permisije: {user?.permissions?.filter(p => p.includes('maintenance')).join(', ') || 'nema'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TimescaleDB;