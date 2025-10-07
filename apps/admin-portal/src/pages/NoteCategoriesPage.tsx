import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_Row, MRT_TableInstance, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { NoteCategory } from '@/types/notes';
import { toast } from 'react-toastify';
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { fetchPostData } from '@/utils/fetchUtil';

const CONTROLLER = '../NoteCategoriesController';

export const NoteCategoriesPage = ({ title }: { title: string }) => {
  const [isFetching, setIsFetching] = useState(true);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const columns = useMemo<MRT_ColumnDef<NoteCategory>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Kategorija',
        size: 100,
      },
    ],
    []
  );

  const fetchCategories = async () => {
    try {
      setIsFetching(true);
      const data = await fetchPostData(CONTROLLER + '/getAll');
      setCategories(data);
    } catch (err) {
      console.log(err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate: MRT_TableOptions<NoteCategory>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsSaving(true);
      const res = await fetchPostData(CONTROLLER + '/addRow', values);
      if (!res.success) {
        throw new Error('Neuspešan unos podataka');
      }
      setCategories((prev) => [res.data, ...prev]);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave: MRT_TableOptions<NoteCategory>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      setIsSaving(true);
      values['id'] = row.original.id;
      const res = await fetchPostData(CONTROLLER + '/editRow', values);
      if (!res.success) {
        throw new Error(res.error || 'Neuspešna izmena podataka');
      }
      setCategories((prev) => prev.map((x) => (x.id === row.original.id ? res.data : x)));
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: MRT_Row<NoteCategory>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsSaving(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id: row.original.id });
        setCategories((state) => state.filter((x) => x.id !== row.original.id));
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleEditClose = (table: MRT_TableInstance<NoteCategory>) => {
    table.setEditingRow(null);
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: categories,
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
      isSaving: isSaving,
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
