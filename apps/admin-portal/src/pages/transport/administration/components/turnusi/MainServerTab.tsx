import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Table,
  Button,
  App,
  Select,
  Input,
  Row,
  Col,
  Badge,
} from 'antd';
import {
  DatabaseOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  turnusiService,
  ChangesCodeTourMain,
} from '../../../../../services/turnusi.service';
import {
  turnusiSyncService,
  TurnusGroup,
} from '../../../../../services/turnusiSync.service';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const MainServerTab: React.FC = () => {
  const { message } = App.useApp();

  // ========== STATE ==========
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ChangesCodeTourMain[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const [lineNumber, setLineNumber] = useState<string | undefined>(undefined);

  // Groups for filter dropdown
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groups, setGroups] = useState<TurnusGroup[]>([]);

  // ========== FETCH DATA FUNCTIONS ==========

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      const response = await turnusiSyncService.getAllGroupsMain(1, 1000);
      setGroups(response.data);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa turnusa');
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await turnusiService.getAllChangesCodesMain(
        groupId,
        lineNumber,
        page,
        limit,
      );
      setData(response.data);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Greška pri učitavanju podataka:', error);
      message.error(
        error.response?.data?.message ||
          'Greška pri učitavanju changes codes tours',
      );
    } finally {
      setLoading(false);
    }
  };

  // ========== USE EFFECTS ==========

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchData();
  }, [page, groupId, lineNumber]);

  // ========== TABLE COLUMNS ==========

  const columns: ColumnsType<ChangesCodeTourMain> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: 'Turnus ID',
      dataIndex: 'turnusId',
      key: 'turnusId',
      width: 100,
      sorter: (a, b) => a.turnusId - b.turnusId,
    },
    {
      title: 'Turnus Naziv',
      dataIndex: 'turnusName',
      key: 'turnusName',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Linija',
      dataIndex: 'lineNo',
      key: 'lineNo',
      width: 80,
    },
    {
      title: 'Početak',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 100,
      render: (time: string) => {
        try {
          return dayjs(time, 'HH:mm:ss').format('HH:mm');
        } catch {
          return time;
        }
      },
    },
    {
      title: 'Smer',
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      render: (direction: number) => (direction === 1 ? 'A' : 'B'),
    },
    {
      title: 'Trajanje',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (time: string) => {
        try {
          return dayjs(time, 'HH:mm:ss').format('HH:mm');
        } catch {
          return time;
        }
      },
    },
    {
      title: 'Central Point',
      dataIndex: 'centralPoint',
      key: 'centralPoint',
      width: 120,
    },
    {
      title: 'Change Code',
      dataIndex: 'changeCode',
      key: 'changeCode',
      width: 110,
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (active: number) => (
        <Badge
          status={active === 1 ? 'success' : 'error'}
          text={active === 1 ? 'Da' : 'Ne'}
        />
      ),
    },
    {
      title: 'Dan Broj',
      dataIndex: 'dayNumber',
      key: 'dayNumber',
      width: 90,
    },
    {
      title: 'Shift Broj',
      dataIndex: 'shiftNumber',
      key: 'shiftNumber',
      width: 100,
    },
  ];

  // ========== PAGINATION CONFIG ==========

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize: limit,
    total: total,
    onChange: (newPage) => setPage(newPage),
    showSizeChanger: false,
    showTotal: (total) => `Ukupno ${total} rekorda`,
  };

  // ========== RENDER ==========

  return (
    <div>
      {/* HEADER */}
      <Card className="mb-4">
        <Space>
          <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Glavni Server
            </Title>
            <Text type="secondary">
              Sinhronizovani podaci iz naše smartcity_dev baze
            </Text>
          </div>
        </Space>
      </Card>

      {/* CHANGES CODES TOURS TABLE */}
      <Card
        title={
          <Space>
            <Text strong>Changes Codes Tours</Text>
            <Badge count={total} showZero style={{ backgroundColor: '#1890ff' }} />
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        {/* FILTERS */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Text strong>Filter po Grupi:</Text>
            <Select
              placeholder="Odaberite grupu"
              allowClear
              style={{ width: '100%', marginTop: 8 }}
              value={groupId}
              onChange={(value) => {
                setGroupId(value);
                setPage(1);
              }}
              loading={groupsLoading}
            >
              {groups.map((group) => (
                <Option key={group.id} value={group.id}>
                  {group.id} - {group.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Text strong>Filter po Liniji:</Text>
            <Input
              placeholder="Unesite broj linije (npr. 7A)"
              allowClear
              style={{ marginTop: 8 }}
              value={lineNumber}
              onChange={(e) => {
                setLineNumber(e.target.value || undefined);
                setPage(1);
              }}
              prefix={<SearchOutlined />}
            />
          </Col>
        </Row>

        {/* TABLE */}
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={pagination}
          rowKey="id"
          size="middle"
          scroll={{ x: 1600 }}
        />
      </Card>
    </div>
  );
};

export default MainServerTab;
