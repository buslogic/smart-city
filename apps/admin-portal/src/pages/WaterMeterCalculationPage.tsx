import Main from '@/components/ui/Main';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import { Subsidy } from '@/types/subsidies';
import { fetchPostData } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { Info, PictureAsPdf } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable, { Color } from 'jspdf-autotable';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type ReadingInfo = {
  subsidies: Subsidy[];
  user_account_id: number | null;
  ulica_naselje: string;
  sifra_potrosaca: number;
  naziv_potrosaca: string;
};

// Nova kolona - Obracunat u ocitavanjima
type WaterMeterReading = {
  id: number;
  pocetno_stanje: number;
  zavrsno_stanje: number;
  potrosnja: number;
  idmm: number;
  idv: string;
  citac: string;
  status: string;
  data: ReadingInfo;
};

type Calculation = {
  id: number;
  campaign_id: number;
  status: number;
  created_at: string;
};

export const WaterMeterCalculationPage = ({ title }: { title: string }) => {
  const [period, setPeriod] = useState<dayjs.Dayjs | null>(null);
  const [readings, setReadings] = useState<WaterMeterReading[]>([]);
  const [calculation, setCalculation] = useState<Calculation>();
  const [isFetching, setIsFetching] = useState(false);
  const [isPDFGenerating, setIsPDFGenerating] = useState(false);
  const [infoModalData, setInfoModalData] = useState<ReadingInfo | null>(null);

  useEffect(() => {
    console.log(setIsPDFGenerating);
  }, [calculation, isPDFGenerating]);

  useEffect(() => {
    fetchRows();
  }, [period]);

  async function fetchRows() {
    try {
      if (!period) return;

      setIsFetching(true);

      const body = { year: period.year(), month: period.month() + 1 };
      const { data, error } = await fetchPostData('../WaterMeterCalculationController/getRows', body);

      if (!data && !!error) {
        toast.error(error);
        return;
      }

      const { readings, calculations } = data;
      setCalculation(calculations);
      setReadings(readings);
    } catch (err) {
      console.log(err);
      toast.error('Doslo je do greske!');
    } finally {
      setIsFetching(false);
    }
  }

  const columns = useMemo<MRT_ColumnDef<WaterMeterReading>[]>(
    () => [
      {
        accessorKey: 'invoiced',
        header: 'Fakturisan',
        size: 150,
      },
      {
        accessorKey: 'idmm',
        header: 'IDMM',
        size: 150,
      },
      {
        accessorKey: 'idv',
        header: 'IDV',
        size: 150,
      },
      {
        accessorKey: 'pocetno_stanje',
        header: 'Pocetno stanje',
        size: 150,
      },
      {
        accessorKey: 'zavrsno_stanje',
        header: 'Zavrsno stanje',
        size: 150,
      },
      {
        accessorKey: 'potrosnja',
        header: 'Izmereno',
        size: 150,
        Cell: ({ row }) => <>{row.original.zavrsno_stanje - row.original.pocetno_stanje}</>,
      },
      {
        accessorKey: 'status',
        header: 'Stanje',
        size: 150,
      },
      {
        accessorKey: 'citac',
        header: 'Citac',
        size: 150,
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: readings,
    enableRowActions: true,
    renderRowActions: ({ row }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Preuzmi PDF">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              color="warning"
              variant="contained"
              onClick={exportToPDF}
            >
              <PictureAsPdf />
            </Button>
          </Tooltip>
          <Tooltip title="Podaci">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="primary"
              onClick={() => setInfoModalData(row.original.data)}
            >
              <Info />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    state: {
      isLoading: isFetching,
    },
  });

  const handleDatepickerChange = (value: dayjs.Dayjs | null) => {
    if (value && dayjs(value).isValid()) {
      const minDate = dayjs('1970-01-01');
      const maxDate = dayjs('2100-12-31');

      if (value.isBefore(minDate) || value.isAfter(maxDate)) {
        return;
      }

      setPeriod(value);
      return;
    }
  };

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Add fonts
      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 6;
      const rowHeight = 4;
      const boldRowHeight = 6;
      const tableColorRGB: Color = [67, 168, 250];
      const highlightColor = '#d2e5fc';
      const baseFontSize = 6;
      // use doc.splitTextToSize for splitting the text
      // const maxWidthForHalfPage = (pageWidth - margin * 2) / 2

      // ===== HEADER SECTION =====
      const headerY = 4;
      doc.addImage(VODOVOD_LOGO_PNG, 'PNG', margin, headerY - 2, 20, 20);

      // ===== Company Info =====
      doc.setFontSize(baseFontSize);
      doc.setFont('Roboto', 'normal');
      const companyInfo = [
        'Матични број: 07023774',
        'ПИБ: 100348628',
        'Адреса: Моше Пијаде 2, 12000 Пожаревац',
        'Телефонски број: 012/555-801',
        'Дежурнe службe: 012/555-187 | 555-194',
        'РЈ "Костолац": 012/241-676',
        'e-поште: office@vodovod012.rs\nwww.vodovod012.rs',
      ];

      let infoY = headerY;
      companyInfo.forEach((info) => {
        doc.text(info, pageWidth - margin, infoY, { align: 'right' });
        infoY += rowHeight;
      });

      // ===== MAIN TITLE =====
      const titleY = headerY + 28;
      doc.setFontSize(18);
      doc.setFont('Roboto', 'bold');
      doc.text('РАЧУН ЗА ВОДУ', margin, titleY);

      let offsetY = titleY + rowHeight * 2;

      const infoX = pageWidth - 80;
      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text('Рејон: 115', infoX, offsetY);
      offsetY += boldRowHeight;
      doc.text('ЈОВИЦА ЈОВАННОВИЋ ЈУГ', infoX, offsetY);
      offsetY += boldRowHeight;
      doc.text('БОГДАНОВА Бр. 21 Стан 4', infoX, offsetY);
      offsetY += boldRowHeight;
      doc.text('12000 ПОЖАРЕВАЦ', infoX, offsetY);

      offsetY = titleY + rowHeight * 2;

      // Consumer INFO (left side)
      const writeRow = function (label: string, text: string, incrm = true) {
        doc.setFont('Roboto', 'bold');
        doc.text(label, margin, offsetY);

        const labelWidth = doc.getTextWidth(label);

        doc.setFont('Roboto', 'normal');
        doc.text(text, margin + labelWidth + 1, offsetY);

        if (incrm) {
          offsetY += rowHeight - 1;
        }
      };

      doc.setFontSize(baseFontSize);
      doc.setFont('Roboto', 'normal');
      writeRow('Шифра потрошача:', '40000100');
      writeRow('Рачун број:', '2530220070229');
      writeRow('Датум:', '31.03.2025');
      writeRow('Место:', 'Пожаревац');
      writeRow('Matiчни број:', '');
      writeRow('Порески број:', '');
      writeRow('Датум промета:', '31.03.2025');
      writeRow('Адреса потрошача:', '12000 ПОЖАРЕВАЦ ЈУГ БОГДАНОВА Бр. 21 Стан 4', false);
      offsetY += 2;

      // ===== CONSUMPTION TABLE =====
      // const consumptionTableY = offsetY + 35;
      const sectionStart = offsetY;

      autoTable(doc, {
        startY: offsetY,
        margin: { left: margin },
        head: [['Подаци о мерном месту']],
        body: [['ID: 14410\n\nПожаревац, Југ Богаднова бр. 21\n\nПросек=190.00m3', '']],
        styles: {
          fontSize: baseFontSize,
          font: 'Roboto',
          halign: 'center',
        },
        headStyles: {
          fillColor: tableColorRGB,
          // textColor: [0, 0, 0],
        },
        theme: 'grid',
        tableWidth: 70,
      });

      // @ts-expect-error kdosa
      offsetY = doc.lastAutoTable.finalY;
      autoTable(doc, {
        startY: offsetY,
        margin: { left: margin },
        head: [['Бројило', 'Почетно', 'Завршно', 'Потрошња']],
        body: [['64422325', '8725', '8844', '119.00']],
        styles: {
          fontSize: baseFontSize,
          font: 'Roboto',
          halign: 'center',
        },
        headStyles: {
          fillColor: tableColorRGB,
          // textColor: [0, 0, 0],
        },
        theme: 'grid',
        tableWidth: 70,
      });

      // @ts-expect-error kdosa
      offsetY = doc.lastAutoTable.finalY;
      autoTable(doc, {
        startY: offsetY,
        margin: { left: margin },
        // head: [['', '']],
        body: [
          ['Бруто потрошнја', '119.00'],
          ['Удео [2 / 29]', '[%] 6.89'],
          ['Нето ѕа обрачун', '8.21'],
          ['Одобрени лимит потрошње', ''],
        ],
        styles: {
          fontSize: baseFontSize,
          font: 'Roboto',
          halign: 'center',
        },
        theme: 'grid',
        tableWidth: 70,
      });

      // @ts-expect-error kdosa
      offsetY = doc.lastAutoTable.finalY;
      autoTable(doc, {
        startY: offsetY,
        margin: { left: margin },
        head: [['Тарифа', 'Количина', 'Цена', 'Износ']],
        body: [
          ['', '8.21', '160.00', '1,313.09'],
          [
            '',
            '',
            { content: '160.00', styles: { fillColor: highlightColor } },
            {
              content: '1,313.09',
              styles: { fillColor: highlightColor },
            },
          ],
        ],
        styles: {
          fontSize: baseFontSize,
          font: 'Roboto',
          halign: 'center',
        },
        headStyles: {
          fillColor: tableColorRGB,
          // textColor: [0, 0, 0],
        },
        theme: 'grid',
        tableWidth: 70,
      });

      autoTable(doc, {
        startY: sectionStart,
        margin: { left: 80, right: margin },
        head: [['Опис задужења', 'ЈМ', 'ПДВ%', 'Количина', 'Цена', 'Износ']],
        body: [
          ['* Вода', 'm3', '10.00', '8.21', '98.00', '804.27'],
          ['* Канализација', 'm3', '10.00', '8.21', '62.00', '508.82'],
          [
            {
              content: '',
              colSpan: 6,
              styles: { halign: 'center' },
            },
          ],
          ['* Фиксни део одржавања система', '', '20.00', '1.00', '172.50', '172.50'],
          ['УКУПНО', '', '', '', '', '1.485.59'],
          ['УКУПНО ОСНОВИЦА СТОПА 10%', '', '', '', '', '1,313.09'],
          ['УКУПНО ОСНОВИЦА СТОПА 20%', '', '', '', '', '172.50'],
          ['УКУПНО ПДВ СТОПА 10%', '', '', '', '', '131.31'],
          ['УКУПНО ПДВ СТОПА 20%', '', '', '', '', '34.50'],
          ['НАКНАДА ЗА ВОДУ', '', '', '', '', '3.94'],
          ['ЗАОКРУЖИВАЊЕ', '', '', '', '', '-0.34'],
          ['ЗАДУЖЕЊЕ ПО ОБРАЧУНУ', '', '', '', '', '1,655.00'],
          ['KAMATA', '', '', '', '', '0.00'],
          ['УКУПНО ЗАДУЖЕЊЕ ПО ОБРАЧУНУ', '', '', '', '', '1,655.00'],
          [
            {
              content: 'Рок ѕа уплату 30.04.2025 на т. р. 160-12510-85',
              colSpan: 6,
              styles: { halign: 'center' },
            },
          ],
        ],
        styles: {
          fontSize: baseFontSize,
          font: 'Roboto',
          halign: 'center',
          valign: 'middle',
        },
        headStyles: {
          fillColor: tableColorRGB,
          // textColor: [0, 0, 0],
        },
        theme: 'grid',
        tableWidth: 'auto',
      });

      // @ts-expect-error тзпесјјбеј
      offsetY = doc.lastAutoTable.finalY;

      autoTable(doc, {
        startY: offsetY,
        margin: { left: 80, right: margin },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'right' },
        },
        body: [
          ['СА ПОСЛЕДЊОМ УПЛАТОМ', '2,276.00 РСД'],
          ['ПРЕТХОДНО ЗАДУЖЕЊЕ', '2,118.00 РСД'],
          ['ЗАДУЖЕЊЕ ПО ОБРАЧУНУ', '1,655.00 РСД'],
          ['УКУПНО ЗАДУЖЕЊЕ', '3,773.00 РСД'],
        ],
        styles: {
          fontSize: baseFontSize,
          cellPadding: 1,
          font: 'Roboto',
          halign: 'center',
          valign: 'middle',
        },
        headStyles: {
          fillColor: tableColorRGB,
          // textColor: [0, 0, 0],
        },
        theme: 'plain',
        tableWidth: 'auto',
      });

      // ===== NALOG ZA PLACANJE =====
      // @ts-expect-error тзпесјјбеј
      offsetY = doc.lastAutoTable.finalY + 22;
      const rectSize = 6;
      const rectX = 61;
      let rectXOffset = rectX;

      doc.setFontSize(baseFontSize * 2);
      doc.setFont('Roboto', 'bold');
      // @ts-expect-error тзпесјјбеј
      doc.text('НАЛОГ ЗА ПЛАЋАЊЕ', rectXOffset, doc.lastAutoTable.finalY + 22 - 2);
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(baseFontSize);

      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize;
      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize * 2 - 2;

      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize;
      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize * 2 - 2;

      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize;
      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize;
      doc.rect(rectXOffset, offsetY, rectSize, rectSize);
      rectXOffset += rectSize;
      doc.rect(rectXOffset, offsetY, rectSize, rectSize);

      const imgSize = 14;
      doc.addImage(VODOVOD_LOGO_PNG, 'PNG', margin, offsetY - 8, imgSize, imgSize);
      doc.addImage(VODOVOD_LOGO_PNG, 'PNG', pageWidth - margin - imgSize, offsetY - 8, imgSize, imgSize);

      // @ts-expect-error тзпесјјбеј
      offsetY = doc.lastAutoTable.finalY + 32;
      // Ide do kraja strane
      // const pageY = doc.internal.pageSize.getHeight();
      // const sectionY = pageY - offsetY - 2;
      const sectionY = 81;
      console.log(sectionY);
      const sectionX = pageWidth - margin * 2;

      const signatureText = 'Потпис налогодавца';
      doc.rect(rectXOffset + rectSize + 2, offsetY - 3, signatureText.length + 6, 0);
      doc.text(signatureText, rectXOffset + rectSize + 2, offsetY - 1);

      doc.text('Рбр: 2530220070229 Р: 115 C: 20', margin, offsetY - 1);
      doc.text('Датум плаћања', rectX, offsetY - 1);

      doc.setFillColor(...tableColorRGB);
      doc.rect(margin, offsetY, sectionX, sectionY, 'F');

      const data = [
        { label: 'Основа 2530220070229', text: 'Уплата за воду' },
        { label: 'Износ', text: '' },
        { label: 'Текући рачун ', text: '' },
        { label: 'Racun', text: '' },
        { label: 'Име налогодавца', text: 'ЈОВИЦА ЈОВАНОВИЋ' },
        { label: 'Адреса налогодавца', text: 'ЈУГ БОГДАНОВА Бр. 21 Стан 4' },
        { label: 'Место налогодавца', text: '12000 Пожаревац' },
        { label: 'Кл. П ’ Физичка лица', text: '01.03.2025 - 31.03.2025' },
        { label: 'Датум доспећа', text: '' }, // podeliti na [][] [][] [][][][] [][]
        { label: 'Текући рачун примаоца', text: '' },
        { label: 'Позив на број', text: '50’40000100' }, // [] [       ]
        { label: 'Име примаоца', text: 'ЈКП ВОДОВОД И КАНАЛИЗАЦИЈА' },
        { label: 'Адреса примаоца', text: 'Моше Пијаде 2' },
        { label: 'Место примаоца', text: '12000 Пожаревац' },
        { label: 'Основа', text: 'Уплата за воду' },
        { label: 'Кл Фл ’ Физичка лица', text: '01.03.2025 - 31.03.2025' },
        { label: 'Износ', text: '' }, // [] [        ]
        { label: 'Позив на број', text: '50-40000100' }, // [] [       ]
        { label: 'Име налогодавца', text: '' },
        { label: 'Адреса налогодавца', text: '' },
        { label: 'MestoМалогодавца', text: '' },
      ];

      offsetY += 2;
      let inputX = margin + 4;
      const inputY = offsetY;
      const rectHeight = 6;
      const rectWidth = 60;

      for (let i = 0; i < data.length; i++) {
        const skipColumn = i !== 0 && i % 7 === 0;
        if (skipColumn) {
          offsetY = inputY;
          inputX += rectWidth + 5;
        }

        doc.setFillColor(255, 255, 255);
        const obj = data[i];

        offsetY += 2;
        doc.text(obj.label, inputX, offsetY);
        offsetY++;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(255, 255, 255);
        doc.rect(inputX, offsetY, rectWidth, rectHeight, 'F');

        doc.text(obj.text, inputX + 1, offsetY + rectHeight - 2);

        offsetY += rectHeight + 2;
      }

      doc.save('racun_za_vodu.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      throw err;
    }
  };

  return (
    <Main title={title}>
      <Box display="flex" gap={2} flexDirection="column">
        <DatePicker
          views={['year', 'month']}
          label="Unesite obračunski period (mesec i godina)"
          minDate={dayjs('1970-01-01')}
          maxDate={dayjs('2100-12-31')}
          value={period}
          onChange={handleDatepickerChange}
          sx={{
            width: '350px',
            '& .MuiInputBase-root': {
              '& .MuiInputBase-input': {
                padding: '0 14px',
              },
            },
          }}
        />
        <MaterialReactTable table={table} />
      </Box>

      <Dialog open={!!infoModalData} onClose={() => setInfoModalData(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Dodatni podaci</DialogTitle>
        <DialogContent>
          <ul>
            <li>Sifra potrosaca: {infoModalData?.sifra_potrosaca || ' - '}</li>
            <li>Ulica: {infoModalData?.ulica_naselje || ' - '}</li>
            <li>Potrosac: {infoModalData?.naziv_potrosaca || ' - '}</li>
            <li>ID korisnika: {infoModalData?.user_account_id || ' - '}</li>
            <span>Subvencije ({infoModalData?.subsidies.length}): </span>
            {infoModalData && infoModalData?.subsidies.length > 0 && (
              <Box>
                <ul>
                  {infoModalData?.subsidies.map(({ id, naziv, limit, procenat, iznos }) => {
                    return <li key={id}>{`${naziv} - Limit: ${limit} - Procenat: ${procenat} - Iznos: ${iznos}`}</li>;
                  })}
                </ul>
              </Box>
            )}
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoModalData(null)} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Main>
  );
};

export default WaterMeterCalculationPage;
