import React from 'react';
import { Card, Typography, Space } from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const TicketingServerTab: React.FC = () => {
  return (
    <Card>
      <Space>
        <ShoppingOutlined style={{ fontSize: 24, color: '#52c41a' }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>Tiketing Server</Title>
          <Text type="secondary">Turnusi sinhronizacija - Tiketing Server (Legacy)</Text>
        </div>
      </Space>
      <div className="mt-4">
        <Text type="secondary">
          Funkcionalnost za tiketing server će biti implementirana u sledećoj fazi...
        </Text>
      </div>
    </Card>
  );
};

export default TicketingServerTab;
