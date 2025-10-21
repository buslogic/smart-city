import { useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { Box, Checkbox, Button } from '@mui/material';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { toast } from 'react-toastify';
import { WaterServicesPricelistHistory } from '@/types/finance';
import { api } from '@/services/api';
import jsPDF from 'jspdf';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import dayjs, { Dayjs } from 'dayjs';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { DatePicker } from '@mui/x-date-pickers';
import { saveAs } from '@/utils/utils';

export const WaterServicePricelistHistoryPage = ({ title }: { title: string }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [_, setPricelistId] = useState<number>();
  const [data, setData] = useState<WaterServicesPricelistHistory[]>([]);
  const [isPDFGenerating, setIsPDFGenerating] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);

  async function handleFilterChange(value: string) {
    try {
      const parts = value.split('|');
      if (parts.length > 1) {
        const id = Number(parts[0].trim());
        fetchPricelistHistoryRows(id, startDate, endDate);
        setPricelistId(id);
      }
    } catch (err) {
      console.log(err);
    }
  }

  const fetchPricelistHistoryRows = async (id: number, startDate: Dayjs | null, endDate: Dayjs | null) => {
    try {
      setIsFetching(true);
      const { data } = await api.post<WaterServicesPricelistHistory[]>('/api/water-service-prices/history', {
        pricelist_id: id,
        start_date: startDate ? startDate.format('YYYY-MM-DD') : undefined,
        end_date: endDate ? endDate.format('YYYY-MM-DD') : undefined,
      });
      setData(data);
    } catch (err) {
      toast.error('Došlo je do greške');
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<WaterServicesPricelistHistory>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID cenovnika',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'category_name',
        header: 'Kategorija',
        size: 200,
        enableEditing: true,
      },
      {
        accessorKey: 'service_name',
        header: 'Usluga',
        size: 200,
        enableEditing: true,
      },
      {
        accessorKey: 'usage_fee_from',
        header: 'Potrošnja od',
        size: 250,
      },
      {
        accessorKey: 'usage_fee_to',
        header: 'Potrošnja do',
        size: 250,
      },
      {
        accessorKey: 'price',
        header: 'Cena',
        size: 100,
      },
      {
        accessorKey: 'VAT_rate',
        header: 'Stopa PDV-a u %',
        size: 100,
        Cell: ({ cell }) => `${cell.getValue<number>()} %`,
      },
      {
        accessorKey: 'fixed_charge',
        header: 'Fiksna naplata',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue() as number | undefined;
          const checked = value !== undefined && value > 0;
          return <Checkbox disabled checked={checked} />;
        },
      },
      {
        accessorKey: 'assign_by_default',
        header: 'Obavezna pri dodeli',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue() as number | undefined;
          const checked = value !== undefined && value > 0;
          return <Checkbox disabled checked={checked} />;
        },
        enableEditing: true,
      },
      {
        accessorKey: 'created_at',
        header: 'Datum kreiranja',
        size: 150,
        Cell: ({ cell }) => dayjs(cell.getValue() as string).format('DD.MM.YYYY HH:mm'),
      },
    ];
  }, []);

  const exportToPDF = async () => {
    try {
      if (data.length === 0) {
        toast.error('Nema podataka za štampu!');
        return;
      }

      setIsPDFGenerating(true);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [230, 297],
      });

      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');

      const pageWidth = doc.internal.pageSize.getWidth();
      const currentDate = dayjs().format('DD.MM.YYYY');
      const currentTime = dayjs().format('HH:mm');

      doc.addImage(VODOVOD_LOGO_PNG, 'PNG', 8, 8, 18, 18);

      doc.setFontSize(14);
      doc.text('Istorija promena cenovnika', pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Generisano: ${currentDate} u ${currentTime}`, pageWidth / 2, 26, { align: 'center' });

      autoTable(doc, {
        startY: 40,
        head: [['Kategorija', 'Usluga', 'Potrošnja od', 'Potrošnja do', 'Cena', 'PDV %', 'Fiksna', 'Obavezna', 'Datum kreiranja']],
        body: data.map((row) => [
          row.category_name || 'N/A',
          row.service_name || 'N/A',
          row.usage_fee_from || 'N/A',
          row.usage_fee_to || 'N/A',
          row.price || '0',
          row.VAT_rate != null ? `${row.VAT_rate}%` : '0%',
          row.fixed_charge ? 'Da' : 'Ne',
          row.assign_by_default ? 'Da' : 'Ne',
          dayjs(row.created_at).format('DD.MM.YYYY HH:mm'),
        ]),
        styles: {
          font: 'Roboto',
          fontSize: 8,
          cellPadding: 1,
          overflow: 'linebreak',
          halign: 'center',
          valign: 'middle',
        },
        headStyles: {
          font: 'Roboto',
          fontSize: 8,
          overflow: 'linebreak',
          cellPadding: 1,
          minCellHeight: 10,
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Strana ${i} od ${pageCount}`, pageWidth - 14, doc.internal.pageSize.height - 10, { align: 'right' });
      }

      doc.save(`Istorija_cenovnika.pdf`);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške prilikom generisanja PDF-a!');
    } finally {
      setIsPDFGenerating(false);
    }
  };

  const exportToExcel = async () => {
    if (data.length === 0) {
      toast.error('Nema podataka za izvoz!');
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cenovnik');

    worksheet.addRow(['Kategorija', 'Usluga', 'Potrošnja od', 'Potrošnja do', 'Cena', 'PDV %', 'Fiksna', 'Obavezna', 'Datum kreiranja']);

    data.forEach((row) => {
      worksheet.addRow([
        row.category_name || 'N/A',
        row.service_name || 'N/A',
        row.usage_fee_from || 'N/A',
        row.usage_fee_to || 'N/A',
        row.price || '0',
        row.VAT_rate != null ? `${row.VAT_rate}%` : '0%',
        row.fixed_charge ? 'Da' : 'Ne',
        row.assign_by_default ? 'Da' : 'Ne',
        dayjs(row.created_at).format('DD.MM.YYYY HH:mm'),
      ]);
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' },
    };

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Istorija_cenovnika.xlsx');
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    enableEditing: false,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false, code: false },
    },
    state: {
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px', justifyContent: 'space-between' }}>
        <Box sx={{ width: '400px', marginRight: '12px' }}>
          <SearchList
            label="Cenovnik usluga"
            endpoint="/api/water-service-prices/search-pricelist-services"
            multiple={false}
            onChange={handleFilterChange}
            textFieldProps={{ variant: 'standard' }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="warning"
            disabled={isPDFGenerating}
            onClick={exportToPDF}
            sx={{ backgroundColor: '#ed6c02', '&:hover': { backgroundColor: '#e65100' } }}
          >
            {isPDFGenerating ? 'Generisanje PDF-a...' : 'Izvezi u PDF'}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={exportToExcel}
            sx={{ backgroundColor: '#2e7d32', '&:hover': { backgroundColor: '#1b5e20' } }}
          >
            Izvezi u Excel
          </Button>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: '12px' }}>
        <DatePicker
          label="Datum od"
          value={startDate}
          format="DD/MM/YYYY"
          onChange={(newValue) => {
            setStartDate(newValue);
            if (_ !== undefined) {
              fetchPricelistHistoryRows(_ as number, newValue, endDate);
            }
          }}
        />
        <DatePicker
          label="Datum do"
          value={endDate}
          format="DD/MM/YYYY"
          onChange={(newValue) => {
            setEndDate(newValue);
            if (_ !== undefined) {
              fetchPricelistHistoryRows(_ as number, startDate, newValue);
            }
          }}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default WaterServicePricelistHistoryPage;
