import React, { useState } from 'react';
import { Card, Typography, Tabs, DatePicker, Button, message, Table } from 'antd';
import { PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/sr';
import { planningService, DriverReport } from '../../../services/planning.service';
import '../../../styles/schedule-print.css';

const { Title } = Typography;

// Helper funkcija za grupisanje u chunk-ove (3 vozača po redu)
const chunk = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const SchedulePrint: React.FC = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedMonth, setSelectedMonth] = useState<Dayjs | null>(null);
  const [reportData, setReportData] = useState<DriverReport[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerateReport = async () => {
    if (!selectedMonth) {
      message.warning('Molimo odaberite mesec i godinu');
      return;
    }

    setLoading(true);
    try {
      const data = await planningService.getMonthlyDriverReport(
        selectedMonth.month() + 1, // dayjs.month() vraća 0-11, backend očekuje 1-12
        selectedMonth.year()
      );
      setReportData(data);

      if (data.length === 0) {
        message.info('Nema podataka za odabrani mesec');
      } else {
        message.success(`Izveštaj generisan uspešno (${data.length} vozača)`);
      }
    } catch (error: any) {
      console.error('Greška pri generisanju izveštaja:', error);
      message.error(error.response?.data?.message || 'Greška pri generisanju izveštaja');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const tabItems = [
    {
      key: 'daily',
      label: 'Dnevni',
      children: (
        <div className="p-4">
          <div className="text-gray-600">
            <p className="text-lg mb-4">Štampa dnevnog rasporeda</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Funkcionalnost u razvoju:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>Odabir datuma</li>
                <li>Filter po linijama</li>
                <li>Pregled dnevnog rasporeda</li>
                <li>Export u PDF/Excel format</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'weekly',
      label: 'Nedeljni',
      children: (
        <div className="p-4">
          <div className="text-gray-600">
            <p className="text-lg mb-4">Štampa nedeljnog rasporeda</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Funkcionalnost u razvoju:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                <li>Odabir nedelje (datum početka i kraja)</li>
                <li>Filter po linijama</li>
                <li>Pregled nedeljnog rasporeda</li>
                <li>Export u PDF/Excel format</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'monthly',
      label: 'Mesečni',
      children: (
        <div className="p-4">
          {/* Form sekcija */}
          <div className="mb-6 no-print">
            <div className="flex gap-4 items-end mb-4">
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Odaberite mesec i godinu
                </label>
                <DatePicker
                  picker="month"
                  value={selectedMonth}
                  onChange={(date) => setSelectedMonth(date)}
                  format="MMMM YYYY"
                  placeholder="Odaberi mesec"
                  className="w-full"
                />
              </div>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={handleGenerateReport}
                loading={loading}
                disabled={!selectedMonth}
              >
                Generiši Izveštaj
              </Button>
              {reportData.length > 0 && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                >
                  Štampaj
                </Button>
              )}
            </div>
          </div>

          {/* Izveštaj sekcija */}
          {reportData.length > 0 && (
            <div className="monthly-report-container">
              <div className="report-header">
                <h2 className="report-title">
                  MESEČNI RASPORED VOZAČA ZA MESEC{' '}
                  {selectedMonth?.format('MMMM').toUpperCase()}{' '}
                  {selectedMonth?.year()} GOD.
                </h2>
                <div className="report-form-id">QF-D-004</div>
              </div>

              {/* Tabela sa vozačima - 3 po redu */}
              {chunk(reportData, 3).map((row, rowIndex) => (
                <div key={rowIndex} className="driver-row">
                  {row.map((driver, colIndex) => (
                    <div key={colIndex} className="driver-column">
                      <table className="driver-table">
                        <thead>
                          <tr>
                            <th>SLUŽBENI<br />BROJ</th>
                            <th>RADNO<br />MESTO</th>
                            <th>SLOBODNI<br />DANI</th>
                            <th>DATUM<br />ODRAĐIVANJA</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{driver.driverId}</td>
                            <td>{driver.workPlace}</td>
                            <td>{driver.freeDays}</td>
                            <td>{driver.maintenanceDate || ''}</td>
                          </tr>
                          {/* Dodatni prazni redovi za vizuelni razmak */}
                          {[...Array(5)].map((_, i) => (
                            <tr key={i}>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {/* Popuni prazne kolone ako ima manje od 3 vozača */}
                  {[...Array(3 - row.length)].map((_, i) => (
                    <div key={`empty-${i}`} className="driver-column">
                      <table className="driver-table">
                        <thead>
                          <tr>
                            <th>SLUŽBENI<br />BROJ</th>
                            <th>RADNO<br />MESTO</th>
                            <th>SLOBODNI<br />DANI</th>
                            <th>DATUM<br />ODRAĐIVANJA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...Array(6)].map((_, j) => (
                            <tr key={j}>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                              <td>&nbsp;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {reportData.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileTextOutlined className="text-6xl text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">
                Odaberite mesec i kliknite "Generiši Izveštaj" da vidite podatke
              </p>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <PrinterOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">Štampa Rasporeda</Title>
        </div>

        <div className="mb-4 text-gray-600">
          <p>Modul za štampanje i izvoz rasporeda vozila po dnevnom, nedeljnom ili mesečnom periodu.</p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="mt-4"
        />
      </Card>
    </div>
  );
};

export default SchedulePrint;
