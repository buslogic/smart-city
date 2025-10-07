import Main from '@/components/ui/Main';
import useReplacementWaterMeters from '@/hooks/useReplacementWaterMeters';
import { WaterMeter } from '@/types/water-meter';
import { globalTableProps } from '@/utils/globalTableProps';
import { Delete, Edit } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Tooltip } from '@mui/material';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import React, { useEffect } from 'react';
import { toast } from 'react-toastify';

export const ReplacementWaterMetersPage = ({ title }: { title: string }) => {
    const { fetchData, deleteRow, updateRow, replacementWaterMeters, columns, isDeleting, isFetching, isUpdating } = useReplacementWaterMeters();

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdate: MRT_TableOptions<WaterMeter>['onEditingRowSave'] = async ({ values, row, table }) => {
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

    const handleDelete = async (row: MRT_Row<WaterMeter>) => {
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
        data: replacementWaterMeters,
        createDisplayMode: 'modal',
        editDisplayMode: 'modal',
        enableEditing: true,
        getRowId: (row) => String(row.id),
        initialState: {
            columnVisibility: { id: false },
        },
        onEditingRowCancel: ({ table }) => table.setEditingRow(null),
        onEditingRowSave: handleUpdate,
        renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
            <Dialog open={true} maxWidth="lg" fullWidth>
                <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
                    Izmena (ID: {row.original.id})
                </DialogTitle>
                <DialogContent
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        padding: '24px',
                        overflow: 'scroll',
                    }}
                >
                    <Grid container spacing={3}>
                        {React.Children.map(internalEditComponents, (child, index) => (
                            <Grid item xs={4} key={index}>
                                {child}
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <MRT_EditActionButtons variant="text" table={table} row={row} />
                </DialogActions>
            </Dialog>
        ),
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
        state: {
            isLoading: isFetching,
            isSaving: isUpdating || isDeleting,
            showProgressBars: isFetching,
        },
    });

    return (
        <Main title={title}>
            <MaterialReactTable table={table} />
        </Main>
    );
};

export default ReplacementWaterMetersPage;
