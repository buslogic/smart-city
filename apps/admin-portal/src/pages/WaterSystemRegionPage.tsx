import { useEffect, useState } from 'react';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { exportCSV, importCSV } from '@/utils/csv';
import { FileDownload, FileUpload } from '@mui/icons-material';
import useWaterSystemRegion, { Region } from '@/hooks/useWaterSystemRegion';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { GenericTable } from '@/components/ui/GenericTable';
import React from 'react';
import { SystemStreet } from '@/hooks/useWaterSystemStreets';

export const WaterSystemRegionPage = ({ title }: { title: string }) => {
  const { regions, columns, fetchData, createRow, deleteRow, updateRow, isCreating, isDeleting, isFetching, isUpdating, streetColumns, removeStreet } = useWaterSystemRegion();
  const [isImportCSVLoading, setIsImportCSVLoading] = useState<boolean>(false);
  const [isExportCSVLoading, setIsExportCSVLoading] = useState<boolean>(false);
  const [streetsRefetchTrigger, setStreetsRefetchTrigger] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<Region>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<Region>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;
      await updateRow(values);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<Region>) => {
    if (window.confirm('Da li potvrdjujete brisanje? Ovim će sve ulice koje su pripadale ovom rejonu biti uklonjene iz njega.')) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      }
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: regions,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false, city_id: false, address_id: false },
    },
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Dodavanje novog rejona
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderEditRowDialogContent: ({ table, internalEditComponents, row }) => (
      <Dialog open={true} maxWidth="lg" fullWidth>
        <DialogTitle variant="h4">Izmena rejona</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            padding: '24px',
            overflow: 'scroll',
          }}
        >
          <Grid container spacing={3}>
            {React.Children.map(internalEditComponents, (child, index) => (
              <Grid item xs={12} key={index} sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                {child}
              </Grid>
            ))}
          </Grid>
          <GenericTable<SystemStreet>
            title="Ulice"
            fetchUrl="../WaterSystemRegionController/getStreetsByRegion"
            fetchParams={{ regionId: row.original.id }}
            columns={streetColumns}
            enableDelete={true}
            onDelete={async (deletedRow: MRT_Row<SystemStreet>) => {
              if (window.confirm('Da li potvrđujete uklanjanje ulice?')) {
                try {
                  const streetId = deletedRow.original.id;
                  await removeStreet(streetId);
                  toast.success('Uspešno uklanjanje ulice iz rejona');
                  setStreetsRefetchTrigger(prev => prev + 1);
                } catch (err: any) {
                  toast.error(err.message || 'Došlo je do greške pri brisanju');
                }
              }
            }}
            key={`streets-${row.original.id}-${streetsRefetchTrigger}`}
          />
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Dialog>
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
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsImportCSVLoading(true);
    const res = await importCSV(e, '../WaterSystemRegionController/importCSV');
    if (res?.success) {
      fetchData();
      toast.success('Uspešan uvoz');
    } else {
      toast.error('Došlo je do greške');
    }
    setTimeout(() => {
      setIsImportCSVLoading(false);
    }, 6000);
  };

  const handleExportCSV = async () => {
    try {
      setIsExportCSVLoading(true);
      await exportCSV('../WaterSystemRegionController/exportCSV', 'Rejoni.csv');
      toast.success('Uspešan izvoz');
      setIsExportCSVLoading(false);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške prilikom izvoza');
    }
  };

  return (
    <Main title={title}>
      <Box sx={{ maxWidth: '720px', margin: 'auto' }}>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default WaterSystemRegionPage;
