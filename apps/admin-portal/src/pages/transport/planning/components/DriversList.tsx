/**
 * Komponenta za prikaz lista vozača (slobodni i zauzeti)
 * Prikazuje se kao desni deo modala sa dve kolone
 */

import React from 'react';
import { Row, Col, Card, List, Typography, Space, Badge } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { DriverWithStatus } from '../hooks/useDriverFilters';

interface DriversListProps {
  freeDrivers: DriverWithStatus[];
  busyDrivers: DriverWithStatus[];
  onSelect: (driver: DriverWithStatus) => void;
}

export const DriversList: React.FC<DriversListProps> = ({
  freeDrivers,
  busyDrivers,
  onSelect,
}) => {
  return (
    <Row gutter={16} style={{ height: '100%' }}>
      {/* Slobodni vozači */}
      <Col span={12}>
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span style={{ color: '#52c41a' }}>
                Slobodni vozači ({freeDrivers.length})
              </span>
            </Space>
          }
          style={{ height: '100%' }}
          bodyStyle={{ height: 'calc(100% - 57px)', overflowY: 'auto' }}
        >
          {freeDrivers.length === 0 ? (
            <Typography.Text type="secondary">
              Nema slobodnih vozača koji zadovoljavaju aktivne filtere.
            </Typography.Text>
          ) : (
            <List
              dataSource={freeDrivers}
              renderItem={(driver) => {
                const hasDefault = driver.turnusDefault?.hasDefault || false;
                const bgColor = hasDefault ? '#e6f7ff' : '#f6ffed';
                const borderColor = hasDefault ? '#1890ff' : '#b7eb8f';
                const hoverBgColor = hasDefault ? '#bae7ff' : '#d9f7be';

                return (
                  <List.Item
                    onClick={() => onSelect(driver)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: hasDefault ? '#e6f4ff' : '#f6ffed',
                      marginBottom: 8,
                      padding: '12px',
                      borderRadius: '4px',
                      border: hasDefault ? '2px solid #1677ff' : '1px solid #b7eb8f',
                      boxShadow: hasDefault ? '0 2px 8px rgba(22, 119, 255, 0.15)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hasDefault ? '#bae0ff' : '#d9f7be';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = hasDefault ? '#e6f4ff' : '#f6ffed';
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size={2}>
                      {/* Ime i score u jednoj liniji */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Zvezdica za vozače sa default-om */}
                        {hasDefault && (
                          <span style={{ fontSize: 18, lineHeight: 1 }}>⭐</span>
                        )}

                        <Typography.Text strong style={{ color: hasDefault ? '#1677ff' : 'inherit' }}>
                          {driver.fullName}
                        </Typography.Text>

                        {/* Score badge odmah pored imena */}
                        {hasDefault && driver.turnusDefault && (
                          <span
                            style={{
                              backgroundColor: '#1677ff',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: 11,
                              fontWeight: 600,
                              marginLeft: 4,
                            }}
                          >
                            {driver.turnusDefault.confidenceScore.toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {/* Dodatna statistika za vozače sa default-om */}
                      {hasDefault && driver.turnusDefault && (
                        <Typography.Text
                          type="secondary"
                          style={{
                            fontSize: 11,
                            paddingLeft: 26,
                            color: '#1677ff'
                          }}
                        >
                          Korišćeno {driver.turnusDefault.usageCount}x
                          {' '}({driver.turnusDefault.usagePercentage.toFixed(1)}%)
                          {driver.turnusDefault.note && ` • ${driver.turnusDefault.note}`}
                        </Typography.Text>
                      )}
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      </Col>

      {/* Zauzeti vozači */}
      <Col span={12}>
        <Card
          title={
            <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <span style={{ color: '#ff4d4f' }}>
                Zauzeti vozači ({busyDrivers.length})
              </span>
            </Space>
          }
          style={{ height: '100%' }}
          bodyStyle={{ height: 'calc(100% - 57px)', overflowY: 'auto' }}
        >
          {busyDrivers.length === 0 ? (
            <Typography.Text type="secondary">
              Svi vozači su slobodni!
            </Typography.Text>
          ) : (
            <List
              dataSource={busyDrivers}
              renderItem={(driver) => (
                <List.Item
                  style={{
                    backgroundColor: '#fff1f0',
                    marginBottom: 8,
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ffccc7',
                    cursor: 'not-allowed',
                    opacity: 0.7,
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Typography.Text disabled strong>
                      {driver.fullName}
                    </Typography.Text>

                    {driver.failedFilters && driver.failedFilters.length > 0 && (
                      <div style={{ paddingLeft: 8 }}>
                        {driver.failedFilters.map((fail, idx) => (
                          <div key={idx}>
                            <Badge
                              status="error"
                              text={
                                <Typography.Text
                                  type="danger"
                                  style={{ fontSize: 11 }}
                                >
                                  <strong>{fail.filterName}:</strong> {fail.reason}
                                </Typography.Text>
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
};
