import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Table,
  Button,
  App,
  Select,
  Row,
  Col,
  Badge,
} from 'antd';
import {
  DatabaseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  turnusiSyncService,
  TurnusGroup,
  TurnusAssign,
  TurnusDay,
} from '../../../../../services/turnusiSync.service';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const MainServerTab: React.FC = () => {
  const { message } = App.useApp();

  // ========== TURNUS GROUPS NAMES ==========
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsData, setGroupsData] = useState<TurnusGroup[]>([]);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsLimit] = useState(50);

  // ========== TURNUS GROUPS ASSIGN ==========
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignData, setAssignData] = useState<TurnusAssign[]>([]);
  const [assignTotal, setAssignTotal] = useState(0);
  const [assignPage, setAssignPage] = useState(1);
  const [assignLimit] = useState(50);
  const [assignGroupId, setAssignGroupId] = useState<number | undefined>(
    undefined,
  );

  // ========== TURNUS DAYS ==========
  const [daysLoading, setDaysLoading] = useState(false);
  const [daysData, setDaysData] = useState<TurnusDay[]>([]);
  const [daysTotal, setDaysTotal] = useState(0);
  const [daysPage, setDaysPage] = useState(1);
  const [daysLimit] = useState(50);
  const [daysGroupId, setDaysGroupId] = useState<number | undefined>(undefined);

  // ========== FETCH DATA FUNCTIONS ==========

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      const response = await turnusiSyncService.getAllGroupsMain(
        groupsPage,
        groupsLimit,
      );
      setGroupsData(response.data);
      setGroupsTotal(response.total);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error(
        error.response?.data?.message ||
          'Greška pri učitavanju grupa turnusa',
      );
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchAssign = async () => {
    setAssignLoading(true);
    try {
      const response = await turnusiSyncService.getAllAssignMain(
        assignGroupId,
        assignPage,
        assignLimit,
      );
      setAssignData(response.data);
      setAssignTotal(response.total);
    } catch (error: any) {
      console.error('Greška pri učitavanju dodela:', error);
      message.error(
        error.response?.data?.message ||
          'Greška pri učitavanju dodela turnusa',
      );
    } finally {
      setAssignLoading(false);
    }
  };

  const fetchDays = async () => {
    setDaysLoading(true);
    try {
      const response = await turnusiSyncService.getAllDaysMain(
        daysGroupId,
        daysPage,
        daysLimit,
      );
      setDaysData(response.data);
      setDaysTotal(response.total);
    } catch (error: any) {
      console.error('Greška pri učitavanju dana:', error);
      message.error(
        error.response?.data?.message || 'Greška pri učitavanju dana turnusa',
      );
    } finally {
      setDaysLoading(false);
    }
  };

  // ========== USE EFFECTS ==========

  useEffect(() => {
    fetchGroups();
  }, [groupsPage]);

  useEffect(() => {
    fetchAssign();
  }, [assignPage, assignGroupId]);

  useEffect(() => {
    fetchDays();
  }, [daysPage, daysGroupId]);

  // ========== TABLE COLUMNS ==========

  const groupsColumns: ColumnsType<TurnusGroup> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: 'Naziv Grupe',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Badge
          status={active ? 'success' : 'error'}
          text={active ? 'Da' : 'Ne'}
        />
      ),
    },
    {
      title: 'Važeće od',
      dataIndex: 'dateValidFrom',
      key: 'dateValidFrom',
      width: 150,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
  ];

  const assignColumns: ColumnsType<TurnusAssign> = [
    {
      title: 'Turnus ID',
      dataIndex: 'turnusId',
      key: 'turnusId',
      width: 120,
      sorter: (a, b) => a.turnusId - b.turnusId,
    },
    {
      title: 'Group ID',
      dataIndex: 'groupId',
      key: 'groupId',
      width: 120,
      sorter: (a, b) => a.groupId - b.groupId,
    },
    {
      title: 'Datum Od',
      dataIndex: 'dateFrom',
      key: 'dateFrom',
      width: 150,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Datum Do',
      dataIndex: 'dateTo',
      key: 'dateTo',
      width: 150,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Changed By',
      dataIndex: 'changedBy',
      key: 'changedBy',
      width: 120,
    },
    {
      title: 'Datum Izmene',
      dataIndex: 'changeDate',
      key: 'changeDate',
      width: 180,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm:ss'),
    },
  ];

  const daysColumns: ColumnsType<TurnusDay> = [
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
      width: 120,
      sorter: (a, b) => a.turnusId - b.turnusId,
    },
    {
      title: 'Naziv Dana',
      dataIndex: 'dayname',
      key: 'dayname',
      ellipsis: true,
    },
  ];

  // ========== PAGINATION CONFIGS ==========

  const groupsPagination: TablePaginationConfig = {
    current: groupsPage,
    pageSize: groupsLimit,
    total: groupsTotal,
    onChange: (page) => setGroupsPage(page),
    showSizeChanger: false,
    showTotal: (total) => `Ukupno ${total} grupa`,
  };

  const assignPagination: TablePaginationConfig = {
    current: assignPage,
    pageSize: assignLimit,
    total: assignTotal,
    onChange: (page) => setAssignPage(page),
    showSizeChanger: false,
    showTotal: (total) => `Ukupno ${total} dodela`,
  };

  const daysPagination: TablePaginationConfig = {
    current: daysPage,
    pageSize: daysLimit,
    total: daysTotal,
    onChange: (page) => setDaysPage(page),
    showSizeChanger: false,
    showTotal: (total) => `Ukupno ${total} dana`,
  };

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

      {/* TURNUS GROUPS NAMES */}
      <Card
        className="mb-4"
        title={
          <Space>
            <Text strong>Turnus Groups Names</Text>
            <Badge count={groupsTotal} showZero style={{ backgroundColor: '#52c41a' }} />
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchGroups}
            loading={groupsLoading}
          >
            Refresh
          </Button>
        }
      >
        <Table
          columns={groupsColumns}
          dataSource={groupsData}
          loading={groupsLoading}
          pagination={groupsPagination}
          rowKey="id"
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* TURNUS GROUPS ASSIGN */}
      <Card
        className="mb-4"
        title={
          <Space>
            <Text strong>Turnus Groups Assign</Text>
            <Badge count={assignTotal} showZero style={{ backgroundColor: '#1890ff' }} />
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="Filter po Group ID"
              allowClear
              style={{ width: 180 }}
              value={assignGroupId}
              onChange={(value) => {
                setAssignGroupId(value);
                setAssignPage(1);
              }}
              loading={groupsLoading}
            >
              {groupsData.map((group) => (
                <Option key={group.id} value={group.id}>
                  {group.id} - {group.name}
                </Option>
              ))}
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAssign}
              loading={assignLoading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={assignColumns}
          dataSource={assignData}
          loading={assignLoading}
          pagination={assignPagination}
          rowKey={(record) =>
            `${record.turnusId}-${record.groupId}-${record.dateFrom}`
          }
          size="middle"
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* TURNUS DAYS */}
      <Card
        title={
          <Space>
            <Text strong>Turnus Days</Text>
            <Badge count={daysTotal} showZero style={{ backgroundColor: '#faad14' }} />
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="Filter po Group ID"
              allowClear
              style={{ width: 180 }}
              value={daysGroupId}
              onChange={(value) => {
                setDaysGroupId(value);
                setDaysPage(1);
              }}
              loading={groupsLoading}
            >
              {groupsData.map((group) => (
                <Option key={group.id} value={group.id}>
                  {group.id} - {group.name}
                </Option>
              ))}
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchDays}
              loading={daysLoading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={daysColumns}
          dataSource={daysData}
          loading={daysLoading}
          pagination={daysPagination}
          rowKey="id"
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default MainServerTab;
