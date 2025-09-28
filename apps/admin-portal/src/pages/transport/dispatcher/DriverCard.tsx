import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Table, message, Spin, Row, Col, Divider, Avatar, Space } from 'antd';
import { UserOutlined, IdcardOutlined, PrinterOutlined, FilePdfOutlined } from '@ant-design/icons';
import { dispatcherService } from '../../../services/dispatcher.service';
import { getAvatarUrl } from '../../../utils/avatar';
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore - pdfFonts nema TypeScript definicije
import pdfFonts from 'pdfmake/build/vfs_fonts';

const { Title, Text } = Typography;
const { Option } = Select;

// Registruj fontove za pdfMake
// @ts-ignore
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatar?: string | null;
  userGroup: {
    id: number;
    groupName: string;
  };
}

interface DriverCard {
  driver: {
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    avatar?: string | null;
    userGroup: {
      id: number;
      groupName: string;
    };
    employedSince: string;
  };
  contactInfo: {
    address: string;
    phone1: string;
    phone2: string;
    employeeNumber: string;
  };
  workHistory: {
    years: string[];
    months: string[];
    data: Record<string, any>;
  };
}

const DriverCard: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [driverCard, setDriverCard] = useState<DriverCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Učitaj listu vozača pri učitavanju komponente
  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const response = await dispatcherService.getDrivers();
      if (response.success) {
        setDrivers(response.data);
      } else {
        message.error('Greška pri učitavanju vozača');
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju vozača:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju vozača');
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleGenerateCard = async () => {
    if (!selectedDriverId) {
      message.warning('Molimo odaberite vozača');
      return;
    }

    setLoading(true);
    try {
      const response = await dispatcherService.getDriverCard(selectedDriverId);
      if (response.success) {
        setDriverCard(response.data);
      } else {
        message.error('Greška pri generisanju kartona vozača');
      }
    } catch (error: any) {
      console.error('Greška pri generisanju kartona vozača:', error);
      message.error(error.response?.data?.message || 'Greška pri generisanju kartona vozača');
    } finally {
      setLoading(false);
    }
  };

  // Funkcija za štampanje kartona - novi pristup
  const handlePrint = () => {
    if (!driverCard) {
      message.warning('Prvo generiši karton vozača');
      return;
    }

    // Kreiraj HTML sadržaj za štampu
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Karton Vozača - ${driverCard.driver.fullName}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: black;
            background: white;
            font-size: 11px;
            line-height: 1.2;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
          }
          .header h1 {
            font-size: 18px;
            margin: 5px 0;
          }
          .header h2 {
            font-size: 14px;
            margin: 5px 0;
          }
          .driver-info {
            display: flex;
            margin-bottom: 15px;
          }
          .photo-section {
            width: 120px;
            height: 140px;
            border: 2px solid black;
            margin-right: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f9f9f9;
            font-size: 9px;
            text-align: center;
            flex-shrink: 0;
          }
          .info-section {
            flex: 1;
          }
          .info-row {
            margin: 4px 0;
            display: flex;
            font-size: 11px;
          }
          .label {
            font-weight: bold;
            width: 140px;
            flex-shrink: 0;
          }
          .value {
            flex: 1;
          }
          .section-title {
            font-size: 13px;
            font-weight: bold;
            margin: 15px 0 8px 0;
            padding-bottom: 3px;
            border-bottom: 1px solid black;
          }
          .contact-table, .work-table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            font-size: 10px;
          }
          .contact-table td {
            border: 1px solid black;
            padding: 4px 6px;
            text-align: left;
          }
          .work-table th, .work-table td {
            border: 1px solid black;
            padding: 3px 4px;
            text-align: center;
            font-size: 9px;
          }
          .work-table th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .contact-table .label-cell {
            font-weight: bold;
            width: 180px;
            background-color: #f9f9f9;
          }
          img {
            max-width: 110px;
            max-height: 130px;
          }
          /* Kompaktna tabela rada */
          .work-table td:first-child {
            text-align: left;
            font-weight: bold;
            width: 80px;
          }
          /* Page break kontrola */
          .driver-info, .contact-table, .work-table {
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>KARTON VOZAČA</h1>
          <h2>${driverCard.driver.fullName}</h2>
        </div>

        <div class="driver-info">
          <div class="photo-section">
            ${driverCard.driver.avatar ?
              `<img src="${getAvatarUrl(driverCard.driver.avatar)}" alt="Fotografija vozača" />` :
              'FOTOGRAFIJA<br>ZAPOSLENOG'
            }
          </div>
          <div class="info-section">
            <div class="info-row">
              <span class="label">IME I PREZIME:</span>
              <span class="value">${driverCard.driver.fullName}</span>
            </div>
            <div class="info-row">
              <span class="label">SLUŽBENI BROJ:</span>
              <span class="value">${driverCard.contactInfo.employeeNumber || '-'}</span>
            </div>
            <div class="info-row">
              <span class="label">GRUPA:</span>
              <span class="value">${driverCard.driver.userGroup.groupName}</span>
            </div>
            <div class="info-row">
              <span class="label">ZAPOSLEN OD:</span>
              <span class="value">${new Date(driverCard.driver.employedSince).toLocaleDateString('sr-RS')}</span>
            </div>
          </div>
        </div>

        <div class="section-title">KONTAKT PODACI</div>
        <table class="contact-table">
          <tr>
            <td class="label-cell">ADRESA STANOVANJA:</td>
            <td>${driverCard.contactInfo.address || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">KONTAKT TELEFON 01:</td>
            <td>${driverCard.contactInfo.phone1 || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">KONTAKT TELEFON 02:</td>
            <td>${driverCard.contactInfo.phone2 || '-'}</td>
          </tr>
          <tr>
            <td class="label-cell">KRSNA SLAVA:</td>
            <td>-</td>
          </tr>
        </table>

        <div class="section-title">EVIDENCIJA RADNOG VREMENA</div>
        <table class="work-table">
          <thead>
            <tr>
              <th>MESEC</th>
              ${driverCard.workHistory.years.map(year => `<th>${year}.</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${driverCard.workHistory.months.map(month => `
              <tr>
                <td style="font-weight: bold;">${month}</td>
                ${driverCard.workHistory.years.map(() => '<td></td>').join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Otvori novi prozor za štampu
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();

      // Čekaj da se slika učita ako postoji, zatim štampaj
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 1000);
    } else {
      message.error('Nije moguće otvoriti prozor za štampu. Proverite da li su pop-up prozori dozvoljeni.');
    }
  };

  // Funkcija za konverziju slike u base64 - koristi fetch umesto Image za CORS
  const getImageAsBase64 = async (url: string): Promise<string> => {
    try {
      // Pokušaj sa fetch koji podržava CORS
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Uključi kredencijale ako su potrebni
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        // Koristi FileReader za konverziju blob-a u base64
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Proces slike kroz canvas za optimizaciju
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(result); // Vrati original ako canvas ne radi
                return;
              }

              // Postavka maksimalnih dimenzija za optimizaciju PDF-a
              const maxWidth = 200;
              const maxHeight = 240;

              let { width, height } = img;

              // Održi aspect ratio
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
              }

              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);

              const optimizedDataURL = canvas.toDataURL('image/jpeg', 0.8);
              resolve(optimizedDataURL);
            } catch (error) {
              // Fallback na original ako optimizacija ne uspe
              resolve(result);
            }
          };
          img.onerror = () => resolve(result); // Fallback na original
          img.src = result;
        };
        reader.onerror = () => reject(new Error('Greška pri čitanju slike'));
        reader.readAsDataURL(blob);
      });

    } catch (fetchError) {
      console.warn('Fetch metod nije uspeo, pokušavam sa Image objektom...', fetchError);

      // Fallback na stari metod sa Image objektom
      return new Promise((resolve, reject) => {
        const img = new Image();

        // Prvo pokušaj bez CORS
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context nije dostupan'));
              return;
            }

            const maxWidth = 200;
            const maxHeight = 240;
            let { width, height } = img;

            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataURL);
          } catch (error) {
            reject(new Error('Greška pri obradi slike'));
          }
        };

        img.onerror = () => reject(new Error('Slika nije dostupna za export'));

        // Ne postavlja crossOrigin da izbegne CORS greške
        img.src = url;
      });
    }
  };

  // Funkcija za export u PDF
  const handleExportPDF = async () => {
    if (!driverCard) {
      message.warning('Prvo generiši karton vozača');
      return;
    }

    setExportingPDF(true);
    try {
      // Pripremi podatke za PDF
      const driver = driverCard.driver;
      const contactInfo = driverCard.contactInfo;
      const workHistory = driverCard.workHistory;

      // Pokušaj da učitaš sliku ako postoji
      let imageBase64 = null;
      if (driver.avatar) {
        try {
          const avatarUrl = getAvatarUrl(driver.avatar);
          if (avatarUrl) {
            imageBase64 = await getImageAsBase64(avatarUrl);
          }
        } catch (error) {
          console.warn('Nije moguće učitati avatar sliku:', error);
          // Nastavi bez slike
        }
      }

      // Kreira PDF dokument
      const docDefinition: any = {
        pageSize: 'A4',
        pageOrientation: 'portrait',
        pageMargins: [40, 60, 40, 60],

        defaultStyle: {
          font: 'Roboto'
        },

        styles: {
          header: { fontSize: 18, bold: true, alignment: 'center' },
          subheader: { fontSize: 14, bold: true },
          label: { fontSize: 10, bold: true },
          value: { fontSize: 11 },
          tableHeader: { fontSize: 10, bold: true, fillColor: '#f5f5f5' }
        },

        content: [
          // Naslov
          {
            text: 'KARTON VOZAČA',
            style: 'header',
            margin: [0, 0, 0, 30]
          },

          // Osnovni podaci
          {
            table: {
              widths: ['30%', '70%'],
              body: [
                [
                  // Levi deo - fotografija
                  {
                    stack: imageBase64 ? [
                      {
                        image: imageBase64,
                        width: 100, // Samo širina - pdfMake će automatski izračunati visinu
                        alignment: 'center',
                        margin: [5, 5, 5, 5]
                      }
                    ] : [
                      {
                        text: 'FOTOGRAFIJA\nZAPOSLENOG',
                        alignment: 'center',
                        fontSize: 8,
                        color: '#666',
                        margin: [0, 30, 0, 30]
                      }
                    ],
                    border: [true, true, true, true],
                    fillColor: imageBase64 ? '#fff' : '#f9f9f9'
                  },
                  // Desni deo - podaci
                  {
                    stack: [
                      {
                        columns: [
                          { text: 'IME I PREZIME:', style: 'label', width: '40%' },
                          { text: driver.fullName, style: 'value', width: '60%' }
                        ],
                        margin: [0, 0, 0, 8]
                      },
                      {
                        columns: [
                          { text: 'SLUŽBENI BROJ:', style: 'label', width: '40%' },
                          { text: contactInfo.employeeNumber || '-', style: 'value', width: '60%' }
                        ],
                        margin: [0, 0, 0, 8]
                      },
                      {
                        columns: [
                          { text: 'GRUPA:', style: 'label', width: '40%' },
                          { text: driver.userGroup.groupName, style: 'value', width: '60%' }
                        ],
                        margin: [0, 0, 0, 8]
                      },
                      {
                        columns: [
                          { text: 'ZAPOSLEN OD:', style: 'label', width: '40%' },
                          { text: new Date(driver.employedSince).toLocaleDateString('sr-RS'), style: 'value', width: '60%' }
                        ]
                      }
                    ],
                    border: [true, true, true, true]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => '#000',
              vLineColor: () => '#000'
            },
            margin: [0, 0, 0, 20]
          },

          // Kontakt podaci
          {
            text: 'KONTAKT PODACI',
            style: 'subheader',
            margin: [0, 20, 0, 10]
          },
          {
            table: {
              widths: ['30%', '70%'],
              body: [
                [
                  { text: 'ADRESA STANOVANJA:', style: 'label' },
                  { text: contactInfo.address || '-', style: 'value' }
                ],
                [
                  { text: 'KONTAKT TELEFON 01:', style: 'label' },
                  { text: contactInfo.phone1 || '-', style: 'value' }
                ],
                [
                  { text: 'KONTAKT TELEFON 02:', style: 'label' },
                  { text: contactInfo.phone2 || '-', style: 'value' }
                ],
                [
                  { text: 'KRSNA SLAVA:', style: 'label' },
                  { text: '-', style: 'value' }
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 30]
          },

          // Tabela radnog vremena
          {
            text: 'EVIDENCIJA RADNOG VREMENA',
            style: 'subheader',
            margin: [0, 0, 0, 10]
          },
          {
            table: {
              headerRows: 1,
              widths: Array(workHistory.years.length + 1).fill('*'),
              body: [
                // Header
                [
                  { text: 'MESEC', style: 'tableHeader', alignment: 'center' },
                  ...workHistory.years.map((year: string) => ({
                    text: `${year}.`,
                    style: 'tableHeader',
                    alignment: 'center'
                  }))
                ],
                // Redovi meseci
                ...workHistory.months.map((month: string) => [
                  { text: month, style: 'label', alignment: 'left' },
                  ...workHistory.years.map(() => ({ text: '', alignment: 'center' }))
                ])
              ]
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => '#ccc',
              vLineColor: () => '#ccc',
              paddingLeft: () => 5,
              paddingRight: () => 5,
              paddingTop: () => 3,
              paddingBottom: () => 3
            }
          }
        ],

        // Footer
        footer: (currentPage: number, pageCount: number) => ({
          columns: [
            {
              text: `Strana ${currentPage} od ${pageCount}`,
              alignment: 'left',
              fontSize: 9,
              margin: [40, 0]
            },
            {
              text: 'Smart City Platform',
              alignment: 'right',
              fontSize: 9,
              margin: [0, 0, 40, 0]
            }
          ],
          margin: [0, 10, 0, 0]
        })
      };

      // Generiši i preuzmi PDF
      pdfMake.createPdf(docDefinition).download(`karton-vozaca-${driver.fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      message.success('PDF karton vozača je uspešno kreiran');

    } catch (error) {
      console.error('Greška pri kreiranju PDF-a:', error);
      message.error('Greška pri kreiranju PDF kartona vozača');
    } finally {
      setExportingPDF(false);
    }
  };

  const createTableData = () => {
    if (!driverCard) return [];

    const { months, years } = driverCard.workHistory;

    return months.map(month => {
      const row: any = { month };
      years.forEach(year => {
        row[year] = ''; // Prazno za sada
      });
      return row;
    });
  };

  const createTableColumns = () => {
    if (!driverCard) return [];

    const { years } = driverCard.workHistory;

    const columns = [
      {
        title: 'MESEC',
        dataIndex: 'month',
        key: 'month',
        fixed: 'left' as const,
        width: 120,
        className: 'font-semibold',
      },
    ];

    years.forEach(year => {
      columns.push({
        title: `${year}.`,
        dataIndex: year,
        key: year,
        width: 120,
        className: 'text-center',
      } as any);
    });

    return columns;
  };

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <UserOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">Karton Vozača</Title>
        </div>

        {/* Odabir vozača */}
        <div className="mb-6">
          <Row gutter={16} align="bottom">
            <Col xs={24} sm={16} md={12} lg={8}>
              <div className="mb-2">
                <Text strong>Odaberite vozača:</Text>
              </div>
              <Select
                style={{ width: '100%' }}
                placeholder="Odaberite vozača"
                value={selectedDriverId}
                onChange={setSelectedDriverId}
                loading={loadingDrivers}
                showSearch
                filterOption={(input, option) => {
                  const driver = drivers.find(d => d.id === option?.value);
                  if (!driver) return false;
                  const searchText = `${driver.fullName} ${driver.userGroup.groupName}`.toLowerCase();
                  return searchText.includes(input.toLowerCase());
                }}
                optionLabelProp="label"
              >
                {drivers.length > 0 ? drivers.map(driver => (
                  <Option
                    key={driver.id}
                    value={driver.id}
                    label={`${driver.fullName} (${driver.userGroup.groupName})`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        size={24}
                        src={getAvatarUrl(driver.avatar)}
                        icon={!getAvatarUrl(driver.avatar) && <UserOutlined />}
                      />
                      <span>{driver.fullName} ({driver.userGroup.groupName})</span>
                    </div>
                  </Option>
                )) : (
                  <Option disabled value="no-drivers">
                    {loadingDrivers ? 'Učitavam vozače...' : 'Nema dostupnih vozača'}
                  </Option>
                )}
              </Select>
            </Col>
            <Col>
              <div style={{ marginTop: '24px' }}>
                <Button
                  type="primary"
                  icon={<IdcardOutlined />}
                  onClick={handleGenerateCard}
                  disabled={!selectedDriverId}
                  loading={loading}
                >
                  Generiši karton
                </Button>
              </div>
            </Col>
          </Row>
        </div>

        {/* Prikaz kartona vozača */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        )}

        {driverCard && !loading && (
          <div className="driver-card-content print-content" style={{ minHeight: '600px' }}>
            <div className="flex justify-between items-center mb-4 no-print">
              <Title level={3} className="mb-0">
                Karton vozača - {driverCard.driver.fullName}
              </Title>
              <Space className="no-print">
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                  type="default"
                >
                  Štampaj
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={handleExportPDF}
                  type="primary"
                  loading={exportingPDF}
                >
                  {exportingPDF ? 'Kreiranje PDF...' : 'Export PDF'}
                </Button>
              </Space>
            </div>

            {/* Naslov za štampu */}
            <div className="print-only" style={{ display: 'none' }}>
              <Title level={2} style={{ textAlign: 'center', marginBottom: '30px' }}>
                KARTON VOZAČA
              </Title>
              <Title level={3} style={{ textAlign: 'center', marginBottom: '20px' }}>
                {driverCard.driver.fullName}
              </Title>
            </div>

            <Divider />

            {/* Sekcija sa osnovnim podacima */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Levi deo - fotografija i osnovi podaci */}
              <div>
                <Row gutter={16}>
                  <Col span={8}>
                    <div className="border-2 border-gray-300 h-32 flex items-center justify-center bg-gray-50">
                      {driverCard.driver.avatar ? (
                        <Avatar
                          size={120}
                          src={getAvatarUrl(driverCard.driver.avatar)}
                          className="object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <UserOutlined className="text-4xl text-gray-400 mb-2" />
                          <Text type="secondary" className="text-xs block">FOTOGRAFIJA<br />ZAPOSLENOG</Text>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col span={16}>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Text strong>IME I PREZIME:</Text>
                        <Text className="col-span-2">{driverCard.driver.fullName}</Text>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Text strong>SLUŽBENI BROJ:</Text>
                        <Text className="col-span-2">{driverCard.contactInfo.employeeNumber || '-'}</Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Desni deo - kontakt podaci */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>ADRESA STANOVANJA:</Text>
                  <Text className="col-span-2">{driverCard.contactInfo.address || '-'}</Text>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>KONTAKT TELEFON 01:</Text>
                  <Text className="col-span-2">{driverCard.contactInfo.phone1 || '-'}</Text>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>KONTAKT TELEFON 02:</Text>
                  <Text className="col-span-2">{driverCard.contactInfo.phone2 || '-'}</Text>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>KRSNA SLAVA:</Text>
                  <Text className="col-span-2">-</Text>
                </div>
              </div>
            </div>

            <Divider />

            {/* Tabela sa godinama i mesecima */}
            <div className="mt-6">
              <Table
                dataSource={createTableData()}
                columns={createTableColumns()}
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 800 }}
                className="driver-work-history-table"
                rowKey="month"
                style={{
                  '--ant-table-thead-bg': '#f5f5f5',
                  '--ant-table-cell-padding-vertical': '8px',
                } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        {!driverCard && !loading && (
          <div className="text-center py-20 text-gray-500">
            <IdcardOutlined className="text-6xl mb-4" />
            <p className="text-lg">Odaberite vozača i kliknite "Generiši karton" da biste videli karton vozača</p>
          </div>
        )}
      </Card>

      <style>
        {`
          .driver-work-history-table .ant-table-thead > tr > th {
            text-align: center !important;
            font-weight: 600 !important;
            background-color: #f5f5f5 !important;
          }

          .driver-work-history-table .ant-table-tbody > tr > td {
            height: 40px !important;
            border: 1px solid #d9d9d9 !important;
          }

          @media print {
            .ant-btn, .ant-select, .p-6 {
              display: none !important;
            }

            .driver-card-content {
              margin: 0 !important;
              padding: 20px !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default DriverCard;