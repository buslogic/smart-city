import React, { useState, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Table,
  Button,
  Space,
  Tag,
  Statistic,
  Spin,
  message,
} from 'antd';
import {
  FilePdfOutlined,
  CarOutlined,
  CalendarOutlined,
  DownloadOutlined,
  PrinterOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { vehiclesService } from '../../../services/vehicles.service';
import { drivingBehaviorService } from '../../../services/driving-behavior.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface VehicleReportData {
  vehicleId: number;
  garageNumber: string;
  severeAccelerations: number;
  moderateAccelerations: number;
  normalAccelerations: number;
  severeBrakings: number;
  moderateBrakings: number;
  normalBrakings: number;
  noEvents: number; // Vožnja bez prekoračenja
  safetyScore: number;
  totalDistanceKm: number;
  totalEvents: number;
  eventsPer100Km: number;
  // Percentages
  normalDrivingPercent?: number;
  aggressiveAccelPercent?: number;
  aggressiveBrakePercent?: number;
}

const MonthlyReport: React.FC = () => {
  // State
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [reportData, setReportData] = useState<VehicleReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch all vehicles
  const { data: vehiclesResponse, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles-report'],
    queryFn: () => vehiclesService.getAll(1, 2000),
  });
  
  const vehiclesData = vehiclesResponse?.data;

  // Handle vehicle selection with "Select All" support
  const handleVehicleChange = (values: any[]) => {
    if (values.includes('all')) {
      // Select all vehicles - use ID not legacyId
      const allVehicleIds = vehiclesData?.map(v => v.id) || [];
      setSelectedVehicles(allVehicleIds);
    } else {
      setSelectedVehicles(values);
    }
  };

  // Generate report
  const generateReport = async () => {
    if (selectedVehicles.length === 0) {
      message.warning('Molimo odaberite bar jedno vozilo');
      return;
    }

    setLoading(true);
    const reportDataArray: VehicleReportData[] = [];

    try {
      // Fetch statistics for each selected vehicle
      for (const vehicleId of selectedVehicles) {
        const vehicle = vehiclesData?.find(v => v.id === vehicleId);
        if (!vehicle) continue;

        // Use ID for API call (not legacyId) because TimescaleDB uses the same ID
        const apiVehicleId = vehicle.id;
        console.log(`Fetching stats for vehicle ${vehicle.garageNumber} (ID: ${apiVehicleId}) from ${dateRange[0].format('YYYY-MM-DD')} to ${dateRange[1].format('YYYY-MM-DD')}`);
        
        const stats = await drivingBehaviorService.getVehicleStatistics(
          apiVehicleId,
          dateRange[0].format('YYYY-MM-DD'),
          dateRange[1].format('YYYY-MM-DD')
        );
        
        console.log(`Stats received for ${vehicle.garageNumber}:`, stats);

        // Skip if no data (no distance traveled)
        if (!stats.totalDistanceKm || stats.totalDistanceKm === 0) {
          console.log(`No data for ${vehicle.garageNumber} - skipping`);
          // Still add to report but with zero values
          reportDataArray.push({
            vehicleId: apiVehicleId,
            garageNumber: vehicle.garageNumber,
            severeAccelerations: 0,
            moderateAccelerations: 0,
            normalAccelerations: 0,
            severeBrakings: 0,
            moderateBrakings: 0,
            normalBrakings: 0,
            noEvents: 0,
            safetyScore: 100, // No events = perfect score
            totalDistanceKm: 0,
            totalEvents: 0,
            eventsPer100Km: 0,
            normalDrivingPercent: 100,
            aggressiveAccelPercent: 0,
            aggressiveBrakePercent: 0,
          });
          continue;
        }

        // Estimate total number of acceleration/braking events based on distance
        // Assuming average of 30 acceleration/braking events per km in city driving
        const estimatedTotalEvents = Math.floor(stats.totalDistanceKm * 30);
        
        // Calculate aggressive events
        const aggressiveAccel = stats.severeAccelerations + stats.moderateAccelerations;
        const aggressiveBrake = stats.severeBrakings + stats.moderateBrakings;
        const totalAggressive = aggressiveAccel + aggressiveBrake;
        
        // Calculate normal driving events (all the rest)
        const normalDrivingEvents = Math.max(0, estimatedTotalEvents - totalAggressive);
        
        // Calculate percentages
        const normalDrivingPercent = estimatedTotalEvents > 0 
          ? (normalDrivingEvents / estimatedTotalEvents * 100) 
          : 100;
        const aggressiveAccelPercent = estimatedTotalEvents > 0 
          ? (aggressiveAccel / estimatedTotalEvents * 100) 
          : 0;
        const aggressiveBrakePercent = estimatedTotalEvents > 0 
          ? (aggressiveBrake / estimatedTotalEvents * 100) 
          : 0;

        reportDataArray.push({
          vehicleId: apiVehicleId,
          garageNumber: vehicle.garageNumber,
          severeAccelerations: stats.severeAccelerations || 0,
          moderateAccelerations: stats.moderateAccelerations || 0,
          normalAccelerations: normalDrivingEvents, // Use calculated normal events
          severeBrakings: stats.severeBrakings || 0,
          moderateBrakings: stats.moderateBrakings || 0,
          normalBrakings: normalDrivingEvents, // Use calculated normal events
          noEvents: normalDrivingEvents, // This is the normal driving count
          safetyScore: stats.safetyScore || 0,
          totalDistanceKm: stats.totalDistanceKm || 0,
          totalEvents: stats.totalEvents || 0,
          eventsPer100Km: stats.eventsPer100Km || 0,
          normalDrivingPercent: parseFloat(normalDrivingPercent.toFixed(1)),
          aggressiveAccelPercent: parseFloat(aggressiveAccelPercent.toFixed(1)),
          aggressiveBrakePercent: parseFloat(aggressiveBrakePercent.toFixed(1)),
        });
      }

      setReportData(reportDataArray);
      message.success(`Izveštaj generisan za ${reportDataArray.length} vozila`);
    } catch (error) {
      message.error('Greška pri generisanju izveštaja');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    if (reportData.length === 0) {
      message.warning('Prvo generiši izveštaj');
      return;
    }

    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    // Add title
    pdf.setFontSize(20);
    pdf.text('Mesečni izveštaj - Bezbednost vožnje', pdf.internal.pageSize.width / 2, 15, { align: 'center' });
    
    // Add date range
    pdf.setFontSize(12);
    pdf.text(
      `Period: ${dateRange[0].format('DD.MM.YYYY')} - ${dateRange[1].format('DD.MM.YYYY')}`,
      pdf.internal.pageSize.width / 2,
      25,
      { align: 'center' }
    );

    // Prepare table data
    const tableData = reportData.map(vehicle => [
      vehicle.garageNumber,
      vehicle.severeBrakings.toString(),
      vehicle.moderateBrakings.toString(),
      vehicle.normalBrakings.toString(),
      vehicle.noEvents.toString(),
      vehicle.normalAccelerations.toString(),
      vehicle.moderateAccelerations.toString(),
      vehicle.severeAccelerations.toString(),
      vehicle.safetyScore.toString(),
      `${vehicle.totalDistanceKm.toFixed(2)} km`,
      vehicle.eventsPer100Km.toFixed(1),
      `${vehicle.normalDrivingPercent?.toFixed(1) || '0.0'}%`,
      `${vehicle.aggressiveAccelPercent?.toFixed(1) || '0.0'}%`,
      `${vehicle.aggressiveBrakePercent?.toFixed(1) || '0.0'}%`,
    ]);

    // Add table
    autoTable(pdf, {
      head: [[
        'Vozilo',
        'Ozbiljno\nkočenje',
        'Umereno\nkočenje',
        'Normalno\nkočenje',
        'Bez\nprekoračenja',
        'Normalno\nubrzanje',
        'Umereno\nubrzanje',
        'Ozbiljno\nubrzanje',
        'Safety\nScore',
        'Kilometraža',
        'Događaji\n/100km',
        'Normalno\n%',
        'Agr.Ubrzanje\n%',
        'Agr.Kočenje\n%',
      ]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 25 }, // Vozilo
        1: { cellWidth: 20, halign: 'center' }, // Ozbiljno kočenje
        2: { cellWidth: 20, halign: 'center' }, // Umereno kočenje
        3: { cellWidth: 20, halign: 'center' }, // Normalno kočenje
        4: { cellWidth: 25, halign: 'center' }, // Bez prekoračenja
        5: { cellWidth: 20, halign: 'center' }, // Normalno ubrzanje
        6: { cellWidth: 20, halign: 'center' }, // Umereno ubrzanje
        7: { cellWidth: 20, halign: 'center' }, // Ozbiljno ubrzanje
        8: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Safety Score
        9: { cellWidth: 25, halign: 'right' }, // Kilometraža
        10: { cellWidth: 20, halign: 'center' }, // Događaji/100km
      },
    });

    // Add summary statistics
    const avgScore = reportData.reduce((sum, v) => sum + v.safetyScore, 0) / reportData.length;
    const totalKm = reportData.reduce((sum, v) => sum + v.totalDistanceKm, 0);
    const totalEvents = reportData.reduce((sum, v) => sum + v.totalEvents, 0);

    const finalY = (pdf as any).lastAutoTable?.finalY || 35;
    pdf.setFontSize(10);
    pdf.text(`Prosečan Safety Score: ${avgScore.toFixed(1)}`, 14, finalY + 10);
    pdf.text(`Ukupna kilometraža: ${totalKm.toFixed(2)} km`, 14, finalY + 15);
    pdf.text(`Ukupan broj događaja: ${totalEvents}`, 14, finalY + 20);

    // Save PDF
    pdf.save(`izvestaj-bezbednost-${dateRange[0].format('YYYY-MM')}.pdf`);
    message.success('PDF izveštaj je uspešno kreiran');
  };

  // Helper function to render value with percentage
  const renderWithPercentage = (value: number, total: number, color: string) => {
    const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0.0';
    if (value === 0) {
      return <Tag color="default">0</Tag>;
    }
    return (
      <Tag color={color}>
        {value} ({percentage}%)
      </Tag>
    );
  };

  // Table columns
  const columns = [
    {
      title: 'Vozilo',
      dataIndex: 'garageNumber',
      key: 'garageNumber',
      fixed: 'left' as const,
      width: 100,
      render: (text: string) => (
        <Space>
          <CarOutlined />
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'Agresivno kočenje',
      children: [
        {
          title: 'Ozbiljno',
          key: 'severeBrakings',
          width: 110,
          align: 'center' as const,
          render: (_: any, record: VehicleReportData) => {
            const total = Math.floor(record.totalDistanceKm * 30); // estimated total events
            return renderWithPercentage(record.severeBrakings, total, 'red');
          },
        },
        {
          title: 'Umereno',
          key: 'moderateBrakings',
          width: 110,
          align: 'center' as const,
          render: (_: any, record: VehicleReportData) => {
            const total = Math.floor(record.totalDistanceKm * 30);
            return renderWithPercentage(record.moderateBrakings, total, 'orange');
          },
        },
      ],
    },
    {
      title: 'Normalna vožnja',
      key: 'normalDriving',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: VehicleReportData) => {
        const total = Math.floor(record.totalDistanceKm * 30);
        const normalEvents = Math.max(0, total - record.severeBrakings - record.moderateBrakings - record.severeAccelerations - record.moderateAccelerations);
        const percentage = total > 0 ? (normalEvents / total * 100).toFixed(1) : '100.0';
        return normalEvents > 0 ? (
          <Tag color="green" style={{ fontWeight: 'bold' }}>
            {normalEvents} ({percentage}%)
          </Tag>
        ) : (
          <Tag color="default">0</Tag>
        );
      },
    },
    {
      title: 'Agresivno ubrzanje',
      children: [
        {
          title: 'Umereno',
          key: 'moderateAccelerations',
          width: 110,
          align: 'center' as const,
          render: (_: any, record: VehicleReportData) => {
            const total = Math.floor(record.totalDistanceKm * 30);
            return renderWithPercentage(record.moderateAccelerations, total, 'orange');
          },
        },
        {
          title: 'Ozbiljno',
          key: 'severeAccelerations',
          width: 110,
          align: 'center' as const,
          render: (_: any, record: VehicleReportData) => {
            const total = Math.floor(record.totalDistanceKm * 30);
            return renderWithPercentage(record.severeAccelerations, total, 'red');
          },
        },
      ],
    },
    {
      title: 'Safety Score',
      dataIndex: 'safetyScore',
      key: 'safetyScore',
      width: 100,
      align: 'center' as const,
      render: (score: number) => {
        let color = '#52c41a'; // green
        if (score < 60) color = '#ff4d4f'; // red
        else if (score < 80) color = '#faad14'; // orange
        
        return (
          <Tag color={color} style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {score}/100
          </Tag>
        );
      },
    },
    {
      title: 'Kilometraža',
      dataIndex: 'totalDistanceKm',
      key: 'totalDistanceKm',
      width: 100,
      align: 'right' as const,
      render: (val: number) => `${val.toFixed(2)} km`,
    },
    {
      title: 'Događaji/100km',
      dataIndex: 'eventsPer100Km',
      key: 'eventsPer100Km',
      width: 100,
      align: 'center' as const,
      render: (val: number) => val.toFixed(1),
    },
  ];

  // Calculate summary statistics
  const avgScore = reportData.length > 0
    ? reportData.reduce((sum, v) => sum + v.safetyScore, 0) / reportData.length
    : 0;
  const totalKm = reportData.reduce((sum, v) => sum + v.totalDistanceKm, 0);
  const totalEvents = reportData.reduce((sum, v) => sum + v.totalEvents, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          <FilePdfOutlined className="mr-2" />
          Mesečni izveštaj - Bezbednost vožnje
        </h1>
        <p className="text-gray-600">
          Generišite mesečni izveštaj sa statistikama agresivne vožnje za odabrana vozila
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Row gutter={16} align="middle">
          <Col span={8}>
            <label className="block text-sm font-medium mb-2">Vozila</label>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Odaberite vozila"
              value={selectedVehicles}
              onChange={handleVehicleChange}
              loading={vehiclesLoading}
              showSearch
              optionFilterProp="children"
              maxTagCount={3}
            >
              <Option key="all" value="all">
                <strong>Sva vozila</strong>
              </Option>
              {vehiclesData?.map(vehicle => (
                <Option key={vehicle.id} value={vehicle.id}>
                  <CarOutlined /> {vehicle.garageNumber}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <label className="block text-sm font-medium mb-2">Period</label>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
              format="DD.MM.YYYY"
              allowClear={false}
              presets={[
                { label: 'Ovaj mesec', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                { label: 'Prošli mesec', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                { label: 'Poslednjih 30 dana', value: [dayjs().subtract(30, 'days'), dayjs()] },
              ]}
            />
          </Col>
          <Col span={8}>
            <label className="block text-sm font-medium mb-2">&nbsp;</label>
            <Space>
              <Button
                type="primary"
                icon={<CalendarOutlined />}
                onClick={generateReport}
                loading={loading}
              >
                Generiši izveštaj
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={exportToPDF}
                disabled={reportData.length === 0}
              >
                Export PDF
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary Statistics */}
      {reportData.length > 0 && (
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card>
              <Statistic
                title="Broj vozila"
                value={reportData.length}
                prefix={<CarOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Prosečan Safety Score"
                value={avgScore}
                precision={1}
                suffix="/ 100"
                prefix={<SafetyOutlined />}
                valueStyle={{ 
                  color: avgScore >= 80 ? '#52c41a' : avgScore >= 60 ? '#faad14' : '#ff4d4f' 
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Ukupna kilometraža"
                value={totalKm}
                precision={2}
                suffix="km"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Ukupno događaja"
                value={totalEvents}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Report Table */}
      <Card 
        title="Tabela izveštaja"
        ref={reportRef}
        extra={
          <Space>
            {reportData.length > 0 && (
              <Tag color="blue">
                {reportData.length} vozila
              </Tag>
            )}
          </Space>
        }
      >
        {loading ? (
          <div className="text-center py-8">
            <Spin size="large" tip="Generisanje izveštaja..." />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={reportData}
            rowKey="vehicleId"
            pagination={false}
            scroll={{ x: 1200 }}
            bordered
            summary={() => reportData.length > 0 && (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>UKUPNO</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    {(() => {
                      const total = reportData.reduce((sum, v) => sum + v.severeBrakings, 0);
                      const grandTotal = Math.floor(totalKm * 30);
                      const percentage = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0.0';
                      return total > 0 ? <Tag color="red">{total} ({percentage}%)</Tag> : <Tag color="default">0</Tag>;
                    })()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center">
                    {(() => {
                      const total = reportData.reduce((sum, v) => sum + v.moderateBrakings, 0);
                      const grandTotal = Math.floor(totalKm * 30);
                      const percentage = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0.0';
                      return total > 0 ? <Tag color="orange">{total} ({percentage}%)</Tag> : <Tag color="default">0</Tag>;
                    })()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="center">
                    {(() => {
                      const grandTotal = Math.floor(totalKm * 30);
                      const totalAggressive = reportData.reduce((sum, v) => 
                        sum + v.severeBrakings + v.moderateBrakings + v.severeAccelerations + v.moderateAccelerations, 0);
                      const normalEvents = Math.max(0, grandTotal - totalAggressive);
                      const percentage = grandTotal > 0 ? (normalEvents / grandTotal * 100).toFixed(1) : '100.0';
                      return normalEvents > 0 ? (
                        <Tag color="green" style={{ fontWeight: 'bold' }}>
                          {normalEvents} ({percentage}%)
                        </Tag>
                      ) : (
                        <Tag color="default">0</Tag>
                      );
                    })()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="center">
                    {(() => {
                      const total = reportData.reduce((sum, v) => sum + v.moderateAccelerations, 0);
                      const grandTotal = Math.floor(totalKm * 30);
                      const percentage = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0.0';
                      return total > 0 ? <Tag color="orange">{total} ({percentage}%)</Tag> : <Tag color="default">0</Tag>;
                    })()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="center">
                    {(() => {
                      const total = reportData.reduce((sum, v) => sum + v.severeAccelerations, 0);
                      const grandTotal = Math.floor(totalKm * 30);
                      const percentage = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0.0';
                      return total > 0 ? <Tag color="red">{total} ({percentage}%)</Tag> : <Tag color="default">0</Tag>;
                    })()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="center">
                    <Tag color="blue" style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      {avgScore.toFixed(1)}/100
                    </Tag>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <strong>{totalKm.toFixed(2)} km</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="center">
                    {totalKm > 0 ? (totalEvents / (totalKm / 100)).toFixed(1) : '0.0'}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default MonthlyReport;