import { GenericTable } from '@/components/ui/GenericTable';
import Main from '@/components/ui/Main';
import useComplaintsByAssigne from '@/hooks/useComplaintsByAssigne';
import { StatusHistory } from '@/types/complaints';
import { globalTableProps } from '@/utils/globalTableProps';
import { Edit } from '@mui/icons-material';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { MaterialReactTable, MRT_EditActionButtons, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export const ComplaintsByAssignePage = ({ title }: { title: string }) => {
    const { fetchData, updateRow, complaints, columns, isDeleting, isFetching, isUpdating, historyColumns } = useComplaintsByAssigne();
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

    const handleUpdate: MRT_TableOptions<StatusHistory>['onEditingRowSave'] = async ({ values, row, table }) => {
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

    const table = useMaterialReactTable({
        ...globalTableProps,
        columns: columns,
        data: complaints,
        editDisplayMode: 'modal',
        enableEditing: true,
        getRowId: (row) => String(row.id),
        initialState: {
            columnVisibility: { id: false, region_ids: false, address_ids: false },
        },
        onEditingRowCancel: ({ table }) => table.setEditingRow(null),
        onEditingRowSave: handleUpdate,
        renderEditRowDialogContent: ({ table, row, internalEditComponents }) => {
            const reader = complaints.find((reader) => reader.id === row.original.id);
            if (!reader) {
                return <Box>Došlo je do greške!</Box>;
            }

            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
                        Izmena
                    </DialogTitle>
                    <DialogContent
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                        }}
                    >
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
                            onClick={() => handleOpenHistoryModal(row.original.reklamacija_id)}
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
                </Box>
            );
        },
        state: {
            isLoading: isFetching,
            isSaving: isUpdating || isDeleting,
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
                        <GenericTable<StatusHistory>
                            title="Istorija promena statusa reklamacije"
                            fetchUrl="../ComplaintsByAssigneController/getStatusComplaintHistory"
                            fetchParams={{ reklamacija_id: selectedRowId }}
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

export default ComplaintsByAssignePage;
