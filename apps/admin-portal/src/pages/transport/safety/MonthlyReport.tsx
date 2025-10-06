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
  Modal,
  Form,
  InputNumber,
  Divider,
  Tooltip,
  Switch,
  Progress,
} from 'antd';
import {
  FilePdfOutlined,
  CarOutlined,
  CalendarOutlined,
  DownloadOutlined,
  PrinterOutlined,
  SafetyOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  DashboardOutlined,
  TableOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { vehiclesService } from '../../../services/vehicles.service';
import { drivingBehaviorService } from '../../../services/driving-behavior.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { exportExecutivePDFWithUnicode, exportDetailedPDFWithUnicode } from './MonthlyReportPdfMake';

const { Option } = Select;
const { RangePicker } = DatePicker;

// Helper function to format large numbers
const formatLargeNumber = (num: number): string => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Executive Summary View Component Props
interface ExecutiveSummaryViewProps {
  reportData: VehicleReportData[];
  loading: boolean;
  avgScore: number;
  totalKm: number;
  totalEvents: number;
}

// Executive Summary View Component
const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({
  reportData,
  loading,
  avgScore,
  totalKm,
  totalEvents
}) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <Spin size="large" tip="Generisanje izvršnog pregleda..." />
      </div>
    );
  }

  if (reportData.length === 0) {
    return null;
  }

  // Calculate metrics for executive summary LOCALLY (not from props)
  const totalVehicles = reportData.length;
  const excellentVehicles = reportData.filter(v => v.safetyScore >= 80).length;
  const goodVehicles = reportData.filter(v => v.safetyScore >= 60 && v.safetyScore < 80).length;
  const riskVehicles = reportData.filter(v => v.safetyScore < 60).length;
  
  // Calculate locally from reportData
  const localTotalKm = reportData.reduce((sum, v) => sum + v.totalDistanceKm, 0);
  const localAvgScore = totalVehicles > 0 
    ? reportData.reduce((sum, v) => sum + v.safetyScore, 0) / totalVehicles 
    : 0;
  const localTotalEvents = reportData.reduce((sum, v) => {
    const severeAccel = Number(v.severeAccelerations) || 0;
    const severeBraking = Number(v.severeBrakings) || 0;
    const aggressive = severeAccel + severeBraking;
    return sum + aggressive;
  }, 0);
  
  // Calculate moderate events
  const localModerateEvents = reportData.reduce((sum, v) => {
    const moderateAccel = Number(v.moderateAccelerations) || 0;
    const moderateBraking = Number(v.moderateBrakings) || 0;
    return sum + moderateAccel + moderateBraking;
  }, 0);
  
  const avgEventsPerVehicle = totalVehicles > 0 ? localTotalEvents / totalVehicles : 0;
  const avgKmPerVehicle = totalVehicles > 0 ? localTotalKm / totalVehicles : 0;

  return (
    <div className="executive-summary">
      {/* Key Performance Indicators */}
      <Card title="Ključni indikatori performansi" className="mb-4">
        <Row gutter={16}>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{totalVehicles}</div>
              <div className="text-sm text-gray-500">Ukupno vozila</div>
            </div>
          </Col>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: localAvgScore >= 80 ? '#52c41a' : localAvgScore >= 60 ? '#faad14' : '#ff4d4f' }}>
                {localAvgScore.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Prosečan Safety Score</div>
            </div>
          </Col>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{formatLargeNumber(localTotalKm)}</div>
              <div className="text-sm text-gray-500">Ukupna kilometraža (km)</div>
            </div>
          </Col>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{formatLargeNumber(localModerateEvents)}</div>
              <div className="text-sm text-gray-500">Umereni događaji</div>
            </div>
          </Col>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{formatLargeNumber(localTotalEvents)}</div>
              <div className="text-sm text-gray-500">Agresivni događaji</div>
            </div>
          </Col>
          <Col span={4}>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{formatLargeNumber(localModerateEvents + localTotalEvents)}</div>
              <div className="text-sm text-gray-500">Ukupno prekršaja</div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Performance Distribution */}
      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card title="Distribucija Safety Score">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                  Odličan (80-100)
                </span>
                <span className="font-semibold">
                  {excellentVehicles} ({((excellentVehicles / totalVehicles) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
                  Dobar (60-79)
                </span>
                <span className="font-semibold">
                  {goodVehicles} ({((goodVehicles / totalVehicles) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                  Rizičan (&lt;60)
                </span>
                <span className="font-semibold">
                  {riskVehicles} ({((riskVehicles / totalVehicles) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Analiza umerenih performansi">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Prosečno umerenih po vozilu:</span>
                <span className="font-semibold">{totalVehicles > 0 ? (localModerateEvents / totalVehicles).toFixed(1) : '0.0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Prosečna kilometraža po vozilu:</span>
                <span className="font-semibold">{avgKmPerVehicle.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between">
                <span>Umereni na 100km:</span>
                <span className="font-semibold">{localTotalKm > 0 ? (localModerateEvents / (localTotalKm / 100)).toFixed(1) : '0.0'}</span>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Analiza agresivnih performansi">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Prosečno agresivnih po vozilu:</span>
                <span className="font-semibold">{avgEventsPerVehicle.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span>Prosečna kilometraža po vozilu:</span>
                <span className="font-semibold">{avgKmPerVehicle.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between">
                <span>Agresivni na 100km:</span>
                <span className="font-semibold">{localTotalKm > 0 ? (localTotalEvents / (localTotalKm / 100)).toFixed(1) : '0.0'}</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Key Insights */}
      <Card title="Ključni uvidi i preporuke" className="mb-4">
        <Row gutter={16}>
          <Col span={8}>
            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <h4 className="font-semibold text-green-800 mb-2">🏆 Odličnost</h4>
              <p className="text-sm text-green-700">
                {((excellentVehicles / totalVehicles) * 100).toFixed(0)}% vozila postiže odličan Safety Score (&gt;80)
              </p>
            </div>
          </Col>
          <Col span={8}>
            <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
              <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Upozorenje</h4>
              <p className="text-sm text-yellow-700">
                {riskVehicles} vozila zahteva dodatnu obuku zbog niskog Safety Score-a
              </p>
            </div>
          </Col>
          <Col span={8}>
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-800 mb-2">📈 Fokus</h4>
              <p className="text-sm text-blue-700">
                Prosek od {avgEventsPerVehicle.toFixed(1)} agresivnih događaja po vozilu
              </p>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

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
  // Ant Design hooks
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [reportData, setReportData] = useState<VehicleReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressState, setProgressState] = useState<{ current: number; total: number } | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configForm] = Form.useForm();
  const [savingConfig, setSavingConfig] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExecutiveView, setIsExecutiveView] = useState(false); // Toggle između detaljnog i izvršnog prikaza
  const [calculationMethod, setCalculationMethod] = useState<'views' | 'direct'>('views'); // Metoda računanja kilometraže

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

  // Generate report - OPTIMIZED WITH BATCH API
  const generateReport = async () => {
    if (selectedVehicles.length === 0) {
      messageApi.warning('Molimo odaberite bar jedno vozilo');
      return;
    }

    setLoading(true);
    const reportDataArray: VehicleReportData[] = [];

    try {
      // CHUNK-BASED: Split into smaller batches to avoid timeout
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const CHUNK_SIZE = 50; // Process 50 vehicles at a time
      const chunks: number[][] = [];

      // Split vehicles into chunks
      for (let i = 0; i < selectedVehicles.length; i += CHUNK_SIZE) {
        chunks.push(selectedVehicles.slice(i, i + CHUNK_SIZE));
      }

      console.log(`Fetching batch statistics for ${selectedVehicles.length} vehicles in ${chunks.length} chunks of ${CHUNK_SIZE}...`);
      const startTime = performance.now();

      // Fetch statistics for each chunk sequentially
      const allStats: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Update progress
        setProgressState({ current: i + 1, total: chunks.length });

        console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} vehicles)...`);

        const chunkStats = await drivingBehaviorService.getBatchStatistics(
          chunk,
          startDate,
          endDate,
          calculationMethod === 'direct', // Koristi direktno računanje ako je odabrano
          'no_postgis' // Uvek koristimo NO-PostGIS aggregate (PostGIS je uklonjen)
        );

        allStats.push(...chunkStats);
        console.log(`Chunk ${i + 1}/${chunks.length} completed: ${chunkStats.length} vehicles`);
      }

      const endTime = performance.now();
      console.log(`All batch statistics fetched in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
      console.log(`Backend returned statistics for ${allStats.length} vehicles total`);

      // Process batch results
      for (const stats of allStats) {
        const vehicle = vehiclesData?.find(v => v.id === stats.vehicleId);
        if (!vehicle) continue;

        // Skip if no data (no distance traveled)
        if (!stats.totalDistanceKm || stats.totalDistanceKm === 0) {
          // Still add to report but with zero values
          reportDataArray.push({
            vehicleId: stats.vehicleId,
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

        // More realistic estimate: ~3 acceleration/braking events per km in city driving
        const estimatedTotalEvents = Math.floor(stats.totalDistanceKm * 3);
        
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
          vehicleId: stats.vehicleId,
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

      console.log(`Frontend processed ${reportDataArray.length} vehicles for table:`, reportDataArray.map(r => `${r.vehicleId}(${r.garageNumber})`).join(', '));
      setReportData(reportDataArray);
      messageApi.success(`Izveštaj generisan za ${reportDataArray.length} vozila`);
    } catch (error) {
      messageApi.error('Greška pri generisanju izveštaja');
      console.error(error);
    } finally {
      setLoading(false);
      setProgressState(null); // Reset progress
    }
  };

  // Export to PDF - supports both Executive and Detailed views
  const exportToPDF = async () => {
    if (reportData.length === 0) {
      messageApi.warning('Prvo generiši izveštaj');
      return;
    }

    if (isExecutiveView) {
      // Generate Executive Summary PDF with Unicode support
      exportExecutivePDF();
      messageApi.success('Izvršni PDF izveštaj je uspešno kreiran');
    } else {
      // Generate Detailed Table PDF
      exportDetailedPDF();
    }
  };

  // Helper function - no longer needed with pdfMake as it supports Unicode
  const serbianToPdfText = (text: string): string => {
    return text; // pdfMake podržava Unicode, ne treba konverzija!
  };

  // Executive Summary PDF Export je premešten u MonthlyReportPdfMake.tsx
  // jer podržava Unicode karaktere kroz pdfMake biblioteku

  // Ova funkcija više nije potrebna - koristi se exportExecutivePDFWithUnicode
  // Stara exportExecutivePDF funkcija je uklonjena
  // Koristi se nova verzija iz MonthlyReportPdfMake.tsx

  /* Stari kod uklonjen - sada koristi pdfMake */

  // Nova funkcija koja poziva pdfMake verziju i prosleđuje konfiguraciju
  const exportExecutivePDF = async () => {
    try {
      // Učitaj trenutnu konfiguraciju sa backend-a
      const safetyConfig = await drivingBehaviorService.getSafetyScoreConfig();

      // Pozovi PDF export sa konfiguracijom
      exportExecutivePDFWithUnicode(reportData, dateRange, safetyConfig);
    } catch (error) {
      console.error('Error loading safety config for PDF:', error);
      // Ako ne uspe učitavanje konfiguracije, koristi default vrednosti
      const defaultConfig = {
        severeAccel: { threshold: 2, distance: 100, penalty: 15 },
        moderateAccel: { threshold: 10, distance: 100, penalty: 5 },
        severeBrake: { threshold: 2, distance: 100, penalty: 15 },
        moderateBrake: { threshold: 10, distance: 100, penalty: 5 }
      };
      exportExecutivePDFWithUnicode(reportData, dateRange, defaultConfig);
    }
  };

  // Detailed Table PDF Export - koristi pdfMake za Unicode podršku
  const exportDetailedPDF = () => {
    exportDetailedPDFWithUnicode(reportData, dateRange);
    return; // Prekidamo izvršavanje stare implementacije
    
    // Stari kod sa jsPDF (zadržan kao komentar):
    /*
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    // Add title
    pdf.setFontSize(20);
    pdf.text(serbianToPdfText('Mesečni izveštaj - Bezbednost vožnje'), pdf.internal.pageSize.width / 2, 15, { align: 'center' });
    
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
        serbianToPdfText('Ozbiljno\nkočenje'),
        serbianToPdfText('Umereno\nkočenje'),
        serbianToPdfText('Normalno\nkočenje'),
        serbianToPdfText('Bez\nprekoračenja'),
        'Normalno\nubrzanje',
        'Umereno\nubrzanje',
        'Ozbiljno\nubrzanje',
        'Safety\nScore',
        serbianToPdfText('Kilometraža'),
        serbianToPdfText('Događaji\n/100km'),
        'Normalno\n%',
        'Agr.Ubrzanje\n%',
        serbianToPdfText('Agr.Kočenje\n%'),
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
    const totalEvents = reportData.reduce((sum, v) => 
      sum + (Number(v.severeAccelerations) || 0) + (Number(v.severeBrakings) || 0), 0);

    const finalY = (pdf as any).lastAutoTable?.finalY || 35;
    pdf.setFontSize(10);
    pdf.text(serbianToPdfText(`Prosečan Safety Score: ${avgScore.toFixed(1)}`), 14, finalY + 10);
    pdf.text(serbianToPdfText(`Ukupna kilometraža: ${totalKm.toFixed(2)} km`), 14, finalY + 15);
    pdf.text(serbianToPdfText(`Ukupan broj događaja: ${totalEvents}`), 14, finalY + 20);

    // Save PDF
    pdf.save(`izvestaj-bezbednost-${dateRange[0].format('YYYY-MM')}.pdf`);
    message.success('PDF izveštaj je uspešno kreiran');
    */
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
  const totalEvents = reportData.reduce((sum, v) => 
    sum + (Number(v.severeAccelerations) || 0) + (Number(v.severeBrakings) || 0), 0);

  return (
    <>
      {contextHolder}
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
                icon={<SettingOutlined />}
                onClick={async () => {
                  try {
                    setConfigModalVisible(true);
                    // Load current configuration
                    const config = await drivingBehaviorService.getSafetyScoreConfig();
                    configForm.setFieldsValue(config);
                  } catch (error) {
                    messageApi.error('Greška pri učitavanju konfiguracije');
                  }
                }}
              >
                Podešavanja
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
        <Row gutter={16} align="middle" className="mt-4">
          <Col span={24}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium">Tip prikaza:</label>
                <Switch
                  checked={isExecutiveView}
                  onChange={setIsExecutiveView}
                  checkedChildren={<><DashboardOutlined /> Izvršni pregled</>}
                  unCheckedChildren={<><TableOutlined /> Detaljni prikaz</>}
                  size="default"
                />
              </div>
              {isExecutiveView && (
                <div className="text-xs text-gray-500">
                  Kompaktni izveštaj optimizovan za upravu i štampu
                </div>
              )}
            </div>
          </Col>
        </Row>

        {/* Metoda računanja kilometraže */}
        <Row gutter={16} align="middle" className="mt-4">
          <Col span={24}>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-4">
                <InfoCircleOutlined className="text-blue-600 text-xl" />
                <div>
                  <label className="text-sm font-semibold text-blue-900">
                    Metoda računanja kilometraže:
                  </label>
                  <div className="text-xs text-blue-700 mt-1">
                    {calculationMethod === 'views'
                      ? '✅ VIEW agregati БEZ PostGIS (Haversine formula) - brže, preporučeno'
                      : '⚠️ Direktno iz GPS podataka (PostGIS ST_Distance) - sporije, backup opcija'}
                  </div>
                </div>
              </div>
              <Switch
                checked={calculationMethod === 'direct'}
                onChange={(checked) => setCalculationMethod(checked ? 'direct' : 'views')}
                checkedChildren={<><DatabaseOutlined /> Direktno</>}
                unCheckedChildren={<><ThunderboltOutlined /> VIEW-ovi</>}
                size="default"
              />
            </div>
          </Col>
        </Row>

        {/* Progress Bar */}
        {progressState && (
          <Row className="mt-4">
            <Col span={24}>
              <div className="text-sm text-gray-600 mb-2">
                Procesiranje grupa vozila: {progressState.current} / {progressState.total}
              </div>
              <Progress
                percent={Math.round((progressState.current / progressState.total) * 100)}
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </Col>
          </Row>
        )}
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
                formatter={(value) => {
                  const num = typeof value === 'string' ? parseInt(value) : Number(value) || 0;
                  return num.toLocaleString('en-US');
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Report Content - Conditional based on view type */}
      {isExecutiveView ? (
        /* Executive Summary View */
        <ExecutiveSummaryView 
          reportData={reportData}
          loading={loading}
          avgScore={avgScore}
          totalKm={totalKm}
          totalEvents={totalEvents}
        />
      ) : (
        /* Detailed Table View */
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
            <Spin size="large" tip="Generisanje izveštaja..." spinning={true}>
              <div style={{ minHeight: '100px' }} />
            </Spin>
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
      )}
      {/* Configuration Modal */}
      <Modal
        title={
          <span>
            <SettingOutlined className="mr-2" />
            Podešavanje Safety Score parametara
          </span>
        }
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setConfigModalVisible(false)}>
            Otkaži
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={savingConfig}
            onClick={async () => {
              try {
                const values = await configForm.validateFields();
                setSavingConfig(true);
                
                // Save configuration to API
                await drivingBehaviorService.updateSafetyScoreConfig({
                  severeAccel: {
                    threshold: values.severeAccelThreshold,
                    distance: values.severeAccelDistance,
                    penalty: values.severeAccelPenalty,
                  },
                  moderateAccel: {
                    threshold: values.moderateAccelThreshold,
                    distance: values.moderateAccelDistance,
                    penalty: values.moderateAccelPenalty,
                  },
                  severeBrake: {
                    threshold: values.severeBrakeThreshold,
                    distance: values.severeBrakeDistance,
                    penalty: values.severeBrakePenalty,
                  },
                  moderateBrake: {
                    threshold: values.moderateBrakeThreshold,
                    distance: values.moderateBrakeDistance,
                    penalty: values.moderateBrakePenalty,
                  },
                });

                messageApi.success('Konfiguracija je sačuvana! Novi safety score će biti primenjen na sledeći izveštaj.');

                setSavingConfig(false);
                setConfigModalVisible(false);
              } catch (error) {
                console.error('Validation error:', error);
              }
            }}
          >
            Sačuvaj
          </Button>,
        ]}
      >
        <Form
          form={configForm}
          layout="vertical"
          initialValues={{
            // Ozbiljna ubrzanja
            severeAccelThreshold: 2,
            severeAccelDistance: 100,
            severeAccelPenalty: 15,
            severeAccelMultiplier: 2,
            severeAccelMax: 25,
            
            // Umerena ubrzanja
            moderateAccelThreshold: 10,
            moderateAccelDistance: 100,
            moderateAccelPenalty: 5,
            moderateAccelMultiplier: 1.5,
            moderateAccelMax: 15,
            
            // Ozbiljna kočenja
            severeBrakeThreshold: 2,
            severeBrakeDistance: 100,
            severeBrakePenalty: 15,
            severeBrakeMultiplier: 2,
            severeBrakeMax: 25,
            
            // Umerena kočenja
            moderateBrakeThreshold: 10,
            moderateBrakeDistance: 100,
            moderateBrakePenalty: 5,
            moderateBrakeMultiplier: 1.5,
            moderateBrakeMax: 15,
          }}
        >
          {/* Ozbiljna ubrzanja */}
          <Divider orientation="left">
            <Tag color="red">Ozbiljna ubrzanja</Tag>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="severeAccelThreshold"
                label={
                  <span>
                    Prag događaja
                    <Tooltip title="Broj događaja koji se tolerišu pre kažnjavanja">
                      <InfoCircleOutlined className="ml-1" />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="severeAccelDistance"
                label={
                  <span>
                    Distanca (km)
                    <Tooltip title="Distanca za računanje (npr. 100km)">
                      <InfoCircleOutlined className="ml-1" />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="severeAccelPenalty"
                label={
                  <span>
                    Kazna (poeni)
                    <Tooltip title="Koliko poena se oduzima kada se prekorači prag">
                      <InfoCircleOutlined className="ml-1" />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* Umerena ubrzanja */}
          <Divider orientation="left">
            <Tag color="orange">Umerena ubrzanja</Tag>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="moderateAccelThreshold" label="Prag događaja">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="moderateAccelDistance" label="Distanca (km)">
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="moderateAccelPenalty" label="Kazna (poeni)">
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* Ozbiljna kočenja */}
          <Divider orientation="left">
            <Tag color="red">Ozbiljna kočenja</Tag>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="severeBrakeThreshold" label="Prag događaja">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="severeBrakeDistance" label="Distanca (km)">
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="severeBrakePenalty" label="Kazna (poeni)">
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* Umerena kočenja */}
          <Divider orientation="left">
            <Tag color="orange">Umerena kočenja</Tag>
          </Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="moderateBrakeThreshold" label="Prag događaja">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="moderateBrakeDistance" label="Distanca (km)">
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="moderateBrakePenalty" label="Kazna (poeni)">
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <div style={{ background: '#f0f2f5', padding: '12px', borderRadius: '4px' }}>
            <p className="text-sm text-gray-600 mb-0">
              <InfoCircleOutlined className="mr-1" />
              Formula: Safety Score = 100 - Σ(kazne za prekoračenja pragova)
            </p>
            <p className="text-sm text-gray-600 mb-0 mt-2">
              Primer: Ako vozilo ima 5 ozbiljnih ubrzanja na 100km (prag=2), kazna = 15 + (5-2) × 2 = 21 poena
            </p>
          </div>
        </Form>
      </Modal>
      </div>
    </>
  );
};

export default MonthlyReport;