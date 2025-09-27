import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Title } = Typography;

const DriverCard: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <UserOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">Karton Vozača</Title>
        </div>

        <div className="min-h-[400px] flex items-center justify-center">
          <Empty
            description={
              <div className="text-gray-500">
                <p className="text-lg mb-2">Funkcionalnost u pripremi</p>
                <p>Ovde će biti prikazan karton vozača sa svim relevantnim informacijama.</p>
              </div>
            }
          />
        </div>
      </Card>
    </div>
  );
};

export default DriverCard;