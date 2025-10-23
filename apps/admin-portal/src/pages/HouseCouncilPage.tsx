import Input from '@/components/ui/Input';
import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { HouseCouncil } from '@/types/house-council';
import { globalTableProps } from '@/utils/globalTableProps';
import { fetchAPI } from '@/utils/fetchUtil';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Tooltip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import {
  MRT_EditActionButtons,
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_TableOptions,
} from 'material-react-table';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export const HouseCouncilPage = ({ title }: { title: string }) => {
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIDMM, setSelectedIDMM] = useState<string | null>(null);
  const [selectedAdress, setSelectedAdress] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [data, setData] = useState<HouseCouncil[]>([]);

  const datumUgradnjeRef = useRef<HTMLInputElement>(null);
  const brojClanovaKSRef = useRef<HTMLInputElement>(null);
  const brojPotrosacaKSRef = useRef<HTMLInputElement>(null);
  const iduRef = useRef<HTMLInputElement>(null);
  const brojRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(null);

  const fetchHouseCouncilRows = async () => {
    try {
      setIsFetching(true);
      const houseCouncils = await fetchAPI<HouseCouncil[]>(`${API_BASE}/api/house-council`, {
        method: 'GET',
      });
      setData(houseCouncils);
      setIsLoadingData(false);
      setIsFetching(false);
    } catch (err) {
      console.error(err);
      toast.error('Greška prilikom učitavanja kućnih saveta');
      setIsLoadingData(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchHouseCouncilRows();
  }, []);

  const columns = useMemo<MRT_ColumnDef<HouseCouncil>[]>(
    () => [
      {
        accessorKey: 'idmm',
        header: 'IDMM',
        size: 100,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          return (
            <SearchList
              label="ID mernog mesta"
              value={cell.getValue() as string}
              endpoint={`${API_BASE}/api/house-council/search/measuring-points`}
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
        accessorKey: 'datum_ugradnje',
        header: 'Datum ugradnje',
        size: 150,
        enableEditing: true,
        Edit: ({ row, cell }) => {
          const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
          return (
            <DatePicker
              value={initialValue}
              label={'Datum ugradnje'}
              sx={{ width: '100%' }}
              slotProps={{
                textField: {
                  variant: 'standard',
                },
              }}
              onChange={(newDate) => {
                row._valuesCache['datum_ugradnje'] = newDate?.format('YYYY-MM-DD');
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
        accessorKey: 'adresa',
        header: 'Ulica',
        size: 150,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Ulica"
              value={cell.getValue() as string}
              endpoint={`${API_BASE}/api/house-council/search/addresses`}
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
        accessorKey: 'broj_clanova_KS',
        header: 'Broj Članova KS',
        size: 100,
      },
      {
        accessorKey: 'broj_potrosaca_KS',
        header: 'Broj Potrošača KS',
        size: 100,
      },
      {
        accessorKey: 'prim_MM',
        header: 'Primarno merno mesto',
        size: 300,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          const excludeId = row._valuesCache['idmm'] as string;
          return (
            <SearchList
              label="Primarno merno mesto"
              value={cell.getValue() as string}
              endpoint={`${API_BASE}/api/house-council/search/measuring-points`}
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
        accessorKey: 'naselje',
        header: 'Naselje',
        size: 150,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Naselje"
              value={cell.getValue() as string}
              endpoint={`${API_BASE}/api/house-council/search/cities`}
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
        accessorKey: 'broj',
        header: 'Kućni broj',
        size: 100,
      },
    ],
    []
  );

  const handleCreate = async () => {
    try {
      const datumUgradnjeFormatted = date ? dayjs(date).format('YYYY-MM-DD') : '';

      const newData = {
        idmm: selectedIDMM || '',
        adresa: selectedAdress || '',
        naselje: selectedCity || '',
        datum_ugradnje: datumUgradnjeFormatted,
        broj_clanova_KS: brojClanovaKSRef.current?.value || '',
        broj_potrosaca_KS: brojPotrosacaKSRef.current?.value || '',
        prim_MM: selectedPrimary || '',
        broj: brojRef.current?.value || '',
      };

      await fetchAPI(`${API_BASE}/api/house-council`, {
        method: 'POST',
        data: newData,
      });

      await fetchHouseCouncilRows();
      toast.success('Kućni savet je uspešno dodat');
      setIsAddModalOpen(false);

      setSelectedIDMM(null);
      setSelectedAdress(null);
      setSelectedCity(null);
      setSelectedPrimary(null);
      setDate(null);
    } catch (error) {
      console.error('Error creating house council:', error);
      toast.error('Došlo je do greške prilikom dodavanja kućnog saveta');
    }
  };

  const renderAddModal = () => (
    <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>Dodaj kućni savet</DialogTitle>
      <DialogContent sx={{ padding: '24px', overflow: 'scroll' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1.5rem',
          }}
        >
          <SearchList
            endpoint={`${API_BASE}/api/house-council/search/measuring-points`}
            label="ID mernog mesta"
            multiple={false}
            onChange={(newValue) => {
              setSelectedIDMM(newValue);
            }}
          />

          <SearchList
            endpoint={`${API_BASE}/api/house-council/search/addresses`}
            label="Ulica"
            multiple={false}
            onChange={(newValue) => {
              setSelectedAdress(newValue);
            }}
          />

          <SearchList
            endpoint={`${API_BASE}/api/house-council/search/cities`}
            label="Naselje"
            multiple={false}
            onChange={(newValue) => {
              setSelectedCity(newValue);
            }}
          />

          <DatePicker
            value={date}
            label="Datum ugradnje"
            onChange={(newDate) => {
              // @ts-expect-error asfasf
              setDate(newDate);
            }}
            slotProps={{
              textField: {
                variant: 'standard',
                fullWidth: true,
              },
            }}
          />

          <Input inputRef={brojClanovaKSRef} autoComplete="off" name="broj_clanova_KS" label="Broj članova KS" fullWidth variant="standard" />

          <Input inputRef={brojPotrosacaKSRef} autoComplete="off" name="broj_potrosaca_KS" label="Broj potrošača KS" fullWidth variant="standard" />

          <SearchList
            endpoint={`${API_BASE}/api/house-council/search/measuring-points`}
            label="Primarno merno mesto"
            multiple={false}
            onChange={(newValue) => {
              setSelectedPrimary(newValue);
            }}
          />

          <Input inputRef={brojRef} autoComplete="off" name="broj" label="Kućni broj" fullWidth variant="standard" />
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
  const handleSaveMM: MRT_TableOptions<HouseCouncil>['onEditingRowSave'] = async ({ values, table, row }) => {
    try {
      const id = row.original.id;
      await fetchAPI(`${API_BASE}/api/house-council/${id}`, {
        method: 'PATCH',
        data: values,
      });

      toast.success('Kućni savet je uspešno izmenjen');
      await fetchHouseCouncilRows();
    } catch (error) {
      console.error('Error updating house council:', error);
      toast.error('Došlo je do greške prilikom izmene kućnog saveta');
    }

    table.setEditingRow(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await fetchAPI(`${API_BASE}/api/house-council/${id}`, {
        method: 'DELETE',
      });

      await fetchHouseCouncilRows();
      toast.success('Kućni savet je uspešno obrisan');
    } catch (error) {
      console.error('Error deleting house council:', error);
      toast.error('Greška prilikom deaktivacije kućnog saveta');
    }
  };

  const openDeleteConfirmModal = (row: MRT_Row<HouseCouncil>) => {
    if (window.confirm('Da li ste sigurni da želite da obrišete ovaj kućni savet?')) {
      handleDelete(row.original.id);
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    editDisplayMode: 'modal',
    enableEditing: true,
    initialState: {
      density: 'compact',
    },
    getRowId: (row) => String(row.id),
    muiToolbarAlertBannerProps: undefined,
    onEditingRowSave: handleSaveMM,
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
      <Dialog open={true} onClose={() => table.setEditingRow(null)} maxWidth="md" fullWidth>
        <DialogTitle variant="h4">Izmena kućnog saveta</DialogTitle>
        <DialogContent sx={{ padding: '24px', overflow: 'scroll' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem',
            }}
          >
            {internalEditComponents}
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
            onClick={() => table.setEditingRow(row)}
          >
            <EditIcon />
          </Button>
        </Tooltip>
        <Tooltip title="Obriši">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="error"
            onClick={() => openDeleteConfirmModal(row)}
          >
            <DeleteIcon />
          </Button>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" onClick={() => setIsAddModalOpen(true)}>
        Dodaj kućni savet
      </Button>
    ),
    state: {
      isLoading: isLoadingData,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
      {renderAddModal()}
    </Main>
  );
};

export default HouseCouncilPage;
