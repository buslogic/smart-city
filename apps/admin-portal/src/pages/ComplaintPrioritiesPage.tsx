import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { fetchAPI } from '@/utils/fetchUtil';
import { toast } from 'react-toastify';

type ComplaintPriority = {
  id: number;
  prioritet: string;
};

export const ComplaintPrioritiesPage = ({ title }: { title: string }) => {
  const [isFetching, setIsFetching] = useState(true);
  const [data, setData] = useState<ComplaintPriority[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchPriorities() {
    try {
      setIsFetching(true);
      const data = await fetchAPI<ComplaintPriority[]>('/api/complaints/priorities/all', {
        method: 'GET',
      });
      setData(data);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchPriorities();
  }, []);

  const handleCreate: MRT_TableOptions<ComplaintPriority>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsCreating(true);
      const newPriority = await fetchAPI<ComplaintPriority>('/api/complaints/priorities', {
        method: 'POST',
        data: values,
      });
      setData((prev) => [newPriority, ...prev]);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message || 'Došlo je do greške prilikom unošenja podataka');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate: MRT_TableOptions<ComplaintPriority>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      setIsUpdating(true);
      const updatedPriority = await fetchAPI<ComplaintPriority>(`/api/complaints/priorities/${row.original.id}`, {
        method: 'PATCH',
        data: values,
      });
      setData((prev) => prev.map((x) => (x.id === row.original.id ? updatedPriority : x)));
      toast.success('Uspešna izmena podataka');
      table.setEditingRow(null);
    } catch (err: any) {
      toast.error(err.message || 'Došlo je do greške prilikom izmene podataka');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (row: MRT_Row<ComplaintPriority>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsDeleting(true);
        await fetchAPI(`/api/complaints/priorities/${row.original.id}`, {
          method: 'DELETE',
        });
        setData((state) => state.filter((x) => x.id !== row.original.id));
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const columns = useMemo<MRT_ColumnDef<ComplaintPriority>[]>(
    () => [
      {
        accessorKey: 'prioritet',
        header: 'Prioritet',
        size: 100,
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data,
    ...globalTableProps,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    muiTableBodyCellProps: muiTableBodyCellPropsRowEditStyles,
    enableEditing: true,
    getRowId: (row) => String(row.id),
    // positionActionsColumn: 'last',
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
      <Box sx={{ maxWidth: '720px', margin: 'auto' }}>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default ComplaintPrioritiesPage;
