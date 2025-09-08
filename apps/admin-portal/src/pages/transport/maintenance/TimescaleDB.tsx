import React from 'react';
import { Card, Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Title } = Typography;

const TimescaleDB: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <DatabaseOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">TimescaleDB</Title>
        </div>
        
        <div className="text-gray-600">
          <p>TimescaleDB stranica za održavanje</p>
        </div>
      </Card>
    </div>
  );
};

export default TimescaleDB;