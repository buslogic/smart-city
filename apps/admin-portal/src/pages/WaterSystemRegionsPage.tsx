import { useEffect, useState } from 'react';
import {
  MaterialReactTable,
  MRT_EditActionButtons,
  MRT_Row,
  MRT_TableOptions,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import useWaterSystemRegions, { Region, SystemStreet } from '@/hooks/useWaterSystemRegions';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import React from 'react';

export const WaterSystemRegionsPage = ({ title }: { title: string }) => {
  const {
    regions,
    columns,
    fetchData,
    createRow,
    deleteRow,
    updateRow,
    isCreating,
    isDeleting,
    isFetching,
    isUpdating,
    streetColumns,
    removeStreet,
    getStreetsByRegion,
  } = useWaterSystemRegions();

  const [streetsRefetchTrigger, setStreetsRefetchTrigger] = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [streets, setStreets] = useState<SystemStreet[]>([]);
  const [loadingStreets, setLoadingStreets] = useState(false);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedRegionId) {
      loadStreets(selectedRegionId);
    }
  }, [selectedRegionId, streetsRefetchTrigger]);

  const loadStreets = async (regionId: number) => {
    setLoadingStreets(true);
    try {
      const data = await getStreetsByRegion(regionId);
      setStreets(data);
    } finally {
      setLoadingStreets(false);
    }
  };

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
      await updateRow(values as Region);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<Region>) => {
    if (
      window.confirm('Da li potvrđujete brisanje? Ovim će sve ulice koje su pripadale ovom rejonu biti uklonjene iz njega.')
    ) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const handleRemoveStreet = async (streetId: number) => {
    if (window.confirm('Da li potvrđujete uklanjanje ulice?')) {
      try {
        await removeStreet(streetId);
        toast.success('Uspešno uklanjanje ulice iz rejona');
        setStreetsRefetchTrigger((prev) => prev + 1);
      } catch (err: any) {
        toast.error(err.message || 'Došlo je do greške pri brisanju');
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
      columnVisibility: { id: false },
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

          {/* Prikaz ulica u rejonu */}
          <Box sx={{ mt: 2 }}>
            <h3>Ulice u rejonu</h3>
            {loadingStreets ? (
              <p>Učitavanje...</p>
            ) : (
              <MaterialReactTable
                columns={streetColumns}
                data={streets}
                enableRowActions
                renderRowActions={({ row: streetRow }) => (
                  <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                    <Tooltip title="Ukloni">
                      <Button
                        size="small"
                        color="error"
                        variant="contained"
                        onClick={() => handleRemoveStreet(streetRow.original.id)}
                      >
                        <DeleteIcon />
                      </Button>
                    </Tooltip>
                  </Box>
                )}
              />
            )}
          </Box>
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
              onClick={() => {
                setSelectedRegionId(row.original.id);
                table.setEditingRow(row);
              }}
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
      </Box>
    ),
    state: {
      isLoading: isFetching,
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box sx={{ maxWidth: '720px', margin: 'auto' }}>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default WaterSystemRegionsPage;
