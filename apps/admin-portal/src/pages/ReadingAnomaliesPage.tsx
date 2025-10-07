import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { fetchPostData } from '@/utils/fetchUtil';

type ReadingAnomaly = {
  id: number;
  status: string;
  description: string;
  created_at: string;
};

export const ReadingAnomaliesPage = ({ title }: { title: string }) => {
  const [rows, setRows] = useState<ReadingAnomaly[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function fetchRows() {
    try {
      setIsFetching(true);
      const data = await fetchPostData('../ReadingAnomaliesController/getAll');
      setIsFetching(false);
      setRows(data);
      console.log(data);
    } catch (err) {
      console.log(err);
      toast.error('Doslo je do greske');
    }
  }

  useEffect(() => {
    console.log(rows);
  }, [rows]);

  useEffect(() => {
    fetchRows();
  }, []);

  const handleCreate: MRT_TableOptions<ReadingAnomaly>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsSaving(true);
      console.log(values);
      const { success, data } = await fetchPostData('../ReadingAnomaliesController/create', values);
      setIsSaving(false);

      if (!success) {
        throw new Error('Doslo je do greske');
      }

      setRows((prev) => [data, ...prev]);

      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<ReadingAnomaly>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      values['id'] = row.original.id;

      setIsSaving(true);
      const { data, error } = await fetchPostData('../ReadingAnomaliesController/update', values);
      setIsSaving(false);

      if (error) {
        throw new Error('error');
      }

      setRows((prev) => prev.map((x) => (x.id === row.original.id ? data : x)));

      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
      console.log(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<ReadingAnomaly>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsSaving(true);
        await fetchPostData('../ReadingAnomaliesController/delete', { id: row.original.id });
        setIsSaving(false);
        setRows((rows) => rows.filter((x) => x.id !== row.original.id));

        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const columns = useMemo<MRT_ColumnDef<ReadingAnomaly>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 100,
      },
      {
        accessorKey: 'description',
        header: 'Opis',
        size: 100,
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data: rows,
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
      isSaving: isSaving,
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
