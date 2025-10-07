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
import { fetchPostData } from '@/utils/fetchUtil';

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
      const data = await fetchPostData('../WaterSystemCitiesController/getRows');
      console.log(data);
      setIsFetching(false);
      setData(data);
      console.log(data);
    } catch (err: any) {
      console.log(err);
      toast.error('Doslo je do greske');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<SystemCity>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsSaving(true);
      const { success, data } = await fetchPostData('../WaterSystemCitiesController/create', values);
      setIsSaving(false);
      if (success) {
        setData((x) => [data, ...x]);
        toast.success('Uspešno unošenje podataka');
      } else {
        toast.error('Došlo je do greške prilikom čuvanja podataka');
      }
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<SystemCity>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;
      setIsSaving(true);
      const { success, data } = await fetchPostData('../WaterSystemCitiesController/update', values);
      console.log(data);
      table.setEditingRow(null);
      setIsSaving(false);
      if (success) {
        setData((p) => p.map((x) => (x.id === values.id ? data : x)));
        toast.success('Uspešna izmena podataka');
      } else {
        toast.error('Neuspešna izmena podataka');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<SystemCity>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsSaving(true);
        const res = await fetchPostData('../WaterSystemCitiesController/delete', { id: row.original.id });
        if (res) {
          setIsSaving(false);
          setData((x) => x.filter((x) => x.id !== row.original.id));
          toast.success('Uspešno brisanje podataka');
        }
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      }
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsImportCSVLoading(true);
    const res = await importCSV(e, '../WaterSystemCitiesController/importCSV');
    setIsImportCSVLoading(false);
    if (res?.success) {
      fetchData();
      toast.success('Uspešan uvoz');
    } else {
      toast.error('Došlo je do greške');
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExportCSVLoading(true);
      await exportCSV('../WaterSystemCitiesController/exportCSV', 'Gradovi.csv');
      toast.success('Uspešan izvoz');
      setIsExportCSVLoading(false);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške prilikom izvoza');
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
        <Button variant="contained" color="success" startIcon={<FileUpload />} component="label" loading={isImportCSVLoading}>
          Uvoz iz CSV
          <input accept=".csv" type="file" hidden onChange={handleImportCSV} />
        </Button>
        <Button variant="contained" color="warning" startIcon={<FileDownload />} onClick={handleExportCSV} loading={isExportCSVLoading}>
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
