import { FormModal } from '@/components/ui/FormModal';
import { GenericTable } from '@/components/ui/GenericTable';
import Input from '@/components/ui/Input';
import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import useWaterMeter from '@/hooks/useWaterMeter';
import useMeasuringPoints from '@/hooks/useMeasuringPoints';
import { MeasuringPoints } from '@/types/measuring-points';
import { HistoryRow } from '@/types/water-meter';
import { globalTableProps } from '@/utils/globalTableProps';
import EditIcon from '@mui/icons-material/Edit';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Select,
  SelectChangeEvent,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import {
  MRT_ColumnDef,
  MRT_EditActionButtons,
  MRT_TableInstance,
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_Row,
  type MRT_TableOptions,
} from 'material-react-table';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

type TUseMeasuringPointsColumnsProps = {
  linkSetter: (value: string) => void;
};

export const useMeasuringPointsColumns = ({ linkSetter }: TUseMeasuringPointsColumnsProps) => {
  return useMemo<MRT_ColumnDef<MeasuringPoints>[]>(
    () => [
      {
        accessorKey: 'IDMM',
        header: 'ID mernog mesta',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'IDV',
        header: 'ID vodomera',
        size: 100,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          return (
            <SearchList
              label="ID vodomera"
              value={cell.getValue() as string}
              endpoint="/api/water-meters/unassigned-for-sl"
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ row, cell }) => (
          <Typography
            sx={{
              cursor: 'pointer',
              color: 'primary.main',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
            onClick={() => linkSetter('' + row.original.IDMM)}
          >
            {cell.getValue() as string}
          </Typography>
        ),
      },
      {
        accessorKey: 'datum_ugradnje',
        header: 'Datum ugradnje',
        size: 150,
        enableEditing: true,
        Edit: ({ row, cell, table }) => {
          const rawValue = cell.getValue();
          const initialDate = rawValue
            ? (dayjs(rawValue as string).isValid() ? dayjs(rawValue as string) : null)
            : null;

          const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(initialDate);
          const isReadOnly = !table.getState().creatingRow && !table.getState().editingRow;

          return (
            <DatePicker
              value={selectedDate}
              label={'Datum ugradnje'}
              disabled={isReadOnly}
              sx={{ width: '100%' }}
              slotProps={{
                textField: {
                  variant: 'standard',
                },
              }}
              onChange={(newDate) => {
                setSelectedDate(newDate);
                row._valuesCache['datum_ugradnje'] = newDate?.format('YYYY-MM-DD') || null;
              }}
            />
          );
        },
        Cell: ({ cell }) => {
          const date = cell.getValue();
          return date ? dayjs(date as string).format('DD.MM.YYYY') : '';
        },
      },
      {
        accessorKey: 'naselje',
        header: 'Naselje',
        size: 150,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Naselje"
              value={cell.getValue() as string}
              endpoint="/api/measuring-points/cities"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'adresa',
        header: 'Ulica',
        size: 150,
        enableEditing: true,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Ulica"
              value={cell.getValue() as string}
              endpoint="/api/measuring-points/addresses"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'ulaz',
        header: 'Ulaz',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'broj',
        header: 'Kućni broj',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'prosek_ps',
        header: 'Prosek PS',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'napomena',
        header: 'Napomena',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'broj_clanova_ks',
        header: 'Broj članova kućnog saveta',
        size: 300,
        enableEditing: true,
      },
      {
        accessorKey: 'broj_potrosaca_ks',
        header: 'Broj potrošača kućnog saveta',
        size: 300,
        enableEditing: true,
      },
      {
        accessorKey: 'type_selection',
        header: 'Vrsta mernog mesta',
        size: 150,
        enableEditing: true,
        Cell: ({ row }) => {
          const korektivno = row.original.korektivno;
          const virtuelno = row.original.virtuelno;
          const kontrolno = row.original.kontrolno;
          if (korektivno == 1) return 'Korektivno';
          if (virtuelno == 1) return 'Virtuelno';
          if (kontrolno == 1) return 'Kontrolno';
          return 'Primarno';
        },
        Edit: ({ row }) => {
          const currentValue = (() => {
            const k = row.original.korektivno;
            const v = row.original.virtuelno;
            const c = row.original.kontrolno;
            if (k == 1) return 'Korektivno';
            if (v == 1) return 'Virtuelno';
            if (c == 1) return 'Kontrolno';
            return 'Primarno';
          })();

          const options = ['Primarno', 'Virtuelno', 'Korektivno', 'Kontrolno'];

          const [selectedValue, setSelectedValue] = useState(currentValue);

          const handleChange = (e: SelectChangeEvent<string>) => {
            const val = e.target.value;
            setSelectedValue(val);
            row._valuesCache['korektivno'] = val === 'Korektivno' ? 1 : 0;
            row._valuesCache['virtuelno'] = val === 'Virtuelno' ? 1 : 0;
            row._valuesCache['kontrolno'] = val === 'Kontrolno' ? 1 : 0;
          };

          return (
            <Select value={selectedValue} onChange={handleChange} fullWidth variant="standard" sx={{ height: '2.5rem' }}>
              {options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        accessorKey: 'prosek_u',
        header: 'Prosek U',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'prim_mm',
        header: 'Primarno merno mesto',
        size: 300,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          const excludeId = row._valuesCache['IDMM'] as string;
          return (
            <SearchList
              label="Primarno merno mesto"
              value={cell.getValue() as string}
              endpoint={`/api/measuring-points/primary-measuring-points`}
              additionalParams={{ excludeId }}
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'redosled_mm',
        header: 'Redosled mernog mesta',
        size: 300,
        enableEditing: true,
      },
      {
        accessorKey: 'broj2',
        header: 'Broj 2',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'check_ll',
        header: 'Check LL',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'latitude',
        header: 'Latitude',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'longtitude',
        header: 'Longitude',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'kucni_savet',
        header: 'Kućni savet',
        size: 50,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          return (
            <SearchList
              label="Kućni savet"
              value={cell.getValue() as string}
              endpoint="/api/measuring-points/house-council-options"
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: '_Napomena_MM',
        header: 'Napomena mernog mesta',
        size: 300,
        enableEditing: true,
      },
      {
        accessorKey: 'prosek_o',
        header: 'Prosek O',
        size: 50,
        enableEditing: true,
      },
      {
        accessorKey: 'mps_status',
        header: 'Status',
        size: 50,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          return (
            <SearchList
              label="Status"
              value={cell.getValue() as string}
              endpoint="/api/measuring-points/status-options"
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'tip',
        header: 'Obračun',
        size: 50,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          return (
            <SearchList
              label="Obračun"
              value={cell.getValue() as string}
              endpoint="/api/measuring-points/type-options"
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
    ],
    [linkSetter]
  );
};

export const MeasuringPointsPage = ({ title }: { title: string }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIDV, setSelectedIDV] = useState<string | null>(null);
  const [selectedKS, setSelectedKS] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedAdress, setSelectedAdress] = useState<string | null>(null);
  const [selectedNaselje, setSelectedNaselje] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPrimMM, setSelectedPrimMM] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);

  const [formModalIDMM, setFormModalIDMM] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const IDMMRef = useRef<HTMLInputElement>(undefined);
  const napomenaRef = useRef<HTMLTextAreaElement>(undefined);
  const ulazRef = useRef<HTMLInputElement>(undefined);
  const brojRef = useRef<HTMLInputElement>(undefined);
  const prosekPSRef = useRef<HTMLInputElement>(undefined);
  const prosekURef = useRef<HTMLInputElement>(undefined);
  const redosledMMRef = useRef<HTMLInputElement>(undefined);
  const broj2Ref = useRef<HTMLInputElement>(undefined);
  const checkLLRef = useRef<HTMLInputElement>(undefined);
  const latitudeRef = useRef<HTMLInputElement>(undefined);
  const longitudeRef = useRef<HTMLInputElement>(undefined);
  const napomenaMMRef = useRef<HTMLTextAreaElement>(undefined);
  const prosekORef = useRef<HTMLInputElement>(undefined);
  const brojClanovaKSRef = useRef<HTMLInputElement>(undefined);
  const brojPotrosacaKSRef = useRef<HTMLInputElement>(undefined);
  const [typeSelection, setTypeSelection] = useState<string>('Primarno');

  const { historyColumns, useWaterMeterColumns } = useWaterMeter();
  const waterMeterColumns = useWaterMeterColumns();

  // Koristi novi hook za učitavanje mernih mesta
  const { measuringPoints, isFetching, isUpdating, isDeleting, fetchData, updateRow, deleteRow } = useMeasuringPoints();

  const columns = useMeasuringPointsColumns({
    linkSetter: (value) => {
      setFormModalIDMM(value);
    },
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  //CREATE action
  const handleCreate = async () => {
    try {
      const newFormData = {
        IDMM: IDMMRef.current?.value || '',
        IDV: selectedIDV || '',
        adresa: selectedAdress || '',
        KS: selectedKS || '',
        type_id: selectedTypeId || '',
        napomena: napomenaRef.current?.value || '',
      };

      const response = await $.ajax({
        url: '../MeasuringPointsController/addNewRow',
        type: 'POST',
        data: {
          idmm: newFormData.IDMM,
          adresa: newFormData.adresa,
          vodomer: newFormData.IDV,
          obracun: newFormData.type_id,
          kucni_savet: newFormData.KS,
          napomena: newFormData.napomena,
        },
        dataType: 'json',
      });

      if (response === true) {
        await fetchMeasuringPointsRows();
        toast.success('Merno mesto je uspešno dodato');
        setIsAddModalOpen(false);

        setSelectedIDV(null);
        setSelectedKS(null);
        setSelectedTypeId(null);
        setSelectedAdress(null);
      } else if (typeof response === 'string') {
        toast.error(response);
      } else {
        toast.error('Došlo je do greške prilikom dodavanja mernog mesta');
      }
    } catch (error) {
      console.error('Error creating measuring point:', error);
      toast.error('Došlo je do greške prilikom dodavanja mernog mesta');
    }
  };

  const renderAddModal = () => (
    <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} maxWidth="lg" fullWidth>
      <DialogTitle variant="h4" marginBottom={2}>Dodaj novo merno mesto</DialogTitle>
      <DialogContent sx={{ padding: '24px', overflow: 'scroll' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem',
          }}
        >
          <Input inputRef={IDMMRef} autoComplete="off" name="IDMM" label="ID mernog mesta*" fullWidth variant="standard" />

          <SearchList
            endpoint="/api/water-meters/unassigned-for-sl"
            label="ID vodomera"
            multiple={false}
            onChange={(newValue) => setSelectedIDV(newValue)}
          />

          <DatePicker
            value={selectedDate}
            label="Datum ugradnje"
            sx={{ width: '100%' }}
            slotProps={{ textField: { variant: 'standard' } }}
            onChange={(newDate) => setSelectedDate(newDate)}
          />

          <SearchList
            endpoint="/api/measuring-points/cities"
            label="Naselje"
            multiple={false}
            onChange={(newValue) => setSelectedNaselje(newValue)}
          />

          <SearchList
            endpoint="/api/measuring-points/addresses"
            label="Ulica"
            multiple={false}
            onChange={(newValue) => setSelectedAdress(newValue)}
          />

          <Input inputRef={ulazRef} autoComplete="off" name="ulaz" label="Ulaz" fullWidth variant="standard" />

          <Input inputRef={brojRef} autoComplete="off" name="broj" label="Kućni broj" fullWidth variant="standard" />

          <Input inputRef={prosekPSRef} autoComplete="off" name="prosek_ps" label="Prosek PS" fullWidth variant="standard" />

          <Input inputRef={napomenaRef} autoComplete="off" name="napomena" label="Napomena" fullWidth variant="standard" multiline rows={2} />

          <Input inputRef={brojClanovaKSRef} autoComplete="off" name="broj_clanova_ks" label="Broj članova kućnog saveta" fullWidth variant="standard" />

          <Input inputRef={brojPotrosacaKSRef} autoComplete="off" name="broj_potrosaca_ks" label="Broj potrošača kućnog saveta" fullWidth variant="standard" />

          <Select
            value={typeSelection}
            onChange={(e) => setTypeSelection(e.target.value)}
            fullWidth
            variant="standard"
            label="Vrsta mernog mesta"
          >
            <MenuItem value="Primarno">Primarno</MenuItem>
            <MenuItem value="Virtuelno">Virtuelno</MenuItem>
            <MenuItem value="Korektivno">Korektivno</MenuItem>
            <MenuItem value="Kontrolno">Kontrolno</MenuItem>
          </Select>

          <Input inputRef={prosekURef} autoComplete="off" name="prosek_u" label="Prosek U" fullWidth variant="standard" />

          <SearchList
            endpoint="/api/measuring-points/primary-measuring-points"
            label="Primarno merno mesto"
            multiple={false}
            onChange={(newValue) => setSelectedPrimMM(newValue)}
          />

          <Input inputRef={redosledMMRef} autoComplete="off" name="redosled_mm" label="Redosled mernog mesta" fullWidth variant="standard" />

          <Input inputRef={broj2Ref} autoComplete="off" name="broj2" label="Broj 2" fullWidth variant="standard" />

          <Input inputRef={checkLLRef} autoComplete="off" name="check_ll" label="Check LL" fullWidth variant="standard" />

          <Input inputRef={latitudeRef} autoComplete="off" name="latitude" label="Latitude" fullWidth variant="standard" />

          <Input inputRef={longitudeRef} autoComplete="off" name="longtitude" label="Longitude" fullWidth variant="standard" />

          <SearchList
            endpoint="/api/measuring-points/house-council-options"
            label="Kućni savet"
            multiple={false}
            onChange={(newValue) => setSelectedKS(newValue)}
          />

          <Input inputRef={napomenaMMRef} autoComplete="off" name="_Napomena_MM" label="Napomena mernog mesta" fullWidth variant="standard" multiline rows={2} />

          <Input inputRef={prosekORef} autoComplete="off" name="prosek_o" label="Prosek O" fullWidth variant="standard" />

          <SearchList
            endpoint="/api/measuring-points/status-options"
            label="Status"
            multiple={false}
            onChange={(newValue) => setSelectedStatus(newValue)}
          />

          <SearchList
            endpoint="/api/measuring-points/type-options"
            label="Obračun"
            multiple={false}
            onChange={(newValue) => setSelectedTypeId(newValue)}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() => {
            setIsAddModalOpen(false);
          }}
        >
          Odustani
        </Button>
        <Button variant="contained" onClick={handleCreate}>
          Sačuvaj
        </Button>
      </DialogActions>
    </Dialog>
  );

  // UPDATE action
  const handleSaveMM: MRT_TableOptions<MeasuringPoints>['onEditingRowSave'] = async ({ values, table }) => {
    try {
      await updateRow(values as MeasuringPoints);
      toast.success('Merno mesto je uspešno izmenjeno');
      table.setEditingRow(null);
    } catch (error: any) {
      console.error('Error updating measuring point:', error);
      toast.error(error.message || 'Došlo je do greške prilikom izmene mernog mesta');
    }
  };

  const handleSoftDelete = async (idmm: number) => {
    try {
      await deleteRow(idmm);
      toast.success('Merno mesto je uspešno deaktivirano');
    } catch (error) {
      console.error('Error during soft delete:', error);
      toast.error('Greška prilikom deaktivacije mernog mesta');
    }
  };

  const openDeleteConfirmModal = (row: MRT_Row<MeasuringPoints>) => {
    if (window.confirm('Da li ste sigurni da želite da deaktivirate ovo merno mesto?')) {
      handleSoftDelete(row.original.IDMM);
    }
  };

  const handleEditClose = (table: MRT_TableInstance<MeasuringPoints>) => {
    table.setEditingRow(null);
    setSearchParams(
      (prev) => {
        prev.delete('idmm');
        return prev;
      },
      { replace: true }
    );
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: measuringPoints,
    editDisplayMode: 'modal',
    enableEditing: true,
    initialState: {
      density: 'compact',
    },
    getRowId: (row) => String(row.IDMM),
    muiToolbarAlertBannerProps: undefined,
    onEditingRowSave: handleSaveMM,
    onEditingRowCancel: ({ table }) => handleEditClose(table),
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
      <Dialog open={true} onClose={() => handleEditClose(table)} maxWidth="lg" fullWidth>
        <DialogTitle variant="h4" marginBottom={2}>Izmena mernog mesta</DialogTitle>
        <DialogContent
          sx={{
            padding: '24px',
            overflow: 'scroll',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem',
            }}
          >
            {internalEditComponents}
          </Box>
          <Box sx={{ mt: 3 }}>
            <GenericTable<HistoryRow>
              title="Istorija promena na mernom mestu"
              fetchUrl="/api/measuring-points/history"
              fetchParams={{ idmm: row.original.IDMM }}
              columns={historyColumns}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Dialog>
    ),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Izmeni">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="primary"
            onClick={() => {
              if (!isUpdating && !isDeleting) {
                table.setEditingRow(row);
              }
            }}
          >
            <EditIcon />
          </Button>
        </Tooltip>
        <Tooltip title="Deaktiviraj">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="error"
            onClick={() => openDeleteConfirmModal(row)}
          >
            <RemoveCircleOutlineIcon />
          </Button>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" onClick={() => setIsAddModalOpen(true)}>
        Dodaj novo merno mesto
      </Button>
    ),
    state: {
      isLoading: isFetching,
      isSaving: isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  useEffect(() => {
    const idmm = searchParams.get('idmm');
    if (!idmm) return;
    try {
      const tableRow = table.getRow(idmm);
      if (tableRow) {
        table.setEditingRow(tableRow as MRT_Row<MeasuringPoints>);
      }
    } catch (err) {
      console.warn('failed to get row from table by idmm: ', idmm, err);
    }
  }, [table, measuringPoints, searchParams]);

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
      {renderAddModal()}
      {!!formModalIDMM && (
        <FormModal
          url="/api/water-meters/by-idmm"
          dataBody={{ idmm: formModalIDMM }}
          title="Prikaz vodomera"
          columns={waterMeterColumns}
          navigateURL={`/vodovod/vodomeri?idmm=${formModalIDMM}`}
          navigatePageTitle="Vodomeri (glavni pregled)"
          handleClose={() => {
            setFormModalIDMM('');
          }}
          readOnly
        />
      )}
    </Main>
  );
};

export default MeasuringPointsPage;
