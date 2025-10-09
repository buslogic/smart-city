import React from 'react';
import { Card, Typography, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const CityServerTab: React.FC = () => {
  return (
    <Card>
      <Space>
        <GlobalOutlined style={{ fontSize: 24, color: '#52c41a' }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Gradski server</Title>
          <Text type="secondary">RedVoznje sinhronizacija - Gradski server (READ-ONLY)</Text>
        </div>
      </Space>
      <div className="mt-4">
        <Text type="secondary">Funkcionalnost za gradski server će biti implementirana...</Text>
      </div>
    </Card>
  );
};

export default CityServerTab;
