import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Select,
  Switch,
  Input,
  Table,
  Button,
  Space,
  Tooltip,
  message,
  Spin,
} from 'antd';
import {
  BranchesOutlined,
  PlusOutlined,
  SearchOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  linesAdministrationService,
  LineWithVariation,
  PriceTableGroup,
  VariationStatus,
  VariationStatusType,
} from '../../../services/linesAdministration.service';
import StatusBadge from '../../../components/common/StatusBadge';
import TimetableModal from '../../../components/transport/TimetableModal';
import StationsModal from '../../../components/transport/StationsModal';
import TurnusiModal from '../../../components/transport/TurnusiModal';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;

const LinesAdministration: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<PriceTableGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>();
  const [showExpired, setShowExpired] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [lines, setLines] = useState<LineWithVariation[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [timetableModalVisible, setTimetableModalVisible] = useState(false);
  const [selectedPriceTableIdent, setSelectedPriceTableIdent] = useState<string | null>(null);
  const [selectedLineNumber, setSelectedLineNumber] = useState<string | undefined>();
  const [stationsModalVisible, setStationsModalVisible] = useState(false);
  const [stationsPriceTableIdent, setStationsPriceTableIdent] = useState<string | null>(null);
  const [stationsLineNumber, setStationsLineNumber] = useState<string | undefined>();
  const [turnusiModalVisible, setTurnusiModalVisible] = useState(false);
  const [turnusiLineNumber, setTurnusiLineNumber] = useState<string | null>(null);
  const [turnusiLineNumberForDisplay, setTurnusiLineNumberForDisplay] = useState<string | undefined>();

  // Učitaj price_table_groups na mount
  useEffect(() => {
    loadGroups();
  }, []);

  // Učitaj linije kada se promeni selectedGroup, showExpired, showOnlyActive, showInactive, searchText ili pagination
  useEffect(() => {
    if (selectedGroup) {
      loadLines();
    }
  }, [selectedGroup, showExpired, showOnlyActive, showInactive, searchText, pagination.current, pagination.pageSize]);

  const loadGroups = async () => {
    try {
      const data = await linesAdministrationService.getPriceTableGroups();
      setGroups(data);

      // Automatski selektuj prvu aktivnu grupu
      const activeGroup = data.find((g) => g.status === 'A');
      if (activeGroup) {
        setSelectedGroup(activeGroup.id);
      }
    } catch (error) {
      console.error('Greška pri učitavanju grupa:', error);
      message.error('Greška pri učitavanju grupa');
    }
  };

  const loadLines = async () => {
    if (!selectedGroup) return;

    setLoading(true);
    try {
      const response = await linesAdministrationService.getLines({
        groupId: selectedGroup,
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
        showExpired,
        showOnlyActive,
        showInactive,
      });

      setLines(response.data);
      setPagination({
        ...pagination,
        total: response.total,
      });
    } catch (error) {
      console.error('Greška pri učitavanju linija:', error);
      message.error('Greška pri učitavanju linija');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination({ ...pagination, current: 1 }); // Reset na prvu stranicu
    // loadLines će se pozvati automatski preko useEffect
  };

  const handleTableChange = (paginationConfig: TablePaginationConfig) => {
    setPagination({
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 50,
      total: pagination.total,
    });
  };

  const handleOpenTimetable = (record: LineWithVariation) => {
    if (!record.priceTableIdent) {
      message.warning('Nema dostupnih podataka o redu vožnje za ovu liniju');
      return;
    }
    setSelectedPriceTableIdent(record.priceTableIdent);
    setSelectedLineNumber(record.lineNumberForDisplay);
    setTimetableModalVisible(true);
  };

  const handleCloseTimetable = () => {
    setTimetableModalVisible(false);
    setSelectedPriceTableIdent(null);
    setSelectedLineNumber(undefined);
  };

  const handleOpenStations = (record: LineWithVariation) => {
    if (!record.priceTableIdent) {
      message.warning('Nema dostupnih podataka o stajalištima za ovu liniju');
      return;
    }
    setStationsPriceTableIdent(record.priceTableIdent);
    setStationsLineNumber(record.lineNumberForDisplay);
    setStationsModalVisible(true);
  };

  const handleCloseStations = () => {
    setStationsModalVisible(false);
    setStationsPriceTableIdent(null);
    setStationsLineNumber(undefined);
  };

  const handleOpenTurnusi = (record: LineWithVariation) => {
    setTurnusiLineNumber(record.lineNumber);
    setTurnusiLineNumberForDisplay(record.lineNumberForDisplay);
    setTurnusiModalVisible(true);
  };

  const handleCloseTurnusi = () => {
    setTurnusiModalVisible(false);
    setTurnusiLineNumber(null);
    setTurnusiLineNumberForDisplay(undefined);
  };

  const columns: ColumnsType<LineWithVariation> = [
    {
      title: 'Sistemski broj linije',
      dataIndex: 'lineNumber',
      key: 'lineNumber',
      width: 160,
      render: (text: string, record: LineWithVariation) => (
        <Space>
          {record.variationStatus === VariationStatus.BEZ_VARIJACIJE && (
            <Tooltip title="Linija nema varijaciju">
              <WarningOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
          <span className="font-semibold">{text}</span>
        </Space>
      ),
    },
    {
      title: 'Broj linije za prikaz',
      dataIndex: 'lineNumberForDisplay',
      key: 'lineNumberForDisplay',
      width: 160,
      render: (text: string) => <span className="font-semibold">{text}</span>,
    },
    {
      title: 'Naziv linije',
      dataIndex: 'lineTitle',
      key: 'lineTitle',
      ellipsis: true,
    },
    {
      title: 'Smer',
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      align: 'center',
    },
    {
      title: 'Tip',
      dataIndex: 'lineType',
      key: 'lineType',
      width: 100,
    },
    {
      title: 'Centralna tačka',
      key: 'centralPoint',
      width: 200,
      ellipsis: true,
      render: (_: any, record: LineWithVariation) => {
        if (!record.centralPointId || record.centralPointId === '0') {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <Tooltip title={`ID: ${record.centralPointId}`}>
            <span>{record.centralPointName}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Naziv varijacije',
      dataIndex: 'variationName',
      key: 'variationName',
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Period važenja',
      key: 'period',
      width: 220,
      render: (_: any, record: LineWithVariation) => {
        if (!record.datetimeFrom || !record.datetimeTo) {
          return '-';
        }
        const from = dayjs(record.datetimeFrom).format('DD.MM.YYYY HH:mm');
        const to = dayjs(record.datetimeTo).format('DD.MM.YYYY HH:mm');
        return `${from} - ${to}`;
      },
    },
    {
      title: 'Status Varijacije',
      dataIndex: 'variationStatus',
      key: 'variationStatus',
      width: 170,
      align: 'center',
      render: (status: VariationStatusType) => <StatusBadge status={status} />,
    },
    {
      title: 'Status',
      dataIndex: 'lineStatus',
      key: 'lineStatus',
      width: 80,
      align: 'center',
      render: (status: string) => (
        <span className={status === 'A' ? 'text-green-600 font-semibold' : 'text-red-600'}>
          {status === 'A' ? 'Aktivna' : 'Neaktivna'}
        </span>
      ),
    },
    {
      title: 'Administracija',
      key: 'actions',
      width: 240,
      align: 'center',
      fixed: 'right',
      render: (_: any, record: LineWithVariation) => (
        <Space>
          <Tooltip title="Red vožnje">
            <Button
              type="primary"
              size="small"
              icon={<ClockCircleOutlined />}
              onClick={() => handleOpenTimetable(record)}
            >
              RV
            </Button>
          </Tooltip>
          <Tooltip title="Stajališta">
            <Button
              type="default"
              size="small"
              icon={<EnvironmentOutlined />}
              onClick={() => handleOpenStations(record)}
            >
              ST
            </Button>
          </Tooltip>
          <Tooltip title="Turnusi">
            <Button
              type="default"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => handleOpenTurnusi(record)}
            >
              TU
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Custom row className za linije bez varijacija
  const getRowClassName = (record: LineWithVariation) => {
    if (record.variationStatus === VariationStatus.BEZ_VARIJACIJE) {
      return 'bg-gray-50';
    }
    return '';
  };

  return (
    <div className="p-6">
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BranchesOutlined className="text-2xl text-blue-500" />
            <Title level={2} className="mb-0">
              Linije Administracija
            </Title>
          </div>

          <Space>
            <Tooltip title="Uskoro dostupno">
              <Button type="primary" icon={<PlusOutlined />} disabled>
                Dodaj liniju
              </Button>
            </Tooltip>
            <Tooltip title="Uskoro dostupno">
              <Button icon={<PlusOutlined />} disabled>
                Dodaj varijaciju
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* Filters */}
        <div className="mb-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grupa cenovnika
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="Izaberite grupu"
                value={selectedGroup}
                onChange={setSelectedGroup}
                loading={groups.length === 0}
              >
                {groups.map((group) => (
                  <Select.Option key={group.id} value={group.id}>
                    {group.name} {group.status === 'A' ? '(Aktivan)' : ''}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pretraga
              </label>
              <Search
                placeholder="Pretraži po broju za prikaz ili nazivu linije"
                allowClear
                enterButton={<SearchOutlined />}
                onSearch={handleSearch}
                disabled={!selectedGroup}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onChange={setShowInactive}
                disabled={!selectedGroup}
              />
              <span className="text-sm text-gray-600 font-medium">
                Prikaži neaktivne linije
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={showOnlyActive}
                onChange={(checked) => {
                  setShowOnlyActive(checked);
                  if (checked) setShowExpired(false); // Isključi showExpired ako se uključi showOnlyActive
                }}
                disabled={!selectedGroup}
              />
              <span className="text-sm text-gray-600 font-medium">
                Prikaži samo aktivne varijacije
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={showExpired}
                onChange={setShowExpired}
                disabled={!selectedGroup || showOnlyActive} // Disabled ako je showOnlyActive
              />
              <span className="text-sm text-gray-600">
                Prikaži istekle varijacije
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={lines}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} od ${total} linija`,
              pageSizeOptions: ['25', '50', '100'],
            }}
            onChange={handleTableChange}
            rowClassName={getRowClassName}
            locale={{
              emptyText: selectedGroup
                ? 'Nema linija'
                : 'Izaberite grupu cenovnika',
            }}
          />
        </Spin>

        {/* Timetable Modal */}
        <TimetableModal
          visible={timetableModalVisible}
          onClose={handleCloseTimetable}
          priceTableIdent={selectedPriceTableIdent}
          lineNumberForDisplay={selectedLineNumber}
        />

        {/* Stations Modal */}
        <StationsModal
          visible={stationsModalVisible}
          onClose={handleCloseStations}
          priceTableIdent={stationsPriceTableIdent}
          lineNumberForDisplay={stationsLineNumber}
        />

        {/* Turnusi Modal */}
        <TurnusiModal
          visible={turnusiModalVisible}
          onClose={handleCloseTurnusi}
          lineNumber={turnusiLineNumber}
          lineNumberForDisplay={turnusiLineNumberForDisplay}
        />
      </Card>
    </div>
  );
};

export default LinesAdministration;
