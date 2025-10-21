import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import useComplaint from '@/hooks/useComplaint';
import { Complaint } from '@/types/complaints';
import { fetchAPI } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { Add, Delete, Edit, PictureAsPdf } from '@mui/icons-material';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { styled } from '@mui/system';

export const ComplaintPage = ({ title }: { title: string }) => {
  const {
    createRow,
    deleteRow,
    updateRow,
    isCreating,
    isDeleting,
    isUpdating,
    isFetching,
    complaints,
    fetchActiveRows,
    fetchInactiveRows,
    getPotrosacByID,
    refreshRow,
  } = useComplaint();
  const [loggedUserId, setLoggedUserId] = useState<string>('');
  const [loggedUserName, setLoggedUserName] = useState<string>('');
  const [isShiftOpen, setIsShiftOpen] = useState<number>(1); // TODO: Implement shift status check
  const [isPDFGenerating, setIsPDFGenerating] = useState(false);
  const [showAllComplaints, setShowAllComplaints] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<MRT_Row<Complaint> | null>(null);
  const [executorId, setExecutorId] = useState<string>('');
  const [statusID, setStatusID] = useState<string>('');
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isKorisnikPodnosilac, setIsKorisnikPodnosilac] = useState(false);

  const handleOpenModal = async (row: MRT_Row<Complaint>) => {
    setSelectedRow(row);
    setIsModalOpen(true);

    setExecutorId(row.original.odgovorno_lice_id || '');
    setStatusID(row.original.status_id || '');

    try {
      const data = await fetchAPI<{ executorId: string; row?: Complaint }>(`/api/complaints/${row.original.id}/executor`, {
        method: 'GET',
      });
      if (data && data.executorId) {
        setExecutorId(data.executorId);
      } else {
        setExecutorId('');
      }
      if (data.row) {
        refreshRow(data.row);
      }
    } catch (err) {
      setExecutorId('');
      console.error('Greška pri dohvatanju izvršioca:', err);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setExecutorId('');
  };

  const handlePDFOpenModal = (row: MRT_Row<Complaint>) => {
    setSelectedRow(row);
    setIsPDFModalOpen(true);
  };
  const handlePDFCloseModal = () => {
    setIsPDFModalOpen(false);
    setExecutorId('');
  };

  useEffect(() => {
    // TODO: Implement getLoggedUser from auth context
    // TODO: Implement getShiftStatus check

    const fetchRows = async () => {
      if (showAllComplaints) {
        await fetchInactiveRows();
      } else {
        await fetchActiveRows();
      }
    };

    fetchRows();
  }, [showAllComplaints]);

  const columns = useMemo<MRT_ColumnDef<Complaint>[]>(() => {
    return [
      {
        accessorKey: 'tip_id',
        header: 'Tip',
        size: 100,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
          const value = cell.getValue() as string;

          return (
            <SearchList
              label="Tip"
              value={value}
              disabled={!isCreating && !isEditing}
              endpoint={'/api/complaints/types/search'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
      },
      {
        accessorKey: 'kategorija_id',
        header: 'Kategorija',
        size: 100,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
          const value = cell.getValue() as string;

          return (
            <SearchList
              label="Kategorija"
              value={value}
              disabled={!isCreating && !isEditing}
              endpoint={'/api/complaints/categories/search'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
      },
      {
        accessorKey: 'prioritet_id',
        header: 'Prioritet',
        size: 100,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
          const value = cell.getValue() as string;

          return (
            <SearchList
              label="Prioritet"
              value={value}
              disabled={!isCreating && !isEditing}
              endpoint={'/api/complaints/priorities/search'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
      },
      {
        accessorKey: 'status_id',
        header: 'Status',
        size: 100,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
          const value = cell.getValue() as string;

          return (
            <SearchList
              label="Status"
              value={value}
              disabled={!isCreating && !isEditing}
              endpoint={'/api/complaints/statuses/search'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
      },
      {
        accessorKey: 'opis',
        header: 'Opis',
        size: 100,
        enableEditing: true,
      },
      {
        accessorKey: 'napomena',
        header: 'Napomena',
        size: 100,
        enableEditing: true,
      },
      {
        accessorKey: 'korisnik_id',
        header: 'Korisnik',
        size: 100,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
          const value = cell.getValue() as string;

          return (
            <SearchList
              label="Korisnik"
              value={value}
              disabled={!isCreating && !isEditing}
              endpoint={'/api/user-accounts/search/for-sl'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
      },
      {
        accessorKey: 'idmm',
        header: 'Merno mesto',
        size: 250,
        Edit: ({ cell, column, row }) => (
          <SearchList
            label="Merno mesto"
            value={cell.getValue() as string}
            endpoint={'/api/water-meters/measuring-points/search-list'}
            multiple={false}
            onChange={(newValue) => {
              row._valuesCache[column.id] = newValue;
            }}
          />
        ),
        Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
      },
      {
        accessorKey: 'faktura_id',
        header: 'Broj fakture',
        size: 100,
        enableEditing: true,
      },
      {
        accessorKey: 'obracun_id',
        header: 'Obračun',
        size: 100,
        enableEditing: true,
      },
      {
        accessorKey: 'kreirano',
        header: 'Datum kreiranja',
        size: 150,
        enableEditing: true,
        Edit: ({ row, cell }) => {
          const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
          const [value, setValue] = useState(initialValue);

          return (
            <DatePicker
              value={value}
              label={'Datum kreiranja'}
              sx={{ width: '100%' }}
              onChange={(newDate) => {
                setValue(newDate);
                row._valuesCache['kreirano'] = newDate?.format('YYYY-MM-DD');
              }}
            />
          );
        },
        Cell: ({ cell }) => {
          const date = cell.getValue();
          if (!date) return '';
          const parsed = dayjs(date as string);
          return parsed.isValid() ? parsed.format('DD.MM.YYYY') : '';
        },
      },
      {
        accessorKey: 'zatvoreno',
        header: 'Datum zatvaranja',
        size: 150,
        enableEditing: true,
        Edit: ({ row, cell }) => {
          const rawValue = cell.getValue() as string | null;
          const initialValue = rawValue && rawValue !== '0000-00-00 00:00:00' ? dayjs(rawValue) : null;
          const [value, setValue] = useState(initialValue);

          return (
            <DatePicker
              value={value}
              label={'Datum zatvaranja'}
              sx={{ width: '100%' }}
              onChange={(newDate) => {
                setValue(newDate);
                row._valuesCache['zatvoreno'] = newDate ? newDate.format('YYYY-MM-DD') : '';
              }}
            />
          );
        },
        Cell: ({ cell }) => {
          const date = cell.getValue();
          if (!date || date === '0000-00-00 00:00:00') return '';
          const parsed = dayjs(date as string);
          return parsed.isValid() ? parsed.format('DD.MM.YYYY') : '';
        },
      },
      {
        accessorKey: 'kreirao_id',
        header: 'Kreirao',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'odgovorno_lice_id',
        header: 'Odgovorno lice',
        size: 100,
        enableEditing: true,
        Edit: ({ row }) => {
          const statusIdRaw = row.original.status_id;
          const statusId =
            typeof statusIdRaw === 'string' ? Number(statusIdRaw.split('|')[0].trim()) : typeof statusIdRaw === 'number' ? statusIdRaw : 0;

          if ([1, 2, 3, 4, 5].includes(statusId)) {
            return (
              <Tooltip title="Dodeli izvršioca">
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  onClick={() => handleOpenModal(row)}
                  sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
                >
                  <AssignmentIndIcon />
                </Button>
              </Tooltip>
            );
          }

          return null;
        },
        Cell: ({ row, cell }) => {
          const statusIdRaw = row.original.status_id;
          const statusId =
            typeof statusIdRaw === 'string'
              ? Number((statusIdRaw as string).split('|')[0].trim())
              : typeof statusIdRaw === 'number'
              ? statusIdRaw
              : 0;

          return [1, 2, 3, 4, 5].includes(statusId) ? (
            <Tooltip title="Dodeli izvršiocu">
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={() => handleOpenModal(row)}
                sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              >
                <AssignmentIndIcon />
              </Button>
            </Tooltip>
          ) : (
            <Typography>{cell.getValue() as string}</Typography>
          );
        },
      },
    ];
  }, []);

  const assignExecutor = async (complaintId: number, executorId: string, statusId: string) => {
    const response = await fetchAPI<{ success: boolean; message?: string }>('/api/complaints/assign-executor', {
      method: 'POST',
      data: { complaintId, executorId, statusId },
    });
    if (!response.success) {
      throw new Error(response.message || 'Failed to assign executor');
    }
  };

  const handleAssignExecutor = async () => {
    if (selectedRow) {
      try {
        await assignExecutor(selectedRow.original.id, executorId, statusID);
        toast.success('Uspešno dodeljen izvršilac');
        const updatedRow = { ...selectedRow.original, odgovorno_lice_id: executorId };
        refreshRow(updatedRow);
        handleCloseModal();
      } catch (err) {
        console.error(err);
        toast.error('Došlo je do greške prilikom dodele izvršioca');
      }
    }
  };

  const handleCreate: MRT_TableOptions<Complaint>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      // Očisti polja koja ne treba slati backendu
      const cleanedValues = { ...values };
      delete cleanedValues.status; // Backend ne očekuje 'status', samo 'status_id'
      delete cleanedValues.odgovorno_lice_id; // Ovo polje nije u DTO-u

      // Pretvori prazne stringove u null za datume i opciona polja
      if (cleanedValues.zatvoreno === '' || cleanedValues.zatvoreno === undefined) {
        cleanedValues.zatvoreno = null;
      }

      // Ako je kreirao_id prazan (samo separator " | "), ne šalji ga
      if (cleanedValues.kreirao_id && cleanedValues.kreirao_id.trim() === '|') {
        delete cleanedValues.kreirao_id;
      }

      await createRow(cleanedValues);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleUpdate: MRT_TableOptions<Complaint>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;

      // Očisti polja koja ne treba slati backendu
      const cleanedValues = { ...values };
      delete cleanedValues.status; // Backend ne očekuje 'status', samo 'status_id'
      delete cleanedValues.odgovorno_lice_id; // Ovo polje se šalje samo preko posebnog endpointa

      // Pretvori prazne stringove u null za datume i opciona polja
      if (cleanedValues.zatvoreno === '' || cleanedValues.zatvoreno === undefined) {
        cleanedValues.zatvoreno = null;
      }

      // Ako je kreirao_id prazan (samo separator " | "), ne šalji ga
      if (cleanedValues.kreirao_id && cleanedValues.kreirao_id.trim() === '|') {
        delete cleanedValues.kreirao_id;
      }

      await updateRow(cleanedValues);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleDelete = async (row: MRT_Row<Complaint>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      }
    }
  };

  const exportToPDF = async (row: Complaint, isKorisnikPodnosilac: boolean) => {
    try {
      const potrosac = await getPotrosacByID(row.id);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');

      setIsPDFGenerating(true);

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 8;

      const firstTableWidth = (pageWidth - margin * 2) * 0.65;

      // ===== 1. PRVA TABELA =====
      const firstTable = autoTable(doc, {
        startY: margin,
        margin: { left: margin },
        head: [['Podaci o podnosiocu reklamacije', '']],
        body: [
          ['Datum podnošenja', row.kreirano ? dayjs(row.kreirano).format('DD.MM.YYYY') : ''],
          ['Naziv podnosioca', isKorisnikPodnosilac ? potrosac?.naziv || '' : ''],
          ['Broj lične karte', isKorisnikPodnosilac ? potrosac?.broj_lk || '' : ''],
          ['Mesto izdavanja lk', isKorisnikPodnosilac ? potrosac?.mesto_izdavanja_lk || '' : ''],
          ['JMBG', isKorisnikPodnosilac ? potrosac?.jmbg || '' : ''],
          ['Telefon', isKorisnikPodnosilac ? potrosac?.kontakt_telefon || '' : ''],
          ['E-mail', isKorisnikPodnosilac ? potrosac?.email || '' : ''],
          ['Potpis', ''],
        ],
        styles: { fontSize: 8, cellPadding: 1, font: 'Roboto' },
        headStyles: { fontSize: 8, halign: 'center', fontStyle: 'bold', font: 'Roboto' },
        theme: 'grid',
        tableWidth: firstTableWidth,
      });

      // ===== LOGO =====
      const logoWidth = 30;
      const logoHeight = 30;
      const logoX = margin + firstTableWidth + 4;
      doc.addImage(VODOVOD_LOGO_PNG, 'PNG', logoX, margin, logoWidth, logoHeight);

      // ===== NASLOV =====
      const firstTableFinalY = (firstTable as any)?.finalY ?? margin + 50;
      const afterHeaderY = firstTableFinalY + 8;

      doc.setFontSize(12);
      doc.text('Reklamacija', pageWidth / 2, afterHeaderY, { align: 'center' });

      // ===== DVE TABELE =====
      const secondTableY = afterHeaderY + 5;
      const twoTableWidth = (pageWidth - margin * 2) / 2;

      autoTable(doc, {
        startY: secondTableY,
        margin: { left: margin },
        head: [['Podaci o potrošaču', '']],
        body: [
          ['Naziv', potrosac?.naziv || 'N/A'],
          ['Ulica i broj', potrosac?.ulica_broj || 'N/A'],
          ['Mesto', potrosac?.mesto || 'N/A'],
          ['JMBG', potrosac?.jmbg || 'N/A'],
        ],
        styles: { fontSize: 8, cellPadding: 1, font: 'Roboto' },
        headStyles: { fontSize: 8, halign: 'center', fontStyle: 'bold', font: 'Roboto' },
        theme: 'grid',
        tableWidth: twoTableWidth - 2,
      });

      autoTable(doc, {
        startY: secondTableY,
        margin: { left: margin + twoTableWidth + 2 },
        head: [['Opšti podaci o reklamaciji', '']],
        body: [
          [
            'Reklamaciju primio',
            row.odgovorno_lice_id ? String(row.odgovorno_lice_id).split(' | ').slice(1).join(' | ') || row.odgovorno_lice_id : 'N/A',
          ],
          ['Oznaka predmeta', ''],
          ['Kategorija reklamacije', row.kategorija_id ? String(row.kategorija_id).split(' | ').slice(1).join(' | ') || row.kategorija_id : 'N/A'],
          ['Način dostave reklamacije', ''],
          ['Način dostave rešenja', ''],
        ],
        styles: { fontSize: 8, cellPadding: 1, font: 'Roboto' },
        headStyles: { fontSize: 8, halign: 'center', fontStyle: 'bold', font: 'Roboto' },
        theme: 'grid',
        tableWidth: twoTableWidth - 2,
      });

      // ===== GLAVNA TABELA =====
      const newTableY = secondTableY + 38;
      autoTable(doc, {
        startY: newTableY,
        margin: { left: margin },
        body: [['Broj računa', '', 'Šifra potrošača', potrosac?.sifra_potrosaca || 'N/A', 'Merno mesto ID', potrosac?.idmm || 'N/A']],
        styles: { fontSize: 8, cellPadding: 1, font: 'Roboto' },
        headStyles: { fontSize: 8, halign: 'center', fontStyle: 'bold', font: 'Roboto' },
        theme: 'grid',
        tableWidth: pageWidth - margin * 2,
      });

      // ===== OPIS PROBLEMA =====
      const problemDescriptionY = newTableY + 5;
      autoTable(doc, {
        startY: problemDescriptionY,
        margin: { left: margin },
        head: [['Opis problema:']],
        body: [[row.opis || '']],
        styles: {
          fontSize: 8,
          cellPadding: 1,
          font: 'Roboto',
        },
        headStyles: {
          fontStyle: 'bold',
          font: 'Roboto',
        },
        bodyStyles: {
          minCellHeight: 40,
          font: 'Roboto',
        },
        theme: 'grid',
        tableWidth: pageWidth - margin * 2,
      });

      // ===== ZAHTEV =====
      const requestY = problemDescriptionY + 30;
      autoTable(doc, {
        startY: requestY,
        margin: { left: margin },
        head: [['Zahtevam da izvršite:']],
        body: [['']],
        styles: {
          fontSize: 8,
          cellPadding: 1,
          font: 'Roboto',
        },
        headStyles: {
          fontStyle: 'bold',
          font: 'Roboto',
        },
        bodyStyles: {
          minCellHeight: 40,
          font: 'Roboto',
        },
        theme: 'grid',
        tableWidth: pageWidth - margin * 2,
      });

      // ===== DOKUMENTACIJA =====
      const documentationY = requestY + 30;
      autoTable(doc, {
        startY: documentationY,
        margin: { left: margin },
        head: [['Predlažem sledeću dokumentaciju:']],
        body: [['']],
        styles: {
          fontSize: 8,
          cellPadding: 1,
          font: 'Roboto',
        },
        headStyles: {
          fontStyle: 'bold',
          font: 'Roboto',
        },
        bodyStyles: {
          minCellHeight: 40,
          font: 'Roboto',
        },
        theme: 'grid',
        tableWidth: pageWidth - margin * 2,
      });

      // ===== PRIJEM I EVIDENCIJA =====
      const prijemY = documentationY + 30;
      autoTable(doc, {
        startY: prijemY,
        margin: { left: margin },
        head: [
          [
            {
              content: 'Podaci o prijemu i evidentiranju reklamacije (popunjava ovlašćeno lice, referent za reklamacije):',
              colSpan: 4,
              styles: { halign: 'center', fontStyle: 'bold' },
            },
          ],
        ],
        body: [
          ['Datum prijema:', row.kreirano ? dayjs(row.kreirano).format('DD.MM.YYYY') : '', 'Evid. broj:', ''],
          ['Vreme prijema:', row.kreirano ? dayjs(row.kreirano).format('HH:mm:ss') : '', 'Šif. ovl. lica:', ''],
          ['Potpis ovl. lica:', '', 'Potpis ref. reklamacije:', ''],
        ],
        styles: { fontSize: 8, cellPadding: 1, font: 'Roboto' },
        theme: 'grid',
        tableWidth: pageWidth - margin * 2,
        columnStyles: {
          0: { cellWidth: (pageWidth - margin * 2) / 4 },
          1: { cellWidth: (pageWidth - margin * 2) / 4 },
          2: { cellWidth: (pageWidth - margin * 2) / 4 },
          3: { cellWidth: (pageWidth - margin * 2) / 4 },
        },
      });

      // ===== REŠENJE =====
      const resenjeY = prijemY + 30;
      autoTable(doc, {
        startY: resenjeY,
        margin: { left: margin },
        head: [
          [
            {
              content: 'Rešenje:',
              colSpan: 8,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
          ],
        ],
        body: [
          [
            'Status:',
            row.status_id ? String(row.status_id).split(' | ').slice(1).join(' | ') || row.status_id : 'N/A',
            'Datum obrade:',
            row.kreirano ? dayjs(row.kreirano).format('DD.MM.YYYY') : '',
            'Vreme obrade:',
            row.kreirano ? dayjs(row.kreirano).format('HH:mm:ss') : '',
            'Obradio:',
            row.odgovorno_lice_id ? String(row.odgovorno_lice_id).split(' | ').slice(1).join(' | ') || row.odgovorno_lice_id : 'N/A',
          ],
          [{ content: '', colSpan: 8, styles: { minCellHeight: 20, valign: 'top' } }],
        ],
        styles: { fontSize: 8, cellPadding: 1, font: 'Roboto' },
        theme: 'grid',
        tableWidth: pageWidth - margin * 2,
        columnStyles: {
          0: { cellWidth: (pageWidth - margin * 2) / 8 },
          1: { cellWidth: (pageWidth - margin * 2) / 8 },
          2: { cellWidth: (pageWidth - margin * 2) / 8 },
          3: { cellWidth: (pageWidth - margin * 2) / 8 },
          4: { cellWidth: (pageWidth - margin * 2) / 8 },
          5: { cellWidth: (pageWidth - margin * 2) / 8 },
          6: { cellWidth: (pageWidth - margin * 2) / 8 },
          7: { cellWidth: (pageWidth - margin * 2) / 8 },
        },
      });

      // ===== BROJ STRANA =====
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.text(`Strana ${i} od ${pageCount}`, pageWidth - 8, 290, { align: 'right' });
      }

      doc.save('Reklamacioni_list.pdf');

      setIsPDFModalOpen(false);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške prilikom generisanja PDF-a!');
    } finally {
      setIsPDFGenerating(false);
    }
  };

  const ToggleContainer = styled('div')({
    width: 60,
    height: 30,
    borderRadius: 30,
    background: '#ccc',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.3s',
  });

  const ToggleCircle = styled('div')<{ checked: boolean }>(({ checked }) => ({
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute',
    top: 2,
    left: checked ? 32 : 2,
    transition: 'left 0.3s',
  }));

  const table1 = useMaterialReactTable<Complaint>({
    ...globalTableProps,
    columns,
    data: complaints,
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false },
    },
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => {
      if (!row._valuesCache['kreirao_id']) {
        row._valuesCache['kreirao_id'] = `${loggedUserId} | ${loggedUserName}`;
      }
      if (!row._valuesCache['kreirano']) {
        row._valuesCache['kreirano'] = dayjs().format('YYYY-MM-DD');
      }
      if (!row._valuesCache['status']) {
        row._valuesCache['status'] = `1 | Novo`;
      }

      return (
        <Dialog open={true} maxWidth="sm" fullWidth>
          <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
            Unos
          </DialogTitle>
          <DialogContent
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              padding: '24px',
              overflow: 'scroll',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {React.Children.map(internalEditComponents, (child) => (
                <Box sx={{ width: '100%' }}>{child}</Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </DialogActions>
        </Dialog>
      );
    },
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => {
      return (
        <Dialog open={true} maxWidth="sm" fullWidth>
          <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
            Izmena (ID: {row.original.id})
          </DialogTitle>
          <DialogContent
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              padding: '24px',
              overflow: 'scroll',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {React.Children.map(internalEditComponents, (child) => (
                <Box sx={{ width: '100%' }}>{child}</Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </DialogActions>
        </Dialog>
      );
    },
    renderRowActions: ({ row }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Preuzmi PDF">
            <Button
              variant="contained"
              size="small"
              color="warning"
              disabled={isPDFGenerating || !isShiftOpen}
              onClick={() => handlePDFOpenModal(row)}
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            >
              <PictureAsPdf />
            </Button>
          </Tooltip>
          <Tooltip title="Izmena">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="primary"
              disabled={!isShiftOpen}
              onClick={() => table1.setEditingRow(row)}
            >
              <Edit />
            </Button>
          </Tooltip>
          <Tooltip title="Obriši">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              disabled={!isShiftOpen}
              onClick={() => handleDelete(row)}
            >
              <Delete />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Box>
        <Typography
          sx={{
            color: 'primary.main',
            textDecoration: 'underline',
            fontSize: '1.5rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        ></Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          disabled={!isShiftOpen}
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          Dodaj
        </Button>
      </Box>
    ),
    state: {
      showProgressBars: isFetching,
      isSaving: isCreating || isUpdating || isDeleting,
    },
  });

  return (
    <Main title={title}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          marginBottom: '12px',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!isShiftOpen && <Typography sx={{ color: 'red', marginBottom: '8px' }}>SMENA NIJE OTVORENA!</Typography>}
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <ToggleContainer onClick={() => setShowAllComplaints((prev) => !prev)} style={{ background: showAllComplaints ? '#4caf50' : '#ccc' }}>
            <ToggleCircle checked={showAllComplaints} />
          </ToggleContainer>
          <span>{!showAllComplaints ? 'Prikaži sve reklamacije' : 'Prikaži samo aktivne reklamacije'}</span>
        </Box>
      </Box>

      <MaterialReactTable table={table1} />

      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>Dodeli izvršiocu</DialogTitle>
        <DialogContent>
          <SearchList
            label="Izvršilac"
            value={executorId}
            endpoint={'/api/user-accounts/search/for-sl'}
            multiple={false}
            onChange={(newValue) => setExecutorId(newValue)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAssignExecutor} color="primary">
            Dodeli
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={isPDFModalOpen} onClose={handlePDFCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>Da li je korisnik i podnosilac reklamacije?</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Checkbox
                checked={isKorisnikPodnosilac}
                onChange={(e) => {
                  setIsKorisnikPodnosilac(e.target.checked);
                }}
              />
            }
            label="Korisnik je i podnosilac reklamacije"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePDFCloseModal} color="primary">
            Cancel
          </Button>
          <Button color="primary" onClick={() => selectedRow && exportToPDF(selectedRow.original, isKorisnikPodnosilac)}>
            Dodeli
          </Button>
        </DialogActions>
      </Dialog>
    </Main>
  );
};

export default ComplaintPage;
