import { useEffect } from 'react';
import { MaterialReactTable, MRT_Row, MRT_TableInstance, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import useWMTypes from '../../hooks/useWMTypes';
import { WMType } from '../../types/water-meter';

export const WaterMeterTypesPage = () => {
  const { columns, fetchWMTypes, types, isDeleting, createItem, deleteItem, isCreating, isFetching, isUpdating, updateItem } = useWMTypes();

  useEffect(() => {
    fetchWMTypes();
  }, []);

  const handleCreate: MRT_TableOptions<WMType>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createItem(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave: MRT_TableOptions<WMType>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;
      await updateItem(values);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<WMType>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        await deleteItem(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const handleEditClose = (table: MRT_TableInstance<WMType>) => {
    table.setEditingRow(null);
  };

  const table = useMaterialReactTable({
    columns,
    data: types,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    initialState: {
      showColumnFilters: false,
      columnVisibility: { _id: false },
    },
    enableEditing: true,
    getRowId: (row) => String(row.id),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleSave,
    onEditingRowCancel: ({ table }) => handleEditClose(table),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
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
    ),
    renderTopToolbarCustomActions: ({ table }) => (
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
    ),
    state: {
      isLoading: isFetching,
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  return (
    <Box sx={{ padding: 3 }}>
      <Box sx={{ maxWidth: '720px', margin: 'auto' }}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
};

export default WaterMeterTypesPage;
