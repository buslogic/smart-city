import { useEffect, useState } from 'react';
import {
  MaterialReactTable,
  MRT_EditActionButtons,
  MRT_Row,
  MRT_TableOptions,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, Button, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { FileDownload, FileUpload } from '@mui/icons-material';
import { toast } from 'react-toastify';
import useWaterSystemStreets, { Street } from '@/hooks/useWaterSystemStreets';
import { globalTableProps } from '@/utils/globalTableProps';
import { exportCSV, importCSV } from '@/utils/csv';
import Main from '@/components/ui/Main';

export const WaterSystemStreetsPage = ({ title }: { title: string }) => {
  const { fetchData, createRow, deleteRow, updateRow, isCreating, streets, columns, isDeleting, isFetching, isUpdating } =
    useWaterSystemStreets();
  const [isImportCSVLoading, setIsImportCSVLoading] = useState<boolean>(false);
  const [isExportCSVLoading, setIsExportCSVLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate: MRT_TableOptions<Street>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<Street>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;
      await updateRow(values as Street);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<Street>) => {
    if (window.confirm('Da li potvrđujete brisanje?')) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: streets,
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
          Dodavanje nove ulice
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
          Izmena ulice (ID: {row.original.id})
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
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsImportCSVLoading(true);
    try {
      const res = await importCSV(e, '/api/water-system-streets/import-csv');
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
      await exportCSV('/api/water-system-streets/export-csv', 'Ulice.csv');
      toast.success('Uspešan izvoz');
    } catch (err) {
      console.error(err);
      toast.error('Došlo je do greške prilikom izvoza');
    } finally {
      setIsExportCSVLoading(false);
    }
  };

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default WaterSystemStreetsPage;
