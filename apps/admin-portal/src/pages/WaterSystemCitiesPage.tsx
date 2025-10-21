import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { exportCSV, importCSV } from '@/utils/csv';
import { FileDownload, FileUpload } from '@mui/icons-material';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { api } from '@/services/api';

type SystemCity = {
  id: number;
  cities_name: string;
  edit_datetime: string;
  edit_user_Id: number;
  cities_zip_code: number;
};

export const WaterSystemCitiesPage = ({ title }: { title: string }) => {
  const [isImportCSVLoading, setIsImportCSVLoading] = useState<boolean>(false);
  const [isExportCSVLoading, setIsExportCSVLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<SystemCity[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const fetchData = async () => {
    try {
      setIsFetching(true);
      const response = await api.get('/api/water-system-cities');
      setData(response.data);
    } catch (err: any) {
      console.error(err);
      toast.error('Došlo je do greške');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<SystemCity>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsSaving(true);
      const { id, ...createData } = values;
      const response = await api.post('/api/water-system-cities', createData);
      const { success, data } = response.data;
      if (success) {
        setData((x) => [data, ...x]);
        toast.success('Uspešno unošenje podataka');
      } else {
        toast.error('Došlo je do greške prilikom čuvanja podataka');
      }
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate: MRT_TableOptions<SystemCity>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      setIsSaving(true);
      const id = row.original.id;
      const { id: _, edit_datetime, edit_user_Id, ...updateData } = values;
      const response = await api.put(`/api/water-system-cities/${id}`, updateData);
      const { success, data } = response.data;
      table.setEditingRow(null);
      if (success) {
        setData((p) => p.map((x) => (x.id === id ? data : x)));
        toast.success('Uspešna izmena podataka');
      } else {
        toast.error('Neuspešna izmena podataka');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: MRT_Row<SystemCity>) => {
    if (window.confirm('Da li potvrđujete brisanje?')) {
      try {
        setIsSaving(true);
        await api.delete(`/api/water-system-cities/${row.original.id}`);
        setData((x) => x.filter((x) => x.id !== row.original.id));
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.error(err);
        toast.error('Došlo je do greške');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsImportCSVLoading(true);
    try {
      const res = await importCSV(e, '/api/water-system-cities/import-csv');
      if (res?.success) {
        fetchData();
        toast.success('Uspešan uvoz');
      } else {
        toast.error(res?.error || 'Došlo je do greške');
      }
    } catch (err) {
      console.error(err);
      toast.error('Došlo je do greške prilikom uvoza');
    } finally {
      setTimeout(() => {
        setIsImportCSVLoading(false);
      }, 1000);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExportCSVLoading(true);
      await exportCSV('/api/water-system-cities/export-csv', 'Gradovi.csv');
      toast.success('Uspešan izvoz');
    } catch (err) {
      console.error(err);
      toast.error('Došlo je do greške prilikom izvoza');
    } finally {
      setIsExportCSVLoading(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<SystemCity>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        Edit: () => <></>,
      },
      {
        accessorKey: 'cities_name',
        header: 'Naziv naselja',
        size: 100,
      },
      {
        accessorKey: 'cities_zip_code',
        header: 'Poštanski broj',
        size: 100,
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false },
    },
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Upisivanje
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderEditRowDialogContent: ({ table, internalEditComponents, row }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Izmena (ID: {row.original.id})
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderRowActions: ({ row, table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Izmena">
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
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleDelete(row)}
            >
              <DeleteIcon />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Box
        sx={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          Dodaj
        </Button>
        <Button variant="contained" color="success" startIcon={<FileUpload />} component="label" disabled={isImportCSVLoading}>
          Uvoz iz CSV
          <input accept=".csv" type="file" hidden onChange={handleImportCSV} />
        </Button>
        <Button variant="contained" color="warning" startIcon={<FileDownload />} onClick={handleExportCSV} disabled={isExportCSVLoading}>
          Izvoz u CSV
        </Button>
      </Box>
    ),
    state: {
      isLoading: isFetching,
      isSaving: isSaving,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default WaterSystemCitiesPage;
