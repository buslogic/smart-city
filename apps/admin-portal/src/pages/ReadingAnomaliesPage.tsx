import { useEffect } from 'react';
import { MaterialReactTable, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import useReadingAnomalies, { ReadingAnomaly } from '@/hooks/useReadingAnomalies';

export const ReadingAnomaliesPage = ({ title }: { title: string }) => {
  const {
    columns,
    anomalies,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    fetchData,
    createRow,
    updateRow,
    deleteRow,
  } = useReadingAnomalies();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate: MRT_TableOptions<ReadingAnomaly>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values as ReadingAnomaly);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message || 'Došlo je do greške');
    }
  };

  const handleUpdate: MRT_TableOptions<ReadingAnomaly>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      await updateRow({ ...values, id: row.original.id } as ReadingAnomaly);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message || 'Došlo je do greške');
    }
  };

  const handleDelete = async (row: MRT_Row<ReadingAnomaly>) => {
    if (window.confirm('Da li potvrđujete brisanje?')) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        toast.error('Došlo je do greške');
      }
    }
  };

  const table = useMaterialReactTable({
    columns,
    data: anomalies,
    ...globalTableProps,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    initialState: { columnVisibility: { id: false } },
    muiTableBodyCellProps: muiTableBodyCellPropsRowEditStyles,
    enableEditing: true,
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
      <Box>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default ReadingAnomaliesPage;
