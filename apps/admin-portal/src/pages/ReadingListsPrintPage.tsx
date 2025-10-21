import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import { fetchAPI } from '@/utils/fetchUtil';
import { AllInclusive, LocationOn, MapsHomeWork, Person } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState } from 'react';
import { toast } from 'react-toastify';

type modalType = 'region' | 'address' | 'reader' | 'all';

type TypeMapKey = {
  title: string;
  label: string;
  description: string;
  endpoint: string;
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/reading-lists-print`;

const typeMap: Record<modalType, TypeMapKey> = {
  region: { title: 'štampa po rejonu', description: 'po rejonu', label: 'Izaberite rejon', endpoint: CONTROLLER + '/getRegionsForSL' },
  address: { title: 'štampa po ulici', description: 'po ulici', label: 'Izaberite ulicu', endpoint: CONTROLLER + '/getAddressesForSL' },
  reader: { title: 'štampa po čitaču', description: 'po čitaču', label: 'Izaberite čitača', endpoint: CONTROLLER + '/getReadersForSL' },
  all: { title: 'štampa svih mernih mesta', description: 'sva merna mesta', label: '', endpoint: '' },
};

type readingListModalProps = { type: modalType; onClose: () => void; onSubmit: (value: string) => void };

const ReadingListModal = ({ type, onClose, onSubmit }: readingListModalProps) => {
  const { endpoint, label, title } = typeMap[type];
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box>
            <SearchList label={label} endpoint={endpoint} fetchOnRender={true} multiple={false} onChange={(value) => setSelected(value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            Zatvori
          </Button>
          <Button variant="contained" onClick={() => selected && onSubmit(selected)}>
            Potvrdi
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const ReadingListsPrintPage = ({ title }: { title: string }) => {
  const [type, setType] = useState<modalType | null>(null);
  const [date, setDate] = useState<dayjs.Dayjs | null>(null);
  const [isPDFGenerating, setIsPDFGenerating] = useState<boolean>(false);
  const [isModalOpened, setIsModalOpened] = useState<boolean>(false);

  const handleDatepickerChange = (value: dayjs.Dayjs | null) => {
    if (value && dayjs(value).isValid()) {
      const minDate = dayjs('1970-01-01');
      const maxDate = dayjs('2100-12-31');

      if (value.isBefore(minDate) || value.isAfter(maxDate)) {
        setDate(null);
        return;
      }
      setDate(value);
      return;
    }

    setDate(null);
  };

  type readingPrintList = {
    redosled_mm: string;
    broj_ulaz_stan: string;
    KS: string;
    broj_clanova_potrosaca_ks: string;
    sifra_potrosaca: string;
    potrosac: string;
    prim_mm: string;
    brojilo: string;
    pocetno_stanje: string;
    zavrsno_stanje: string;
    napomena: string;
  };

  type response = Record<string, readingPrintList[]>;

  const exportToPDF = async (type: modalType, selectedValue?: string | null) => {
    try {
      if (!type) {
        console.log('date or type missing: ', date, type);
        toast.error('Došlo je do greške!');
        return;
      }

      if (!date && type !== 'all') {
        toast.error('Datum obračuna nije izabran!');
        return;
      }

      setIsModalOpened(false);
      setIsPDFGenerating(true);

      let id = null;
      let typeVal = '';

      if (selectedValue) {
        const parts = selectedValue?.split(' | ');
        if (parts.length > 0) {
          id = parts[0];
          typeVal = parts[1];
        }
      }

      const url = CONTROLLER + '/getRows';
      const yyyyMMDate = date?.format('YYYY-MM');

      const tableData: response[] = await fetchAPI(url, {
        method: 'POST',
        data: { id, type, date: yyyyMMDate }
      });
      const formattedDate = dayjs().format('DD.MM.YYYY');

      if (!tableData || tableData.length === 0) {
        toast.info('Nema podataka za izabrane filter!');
        return;
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [230, 297], // w, h
      });
      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');

      const pageWidth = doc.internal.pageSize.getWidth();

      const headerText = ['Čitačka lista', typeMap[type].description, typeVal, yyyyMMDate].filter((x) => !!x).join(' - ');
      doc.text(headerText, pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Generisan datuma ${formattedDate}`, pageWidth / 2, 26, { align: 'center' });
      doc.setFontSize(14);

      tableData.map((data, id) => {
        if (id > 0) doc.addPage();

        doc.addImage(VODOVOD_LOGO_PNG, 'PNG', 8, 8, 18, 18);

        Object.entries(data).forEach(([groupName, rows]) => {
          doc.text(groupName, 14, 45);

          autoTable(doc, {
            startY: 50,
            head: [
              [
                'Red. MM',
                'Broj-Ulaz-Stan',
                'KS',
                'Br. Cl. - Br. Po.',
                'Šifra',
                'Potrošač',
                'ID PMM',
                'IDMM - ID Brojila',
                'Početno',
                'Završno',
                'Napomena',
              ],
            ],
            body: rows.map((row) => [
              row.redosled_mm || '0',
              row.broj_ulaz_stan || '',
              row.KS || '0',
              row.broj_clanova_potrosaca_ks || '',
              '', // sifra potrosaca
              '', // potorsac
              row.prim_mm || '',
              row.brojilo || '',
              row.pocetno_stanje || '',
              row.zavrsno_stanje || '',
              row.napomena || '',
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
            tableWidth: 'auto',
            columnStyles: {
              0: { cellWidth: 'auto' },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 'auto' },
              4: { cellWidth: 'auto' },
              5: { cellWidth: 'auto' },
              6: { cellWidth: 'auto' },
              7: { cellWidth: 'auto' },
              8: { cellWidth: 'auto' },
              9: { cellWidth: 'auto' },
              10: { cellWidth: 'auto' },
            },
          });
        });
      });

      const pageCount = doc.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(10);

        if (type === 'reader') {
          doc.text(`Čitač: ${typeVal}`, 14, pageHeight - 8, { align: 'left' });
        } else if (type === 'region') {
          doc.text(`Rejon: ${typeVal}`, 14, pageHeight - 8, { align: 'left' });
        } else if (type === 'address') {
          doc.text(`Ulica: ${typeVal}`, 14, pageHeight - 8, { align: 'left' });
        } else {
          doc.text(' ', 14, pageHeight - 8, { align: 'left' });
        }

        const footerText = `Strana ${i} od ${pageCount}`;
        doc.text(formattedDate, pageWidth / 2, pageHeight - 8, { align: 'center' });
        doc.text(footerText, pageWidth - 14, pageHeight - 8, { align: 'right' });
      }

      doc.save(`${headerText} - ${formattedDate}.pdf`);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške prilikom generisanja PDF-a.');
    } finally {
      setIsPDFGenerating(false);
    }
  };

  const handleTypeChange = (type: modalType | null) => {
    if (!date && type !== 'all') {
      toast.error('Datum obračuna nije izabran!');
      return;
    }

    setIsModalOpened(true);
    setType(type);

    if (type === 'all') {
      exportToPDF(type);
    }
  };

  return (
    <Main title={title}>
      {/* <Typography variant="h5" style={{ color: 'Highlight' }}>
        {title}
      </Typography>
      <Divider style={{ margin: '12px 0', borderBottom: '1px solid ' + 'Highlight', width: '100%' }} /> */}

      <Box display="flex" flexDirection="column" alignItems="center" gap={6} mt={4}>
        <DatePicker
          views={['year', 'month']}
          format='MM-YYYY'
          label="Unesite obračunski period (mesec i godina)"
          minDate={dayjs('1970-01-01')}
          maxDate={dayjs('2100-12-31')}
          value={date}
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
        <Box display="flex" gap={4}>
          <Button
            variant="contained"
            disabled={type === 'address' && isPDFGenerating}
            loading={type === 'address' && isPDFGenerating}
            onClick={() => handleTypeChange('address')}
            startIcon={<LocationOn />}
          >
            Štampa po ulici
          </Button>
          <Button
            variant="contained"
            disabled={type === 'region' && isPDFGenerating}
            loading={type === 'region' && isPDFGenerating}
            onClick={() => handleTypeChange('region')}
            startIcon={<MapsHomeWork />}
          >
            Štampa po rejonu
          </Button>
          <Button
            variant="contained"
            disabled={type === 'reader' && isPDFGenerating}
            loading={type === 'reader' && isPDFGenerating}
            onClick={() => handleTypeChange('reader')}
            startIcon={<Person />}
          >
            Štampa po čitaču
          </Button>
          <Button
            variant="contained"
            disabled={type === 'all' && isPDFGenerating}
            loading={type === 'all' && isPDFGenerating}
            onClick={() => handleTypeChange('all')}
            startIcon={<AllInclusive />}
          >
            Štampa svih mernih mesta
          </Button>
        </Box>
      </Box>
      {isModalOpened && type && type !== 'all' && (
        <ReadingListModal type={type} onClose={() => setType(null)} onSubmit={(value) => exportToPDF(type, value)} />
      )}
    </Main>
  );
};

export default ReadingListsPrintPage;
