import Main from '@/components/ui/Main';
import { Box, Button, Card, CardContent, Divider, TextField, Typography } from '@mui/material';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchAPI } from '@/utils/fetchUtil';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import { Payments } from '@/types/cashRegister';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { globalTableProps } from '@/utils/globalTableProps';

type CashierSession = {
  id: number;
  blagajnik_id: number;
  blagajnik: string;
  kasa_id: number;
  kasa: string;
  datum_otvaranja: string;
  datum_zatvaranja: string;
  pocetni_iznos: string;
  krajnji_iznos: string;
  status: number;
  napomena: string;
};

const SessionInfo = ({
  session,
  note,
  handleNoteChange,
  closeSession,
  isSessionClosed,
  exportToPDF,
  isPDFGenerating,
  payments,
}: {
  session: CashierSession;
  note: string;
  handleNoteChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  closeSession: () => void;
  exportToPDF: () => Promise<void>;
  isSessionClosed: boolean;
  isPDFGenerating: boolean;
  payments: Payments[];
}) => {
  const { blagajnik, napomena, datum_otvaranja, datum_zatvaranja, kasa, krajnji_iznos, pocetni_iznos, status } = session;

  let openDate, openTime;
  if (datum_otvaranja) {
    const openDateParts = datum_otvaranja.split(' ');
    openDate = dayjs(openDateParts[0]).format('DD.MM.YYYY');
    openTime = openDateParts[1];
  }

  let closeDate, closeTime;
  if (datum_zatvaranja) {
    const closeDateParts = datum_zatvaranja.split(' ');
    closeDate = dayjs(closeDateParts[0]).format('DD.MM.YYYY');
    closeTime = closeDateParts[1];
  }

  const columns = useMemo<MRT_ColumnDef<Payments>[]>(
    () => [
      {
        accessorKey: 'broj_fiskalnog_racuna',
        header: 'Broj fiskalnog računa',
        size: 300,
      },
      {
        accessorKey: 'nacin_placanja_id',
        header: 'Nacin placanja',
        size: 100,
      },
      {
        accessorKey: 'iznos_ukupno',
        header: 'Ukupan iznos',
        size: 100,
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: payments,
    renderTopToolbarCustomActions: () => (
      <Typography variant="h6" sx={{ textDecoration: 'underline' }}>
        Uplate
      </Typography>
    ),
    ...globalTableProps,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
  });

  return (
    <Box display="flex" justifyContent="space-between" gap={2}>
      <Card sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
        <CardContent sx={{ wordBreak: 'break-all' }}>
          <Typography variant="h6" gutterBottom sx={{ textDecoration: 'underline' }}>
            Smena
          </Typography>
          <Typography variant="body1">Blagajnik: {blagajnik ?? '-'}</Typography>
          <Typography variant="body1">Kasa: {kasa ?? '-'}</Typography>
          <Typography variant="body1">Početni iznos: {pocetni_iznos ?? '-'}</Typography>
          <Typography variant="body1">Datum otvaranja: {openDate ?? '-'}</Typography>
          <Typography variant="body1">Vreme otvaranja: {openTime ?? '-'}</Typography>
          <Typography variant="body1">Datum zatvaranja: {closeDate ?? '-'}</Typography>
          <Typography variant="body1">Vreme zatvaranja: {closeTime ?? '-'}</Typography>
          <Typography variant="body1">
            Status:{' '}
            <Typography component="span" variant="body1" color={status === 1 ? 'success.light' : 'error.main'}>
              {status === 1 ? 'Otvorena' : 'Zatvorena'}
            </Typography>
          </Typography>
          <Typography variant="body1">Napomena: {napomena ?? '-'}</Typography>
          <Typography variant="body1">Krajnji iznos: {krajnji_iznos ?? '-'}</Typography>
        </CardContent>
      </Card>
      <Box width={800}>
        <MaterialReactTable table={table} />
      </Box>
      <Box display="flex" flexDirection="column" gap={2} width="100%">
        <TextField label="Napomena" multiline rows={4} value={note ?? ''} onChange={handleNoteChange} variant="outlined" fullWidth />
        <Button disabled={!session || isSessionClosed} onClick={closeSession} variant="contained">
          Završi smenu
        </Button>
        {isSessionClosed && (
          <Button
            color="warning"
            variant="contained"
            onClick={exportToPDF}
            disabled={!session && isPDFGenerating}
            loading={!session && isPDFGenerating}
          >
            Izvezi PDF
          </Button>
        )}
      </Box>
    </Box>
  );
};

export const CashiersSessionPage = ({ title }: { title: string }) => {
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [session, setSession] = useState<CashierSession | null>(null);
  const [isPDFGenerating, setIsPDFGenerating] = useState(false);
  const [payments, setPayments] = useState<Payments[]>([]);

  async function getCashierSession() {
    try {
      const { success, data } = await fetchAPI('/api/cashiers-session/getCashierSession', { method: 'POST' });
      if (!success) {
        toast.error('Došlo je do greške tokom provere smene');
        return;
      }

      if (data) {
        toast.success(`Učitana je smena za blagajnika: ${data.blagajnik}`);
        if (data.status === 0) {
          setIsSessionClosed(true);
        }

        setAmount(data.pocetni_iznos);
        setNote(data.napomena);
        setSession(data);
      }
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
      return;
    }
  }

  useEffect(() => {
    getCashierSession();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchPayments();
  }, [session]);

  async function fetchPayments() {
    const data = await getAllTransactionsForSession();
    setPayments(data);
  }

  async function openSession() {
    try {
      const { success, data } = await fetchAPI('/api/cashiers-session/openSession', { method: 'POST', data: { pocetni_iznos: amount } });
      if (!success) {
        toast.error('Došlo je do greške tokom otvaranja smene');
        return;
      }

      toast.success(`Smena je uspešno otvorena za ${data.blagajnik}, datuma - ${data.datum_otvaranja}`);
      setSession(data);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
      return;
    }
  }

  async function closeSession() {
    try {
      if (window.confirm('Da li ste sigurni?')) {
        if (!session) {
          toast.error('Došlo je do greške');
          return;
        }

        const { blagajnik_id, datum_otvaranja, id } = session;
        const body = { blagajnik_id, napomena: note, datum_otvaranja: datum_otvaranja, id };

        const { success, data } = await fetchAPI('/api/cashiers-session/closeSession', { method: 'POST', data: body });
        if (!success) {
          toast.error('Došlo je do greške tokom zatvaranja smene');
          return;
        }

        toast.success(`Smena je uspešno zatvorena za ${data.blagajnik}, datuma - ${data.datum_zatvarenja}`);
        setSession(data);
        setIsSessionClosed(true);
      }
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
      return;
    }
  }

  async function getAllTransactionsForSession(): Promise<Payments[]> {
    try {
      if (!session) return [];

      const dateParts = session.datum_otvaranja.split(' ');
      const date = dateParts[0];

      const { success, data } = await fetchAPI('/api/cashiers-session/getAllTransactionsForSession', { method: 'POST', data: {
        datum_otvaranja: date,
      } });

      if (!success) {
        toast.error('Došlo je do greške');
        return [];
      }

      return data as Payments[];
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
      return [];
    }
  }

  async function exportToPDF() {
    try {
      if (!session) return;

      const data = await getAllTransactionsForSession();

      if (data.length === 0) {
        toast.info('Nema podataka za štampu!');
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
      doc.text(`Izveštaj uplata ${session?.blagajnik}`, pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Generisano: ${currentDate} u ${currentTime}`, pageWidth / 2, 26, { align: 'center' });

      autoTable(doc, {
        startY: 40,
        head: [['Broj fiskalnog računa', 'Način plaćanja', 'Iznos']],
        body: data.map((row) => [row.broj_fiskalnog_racuna || 'N/A', row.nacin_placanja_id || 'N/A', row.iznos_ukupno || 'N/A']),
        foot: [
          [
            '',
            { content: 'UKUPAN IZNOS', colSpan: 1, styles: { halign: 'right', fontStyle: 'bold' } },
            {
              content: `${session.pocetni_iznos} + ${session.krajnji_iznos} = ${Number(session.pocetni_iznos) + Number(session.krajnji_iznos)}`,
            },
          ],
        ],
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

      doc.save(`Izveštaj uplata.pdf`);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške prilikom generisanja PDF-a!');
    } finally {
      setIsPDFGenerating(false);
    }
  }

  return (
    <Main title={title}>
      <Box display="flex" gap={2} flexDirection="column">
        <Box display="flex" gap={2}>
          <TextField
            variant="standard"
            label="Početni iznos"
            value={amount}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!isNaN(value)) {
                setAmount(value < 0 ? 0 : value);
              }
            }}
            slotProps={{
              htmlInput: {
                min: 0,
              },
            }}
          />
          <Button disabled={!!session || isSessionClosed} onClick={openSession} variant="contained">
            Započni smenu
          </Button>
        </Box>
        <Divider sx={{ margin: '8px 0' }}></Divider>
        {!!session && (
          <SessionInfo
            session={session}
            note={note}
            handleNoteChange={(e) => setNote(e.target.value)}
            closeSession={closeSession}
            isSessionClosed={isSessionClosed}
            exportToPDF={exportToPDF}
            isPDFGenerating={isPDFGenerating}
            payments={payments}
          />
        )}
      </Box>
    </Main>
  );
};

export default CashiersSessionPage;
