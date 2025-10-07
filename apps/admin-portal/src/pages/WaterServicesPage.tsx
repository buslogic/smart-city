import { useEffect } from 'react';
import { MaterialReactTable, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import useWaterServices from '@/hooks/useWaterServices';
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { WaterService } from '@/types/finance';

export const WaterServicesPage = ({ title }: { title: string }) => {
  const { service, columns, fetchData, createRow, deleteRow, updateRow, isCreating, isDeleting, isFetching, isUpdating } = useWaterServices();

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<WaterService>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<WaterService>['onEditingRowSave'] = async ({ values, row }) => {
    try {
      values['id'] = row.original.id;
      await updateRow(values);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<WaterService>) => {
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

  const table = useMaterialReactTable({
    columns,
    data: service,
    ...globalTableProps,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    muiTableBodyCellProps: muiTableBodyCellPropsRowEditStyles,
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false, code: false },
    },
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
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
    <Main title={title}>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default WaterServicesPage;
