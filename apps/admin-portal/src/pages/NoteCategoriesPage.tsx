import { useEffect } from 'react';
import { MaterialReactTable, MRT_Row, MRT_TableInstance, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { NoteCategory } from '@/types/notes';
import { toast } from 'react-toastify';
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import useNoteCategories from '@/hooks/useNoteCategories';

export const NoteCategoriesPage = ({ title }: { title: string }) => {
  const { fetchData, createRow, deleteRow, updateRow, isCreating, noteCategories, columns, isDeleting, isFetching, isUpdating } = useNoteCategories();

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<NoteCategory>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values as NoteCategory);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleSave: MRT_TableOptions<NoteCategory>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;
      await updateRow(values as NoteCategory);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleDelete = async (row: MRT_Row<NoteCategory>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const handleEditClose = (table: MRT_TableInstance<NoteCategory>) => {
    table.setEditingRow(null);
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: noteCategories,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    muiTableBodyCellProps: muiTableBodyCellPropsRowEditStyles,
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
    <Main title={title}>
      <Box sx={{ maxWidth: '720px', margin: 'auto' }}>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default NoteCategoriesPage;
