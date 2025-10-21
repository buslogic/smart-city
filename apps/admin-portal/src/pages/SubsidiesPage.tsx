import Main from '@/components/ui/Main';
import useSubsidies from '@/hooks/useSubsidies';
import { Subsidy } from '@/types/subsidies';
import { globalTableProps } from '@/utils/globalTableProps';
import { Add, Delete, Edit } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { GenericTable } from '@/components/ui/GenericTable';
import { HistoryRow } from '@/types/water-meter';

export const SubsidiesPage = ({ title }: { title: string }) => {
  const { fetchData, createRow, deleteRow, updateRow, isCreating, subsidies, columns, isDeleting, isFetching, isUpdating, historyColumns } = useSubsidies();
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenHistoryModal = (rowId: number) => {
    setSelectedRowId(rowId);
    setIsHistoryModalOpen(true);
  };
  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedRowId(null);
  };

  const handleCreate: MRT_TableOptions<Subsidy>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      await createRow(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleUpdate: MRT_TableOptions<Subsidy>['onEditingRowSave'] = async ({ values, row, table }) => {
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

  const handleDelete = async (row: MRT_Row<Subsidy>) => {
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
    ...globalTableProps,
    columns: columns,
    data: subsidies,
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
      const reader = subsidies.find((reader) => reader.id === row.original.id);
      if (!reader) {
        return <Box>Došlo je do greške!</Box>;
      }

      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
            Izmena (ID: {row.original.id})
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {internalEditComponents}
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </DialogActions>
        </Box>
      );
    },
    renderRowActions: ({ row, table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Istorija promena">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto', backgroundColor: 'lightsteelblue' }}
              size="small"
              variant="contained"
              onClick={() => handleOpenHistoryModal(row.original.id)}
            >
              <ChangeHistoryIcon />
            </Button>
          </Tooltip>
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
      <Dialog open={isHistoryModalOpen} onClose={handleCloseHistoryModal} maxWidth="lg" fullWidth>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Istorija promena (ID: {selectedRowId})
        </DialogTitle>
        <DialogContent>
          {selectedRowId && (
            <GenericTable<HistoryRow>
              title="Istorija promena subvencija"
              fetchUrl={`${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/subsidies/history/${selectedRowId}`}
              fetchParams={{}}
              columns={historyColumns}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryModal} color="primary">
            Zatvori
          </Button>
        </DialogActions>
      </Dialog>
    </Main>
  );
};

export default SubsidiesPage;
