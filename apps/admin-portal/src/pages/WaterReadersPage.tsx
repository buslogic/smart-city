import React, { useEffect } from 'react';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableInstance, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, Tooltip, Typography } from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { toast } from 'react-toastify';
import useWaterReaders, { AddressReader, RegionReader, WaterReader } from '@/hooks/useWaterReaders';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';

export const WaterReadersPage = ({ title }: { title: string }) => {
  const {
    fetchData,
    createRow,
    deleteRow,
    updateRow,
    isCreating,
    readers,
    columns,
    isDeleting,
    isFetching,
    isUpdating,
    regionColumns,
    addressColumns,
    removeReaderRegion,
    removeReaderAddress,
    assignReaderAddress,
    assignReaderRegion,
  } = useWaterReaders();

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<WaterReader>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleUpdate: MRT_TableOptions<WaterReader>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;
      await updateRow(values);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleDelete = async (row: MRT_Row<WaterReader>) => {
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

  const handleRemoveRegion = async (table: MRT_TableInstance<WaterReader>, row: MRT_Row<RegionReader>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        await removeReaderRegion(row.original);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      } finally {
        table.setCreatingRow(null);
      }
    }
  };

  const handleRemoveAddress = async (table: MRT_TableInstance<WaterReader>, row: MRT_Row<AddressReader>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        await removeReaderAddress(row.original);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      } finally {
        table.setCreatingRow(null);
      }
    }
  };

  const handleAssignAddress = async (
    { table, values }: { table: MRT_TableInstance<AddressReader>; row: MRT_Row<AddressReader>; values: any },
    readerId: number
  ) => {
    try {
      values.id = readerId;
      await assignReaderAddress(values);
      toast.success('Uspešno čuvanje podataka');
    } catch (err) {
      console.log(err);
      toast('Došlo je do greške');
    } finally {
      table.setCreatingRow(null);
    }
  };

  const handleAssignRegion = async (
    { table, values }: { table: MRT_TableInstance<RegionReader>; row: MRT_Row<RegionReader>; values: any },
    readerId: number
  ) => {
    try {
      values.id = readerId;
      await assignReaderRegion(values);
      toast.success('Uspešno čuvanje podataka');
    } catch (err) {
      console.log(err);
      toast('Došlo je do greške');
    } finally {
      table.setCreatingRow(null);
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns: columns,
    data: readers,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false, region_ids: false, address_ids: false },
    },
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Unos
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => {
      const reader = readers.find((reader) => reader.id === row.original.id);
      if (!reader) {
        return <Box>Došlo je do greške!</Box>;
      }

      const addressReaderTable = useMaterialReactTable({
        ...globalTableProps,
        columns: addressColumns,
        data: reader.addresses,
        enableEditing: false,
        enableRowActions: true,
        renderRowActions: ({ row }) => (
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleRemoveAddress(table, row)}
            >
              <Delete />
            </Button>
          </Tooltip>
        ),
        onCreatingRowSave: (data) => handleAssignAddress(data, reader.id),
        renderTopToolbarCustomActions: ({ table }) => (
          <Button variant="contained" color="primary" startIcon={<Add />} onClick={() => table.setCreatingRow(true)}>
            Dodeli ulicu
          </Button>
        ),
      });

      const regionReaderTable = useMaterialReactTable({
        ...globalTableProps,
        columns: regionColumns,
        data: reader.regions,
        enableEditing: false,
        enableRowActions: true,
        renderRowActions: ({ row }) => (
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleRemoveRegion(table, row)}
            >
              <Delete />
            </Button>
          </Tooltip>
        ),
        onCreatingRowSave: (data) => handleAssignRegion(data, reader.id),
        renderTopToolbarCustomActions: ({ table }) => (
          <Button variant="contained" color="primary" startIcon={<Add />} onClick={() => table.setCreatingRow(true)}>
            Dodeli rejon
          </Button>
        ),
      });
      return (
        <Dialog open={true} maxWidth="lg" fullWidth>
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
            <Grid container spacing={3}>
              {React.Children.map(internalEditComponents, (child, index) => (
                <Grid item xs={4} key={index}>
                  {child}
                </Grid>
              ))}
            </Grid>
            <Divider style={{ margin: '16px 0' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 4 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" align="center" sx={{ textDecoration: 'underline' }}>
                  Rejoni
                </Typography>
                <MaterialReactTable table={regionReaderTable} />
              </Box>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" align="center" sx={{ textDecoration: 'underline' }}>
                  Ulice
                </Typography>
                <MaterialReactTable table={addressReaderTable} />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </DialogActions>
        </Dialog>
      );
    },
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
              <Edit />
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
              <Delete />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        variant="contained"
        color="primary"
        startIcon={<Add />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Dodaj
      </Button>
    ),
    state: {
      isLoading: isFetching,
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default WaterReadersPage;
