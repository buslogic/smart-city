import React from 'react';
import { Card, Typography, Space } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  return (
    <Card>
      <Space>
        <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Glavni server</Title>
          <Text type="secondary">Turnusi sinhronizacija - Glavni server</Text>
        </div>
      </Space>
      <div className="mt-4">
        <Text type="secondary">
          Funkcionalnost za glavni server će biti implementirana u sledećoj fazi...
        </Text>
      </div>
    </Card>
  );
};

export default MainServerTab;
