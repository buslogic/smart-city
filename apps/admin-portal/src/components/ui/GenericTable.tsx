import { Box, Button, Tooltip, Typography } from '@mui/material';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable, MRT_RowData, MRT_Row, MRT_TableOptions } from 'material-react-table';
import { useEffect, useState, useCallback } from 'react';
import { Add, Edit, Delete } from '@mui/icons-material';
import { fetchAPI } from '@/utils/fetchUtil';
import { toast } from 'react-toastify';
import { globalTableProps } from '@/utils/globalTableProps';

type GenericTableProps<T extends MRT_RowData> = {
  title?: string;
  fetchUrl: string;
  fetchParams?: Record<string, any>;
  columns: MRT_ColumnDef<T>[];
  enableCreate?: boolean;
  addButtonLabel?: string;
  onCreatingRowSave?: (values: any) => Promise<void>;
  enableDelete?: boolean;
  enableEdit?: boolean;
  onDelete?: (row: MRT_Row<T>) => void;
} & Partial<MRT_TableOptions<T>>;

export function GenericTable<T extends MRT_RowData>({
  title,
  fetchUrl,
  fetchParams = {},
  columns,
  addButtonLabel = 'DODAJ',
  onCreatingRowSave,
  enableCreate = false,
  enableDelete = false,
  enableEdit = false,
  onDelete,
  ...tableProps
}: GenericTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      setTimeout(() => {}, 3000);
      const res = await fetchAPI(fetchUrl, { method: 'POST', data: fetchParams });
      setData(res);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUrl, fetchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRowSave = async (values: any) => {
    if (onCreatingRowSave) {
      await onCreatingRowSave(values);
      fetchData();
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    state: {
      isLoading,
    },
    createDisplayMode: 'modal',
    enableEditing: enableDelete || enableEdit,
    onCreatingRowSave: handleRowSave,
    muiTableBodyCellProps: {
      align: 'center',
      sx: { textAlign: 'center' },
    },
    muiTableHeadCellProps: ({ column }) => {
      if (column.id === 'mrt-row-actions') {
        column.columnDef.header = 'Akcije';
      }
      return {
        align: 'center',
        sx: {
          textAlign: 'center',
        },
      };
    },
    renderRowActions: ({ row, table }) => (
      <Box>
        {enableEdit && (
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
        )}
        {enableDelete && (
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => {
                if (onDelete) {
                  onDelete(row);
                }
              }}
            >
              <Delete />
            </Button>
          </Tooltip>
        )}
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) =>
      enableCreate && (
        <Button variant="contained" color="primary" startIcon={<Add />} onClick={() => table.setCreatingRow(true)}>
          {addButtonLabel}
        </Button>
      ),
    ...tableProps,
  });

  return (
    <Box sx={{ width: '100%' }}>
      {title && (
        <Typography variant="h6" sx={{ marginBottom: '16px', fontWeight: 'bold', textDecoration: 'underline' }}>
          {title}
        </Typography>
      )}
      <MaterialReactTable table={table} />
    </Box>
  );
}
