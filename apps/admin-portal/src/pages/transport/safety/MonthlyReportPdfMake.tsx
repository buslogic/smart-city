// Izvoz Executive Summary i Detaljni prikaz u PDF sa pdfMake (podržava Unicode!)
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore - pdfFonts nema TypeScript definicije
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Registruj fontove
// @ts-ignore
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

export const exportExecutivePDFWithUnicode = (reportData: any[], dateRange: any[]) => {
  if (reportData.length === 0) {
    return;
  }

  // Pripremi podatke
  const totalVehicles = reportData.length;
  const excellentVehicles = reportData.filter(v => v.safetyScore >= 80).length;
  const goodVehicles = reportData.filter(v => v.safetyScore >= 60 && v.safetyScore < 80).length;
  const riskVehicles = reportData.filter(v => v.safetyScore < 60).length;
  
  const localTotalKm = reportData.reduce((sum, v) => sum + v.totalDistanceKm, 0);
  const localAvgScore = totalVehicles > 0 
    ? reportData.reduce((sum, v) => sum + v.safetyScore, 0) / totalVehicles 
    : 0;
  const localTotalEvents = reportData.reduce((sum, v) => {
    const severeAccel = Number(v.severeAccelerations) || 0;
    const severeBraking = Number(v.severeBrakings) || 0;
    return sum + severeAccel + severeBraking;
  }, 0);
  const localModerateEvents = reportData.reduce((sum, v) => {
    const moderateAccel = Number(v.moderateAccelerations) || 0;
    const moderateBraking = Number(v.moderateBrakings) || 0;
    return sum + moderateAccel + moderateBraking;
  }, 0);
  const avgEventsPerVehicle = totalVehicles > 0 ? localTotalEvents / totalVehicles : 0;
  const avgKmPerVehicle = totalVehicles > 0 ? localTotalKm / totalVehicles : 0;

  // Helper za formatiranje brojeva
  const formatLargeNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  // Definiši PDF dokument
  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 60, 40, 60],
    
    // Definiši stilove i koristi Roboto font
    defaultStyle: {
      font: 'Roboto'
    },
    styles: {
      header: { fontSize: 24, bold: true },
      subheader: { fontSize: 16 },
      dateRange: { fontSize: 12 },
      sectionTitle: { fontSize: 14, bold: true },
      kpiNumber: { fontSize: 24, bold: true },
      kpiLabel: { fontSize: 10 }
    },
    
    content: [
      // Header
      {
        text: 'IZVRŠNI MESEČNI IZVEŠTAJ',
        fontSize: 24,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Bezbednost vožnje gradskog saobraćaja',
        fontSize: 16,
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      {
        text: `Period: ${dateRange[0].format('DD.MM.YYYY')} - ${dateRange[1].format('DD.MM.YYYY')}`,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 25]
      },

      // KLJUČNI INDIKATORI PERFORMANSI
      {
        text: 'KLJUČNI INDIKATORI PERFORMANSI',
        fontSize: 14,
        bold: true,
        margin: [0, 0, 0, 15]
      },
      {
        table: {
          widths: ['*', '*', '*', '*', '*', '*'],
          body: [
            [
              {
                stack: [
                  { text: totalVehicles.toString(), fontSize: 24, bold: true, color: '#2962ff', alignment: 'center' },
                  { text: 'Ukupno vozila', fontSize: 10, alignment: 'center', margin: [0, 5, 0, 0] }
                ],
                border: [true, true, true, true],
                fillColor: '#f5f5f5'
              },
              {
                stack: [
                  { 
                    text: localAvgScore.toFixed(1), 
                    fontSize: 24, 
                    bold: true, 
                    color: localAvgScore >= 80 ? '#52c41a' : localAvgScore >= 60 ? '#faad14' : '#ff4d4f',
                    alignment: 'center' 
                  },
                  { text: 'Prosečan Safety Score', fontSize: 10, alignment: 'center', margin: [0, 5, 0, 0] }
                ],
                border: [true, true, true, true],
                fillColor: '#f5f5f5'
              },
              {
                stack: [
                  { text: formatLargeNumber(localTotalKm), fontSize: 24, bold: true, color: '#52c41a', alignment: 'center' },
                  { text: 'Ukupna kilometraža (km)', fontSize: 10, alignment: 'center', margin: [0, 5, 0, 0] }
                ],
                border: [true, true, true, true],
                fillColor: '#f5f5f5'
              },
              {
                stack: [
                  { text: formatLargeNumber(localModerateEvents), fontSize: 24, bold: true, color: '#faad14', alignment: 'center' },
                  { text: 'Umereni događaji', fontSize: 10, alignment: 'center', margin: [0, 5, 0, 0] }
                ],
                border: [true, true, true, true],
                fillColor: '#f5f5f5'
              },
              {
                stack: [
                  { text: formatLargeNumber(localTotalEvents), fontSize: 24, bold: true, color: '#fa8c16', alignment: 'center' },
                  { text: 'Agresivni događaji', fontSize: 10, alignment: 'center', margin: [0, 5, 0, 0] }
                ],
                border: [true, true, true, true],
                fillColor: '#f5f5f5'
              },
              {
                stack: [
                  { text: formatLargeNumber(localModerateEvents + localTotalEvents), fontSize: 24, bold: true, color: '#8b5cf6', alignment: 'center' },
                  { text: 'Ukupno prekršaja', fontSize: 10, alignment: 'center', margin: [0, 5, 0, 0] }
                ],
                border: [true, true, true, true],
                fillColor: '#f5f5f5'
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#ddd',
          vLineColor: () => '#ddd',
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 15,
          paddingBottom: () => 15
        },
        margin: [0, 0, 0, 25]
      },

      // TRI KARTICE ANALIZE
      {
        columns: [
          // Distribucija Safety Score
          {
            width: '*',
            stack: [
              { text: 'DISTRIBUCIJA SAFETY SCORE', fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
              {
                table: {
                  widths: ['auto', 'auto', 'auto'],
                  body: [
                    ['Odličan (80-100)', excellentVehicles.toString(), `${((excellentVehicles / totalVehicles) * 100).toFixed(1)}%`],
                    ['Dobar (60-79)', goodVehicles.toString(), `${((goodVehicles / totalVehicles) * 100).toFixed(1)}%`],
                    ['Rizičan (<60)', riskVehicles.toString(), `${((riskVehicles / totalVehicles) * 100).toFixed(1)}%`]
                  ]
                },
                layout: 'lightHorizontalLines'
              }
            ]
          },
          // Analiza umerenih performansi
          {
            width: '*',
            stack: [
              { text: 'ANALIZA UMERENIH PERFORMANSI', fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
              {
                table: {
                  widths: ['auto', 'auto'],
                  body: [
                    ['Prosečno po vozilu:', `${(localModerateEvents / totalVehicles).toFixed(1)}`],
                    ['Prosečna km po vozilu:', `${avgKmPerVehicle.toFixed(0)} km`],
                    ['Umereni na 100km:', `${localTotalKm > 0 ? (localModerateEvents / (localTotalKm / 100)).toFixed(1) : '0.0'}`]
                  ]
                },
                layout: 'lightHorizontalLines'
              }
            ]
          },
          // Analiza agresivnih performansi
          {
            width: '*',
            stack: [
              { text: 'ANALIZA AGRESIVNIH PERFORMANSI', fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
              {
                table: {
                  widths: ['auto', 'auto'],
                  body: [
                    ['Prosečno po vozilu:', `${avgEventsPerVehicle.toFixed(1)}`],
                    ['Prosečna km po vozilu:', `${avgKmPerVehicle.toFixed(0)} km`],
                    ['Agresivni na 100km:', `${localTotalKm > 0 ? (localTotalEvents / (localTotalKm / 100)).toFixed(1) : '0.0'}`]
                  ]
                },
                layout: 'lightHorizontalLines'
              }
            ]
          }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 25]
      },

      // KLJUČNI UVIDI I PREPORUKE
      {
        text: 'KLJUČNI UVIDI I PREPORUKE',
        fontSize: 14,
        bold: true,
        margin: [0, 0, 0, 15]
      },
      {
        columns: [
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: '🏆 Odličnost', fontSize: 12, bold: true, margin: [0, 0, 0, 5] },
                      { text: `${((excellentVehicles / totalVehicles) * 100).toFixed(0)}% vozila postiže odličan Safety Score (>80)`, fontSize: 10 }
                    ],
                    fillColor: '#f0fdf4',
                    border: [true, true, true, true]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#22c55e',
              vLineColor: () => '#22c55e',
              hLineWidth: () => 2,
              vLineWidth: () => 2,
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 10,
              paddingBottom: () => 10
            }
          },
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: '⚠️ Upozorenje', fontSize: 12, bold: true, margin: [0, 0, 0, 5] },
                      { text: `${riskVehicles} vozila zahteva dodatnu obuku`, fontSize: 10 }
                    ],
                    fillColor: '#fefce8',
                    border: [true, true, true, true]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#facc15',
              vLineColor: () => '#facc15',
              hLineWidth: () => 2,
              vLineWidth: () => 2,
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 10,
              paddingBottom: () => 10
            }
          },
          {
            width: '*',
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      { text: '📈 Fokus', fontSize: 12, bold: true, margin: [0, 0, 0, 5] },
                      { text: `Prosek od ${avgEventsPerVehicle.toFixed(1)} agresivnih po vozilu`, fontSize: 10 }
                    ],
                    fillColor: '#eff6ff',
                    border: [true, true, true, true]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#3b82f6',
              vLineColor: () => '#3b82f6',
              hLineWidth: () => 2,
              vLineWidth: () => 2,
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 10,
              paddingBottom: () => 10
            }
          }
        ],
        columnGap: 20
      }
    ],

    // Footer
    footer: (currentPage: number) => {
      return {
        text: `Generisan: ${new Date().toLocaleDateString('sr-RS')} | Smart City Platform`,
        alignment: 'center',
        fontSize: 9,
        margin: [0, 30, 0, 0]
      };
    }
  };

  // Generiši i preuzmi PDF
  pdfMake.createPdf(docDefinition).download(`izvrsni-izvestaj-${dateRange[0].format('YYYY-MM')}.pdf`);
};

// Izvoz Detaljnog prikaza u PDF sa pdfMake
export const exportDetailedPDFWithUnicode = (reportData: any[], dateRange: any[]) => {
  if (reportData.length === 0) {
    return;
  }

  // Pripremi podatke za tabelu
  const tableBody = [
    // Header row
    [
      { text: 'Garažni broj', fillColor: '#f5f5f5', bold: true },
      { text: 'Pređeno (km)', fillColor: '#f5f5f5', bold: true, alignment: 'right' },
      { text: 'Safety Score', fillColor: '#f5f5f5', bold: true, alignment: 'center' },
      { text: 'Umerena ubrzanja', fillColor: '#f5f5f5', bold: true, alignment: 'right' },
      { text: 'Umerena kočenja', fillColor: '#f5f5f5', bold: true, alignment: 'right' },
      { text: 'Agresivna ubrzanja', fillColor: '#f5f5f5', bold: true, alignment: 'right' },
      { text: 'Agresivna kočenja', fillColor: '#f5f5f5', bold: true, alignment: 'right' },
      { text: 'Ukupno prekršaja', fillColor: '#f5f5f5', bold: true, alignment: 'right' }
    ]
  ];

  // Dodaj redove sa podacima
  reportData.forEach(vehicle => {
    const moderateAccel = Number(vehicle.moderateAccelerations) || 0;
    const moderateBraking = Number(vehicle.moderateBrakings) || 0;
    const severeAccel = Number(vehicle.severeAccelerations) || 0;
    const severeBraking = Number(vehicle.severeBrakings) || 0;
    const totalViolations = moderateAccel + moderateBraking + severeAccel + severeBraking;

    // Odredi boju za Safety Score
    let scoreColor = '#ff4d4f'; // crvena za < 60
    if (vehicle.safetyScore >= 80) scoreColor = '#52c41a'; // zelena
    else if (vehicle.safetyScore >= 60) scoreColor = '#faad14'; // žuta

    tableBody.push([
      vehicle.garageNumber,
      { text: vehicle.totalDistanceKm.toFixed(1), alignment: 'right' },
      { 
        text: vehicle.safetyScore.toFixed(1), 
        alignment: 'center',
        color: scoreColor,
        bold: true
      },
      { text: moderateAccel.toString(), alignment: 'right' },
      { text: moderateBraking.toString(), alignment: 'right' },
      { text: severeAccel.toString(), alignment: 'right', color: severeAccel > 0 ? '#fa8c16' : '#000' },
      { text: severeBraking.toString(), alignment: 'right', color: severeBraking > 0 ? '#fa8c16' : '#000' },
      { 
        text: totalViolations.toString(), 
        alignment: 'right',
        bold: true,
        color: totalViolations > 10 ? '#ff4d4f' : '#000'
      }
    ]);
  });

  // Dodaj footer sa sumama
  const totalKm = reportData.reduce((sum, v) => sum + v.totalDistanceKm, 0);
  const avgScore = reportData.reduce((sum, v) => sum + v.safetyScore, 0) / reportData.length;
  const totalModerateAccel = reportData.reduce((sum, v) => sum + (Number(v.moderateAccelerations) || 0), 0);
  const totalModerateBraking = reportData.reduce((sum, v) => sum + (Number(v.moderateBrakings) || 0), 0);
  const totalSevereAccel = reportData.reduce((sum, v) => sum + (Number(v.severeAccelerations) || 0), 0);
  const totalSevereBraking = reportData.reduce((sum, v) => sum + (Number(v.severeBrakings) || 0), 0);
  const grandTotal = totalModerateAccel + totalModerateBraking + totalSevereAccel + totalSevereBraking;

  tableBody.push([
    { text: 'UKUPNO', fillColor: '#e6f4ff', bold: true },
    { text: totalKm.toFixed(1), fillColor: '#e6f4ff', bold: true, alignment: 'right' },
    { text: avgScore.toFixed(1), fillColor: '#e6f4ff', bold: true, alignment: 'center' },
    { text: totalModerateAccel.toString(), fillColor: '#e6f4ff', bold: true, alignment: 'right' },
    { text: totalModerateBraking.toString(), fillColor: '#e6f4ff', bold: true, alignment: 'right' },
    { text: totalSevereAccel.toString(), fillColor: '#e6f4ff', bold: true, alignment: 'right' },
    { text: totalSevereBraking.toString(), fillColor: '#e6f4ff', bold: true, alignment: 'right' },
    { text: grandTotal.toString(), fillColor: '#e6f4ff', bold: true, alignment: 'right' }
  ]);

  // Definiši PDF dokument
  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 50, 30, 50],
    
    defaultStyle: {
      font: 'Roboto'
    },
    
    content: [
      // Header
      {
        text: 'DETALJNI MESEČNI IZVEŠTAJ',
        fontSize: 22,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Bezbednost vožnje gradskog saobraćaja',
        fontSize: 14,
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      {
        text: `Period: ${dateRange[0].format('DD.MM.YYYY')} - ${dateRange[1].format('DD.MM.YYYY')}`,
        fontSize: 11,
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },

      // Statistike
      {
        columns: [
          {
            text: `Ukupno vozila: ${reportData.length}`,
            fontSize: 11,
            margin: [0, 0, 0, 10]
          },
          {
            text: `Ukupna kilometraža: ${totalKm.toFixed(1)} km`,
            fontSize: 11,
            margin: [0, 0, 0, 10],
            alignment: 'center'
          },
          {
            text: `Prosečan Safety Score: ${avgScore.toFixed(1)}`,
            fontSize: 11,
            margin: [0, 0, 0, 10],
            alignment: 'right'
          }
        ]
      },

      // Tabela
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody
        },
        layout: {
          hLineWidth: function(i: number, node: any) {
            return (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5;
          },
          vLineWidth: function(i: number) {
            return 0.5;
          },
          hLineColor: function(i: number, node: any) {
            return (i === 0 || i === 1 || i === node.table.body.length) ? '#333' : '#ddd';
          },
          vLineColor: function() {
            return '#ddd';
          },
          paddingLeft: function() { return 8; },
          paddingRight: function() { return 8; },
          paddingTop: function() { return 5; },
          paddingBottom: function() { return 5; }
        }
      },

      // Legenda
      {
        margin: [0, 20, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Legenda Safety Score:', fontSize: 10, bold: true, margin: [0, 0, 0, 5] },
              { text: '• Odličan (80-100) - Zelena', fontSize: 9, color: '#52c41a' },
              { text: '• Dobar (60-79) - Žuta', fontSize: 9, color: '#faad14' },
              { text: '• Rizičan (<60) - Crvena', fontSize: 9, color: '#ff4d4f' }
            ]
          },
          {
            width: '*',
            stack: [
              { text: 'Kategorije prekršaja:', fontSize: 10, bold: true, margin: [0, 0, 0, 5] },
              { text: '• Umereni: Blagi prekršaji brzine', fontSize: 9 },
              { text: '• Agresivni: Ozbiljni prekršaji koji zahtevaju pažnju', fontSize: 9, color: '#fa8c16' }
            ]
          }
        ]
      }
    ],

    // Footer
    footer: function(currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: `Strana ${currentPage} od ${pageCount}`, alignment: 'left', fontSize: 9, margin: [30, 0] },
          { text: `Generisan: ${new Date().toLocaleDateString('sr-RS')} | Smart City Platform`, alignment: 'right', fontSize: 9, margin: [0, 0, 30, 0] }
        ],
        margin: [0, 20, 0, 0]
      };
    }
  };

  // Generiši i preuzmi PDF
  pdfMake.createPdf(docDefinition).download(`detaljni-izvestaj-${dateRange[0].format('YYYY-MM')}.pdf`);
};