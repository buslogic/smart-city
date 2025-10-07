import Main from '@/components/ui/Main';
import useReadingLists from '@/hooks/useReadingLists';
import { ReadingLists } from '@/types/billing-campaign';
import { globalTableProps } from '@/utils/globalTableProps';
import { Add, Delete, Edit } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import ArchiveIcon from '@mui/icons-material/Archive';
export const ReadingListsPage = ({ title }: { title: string }) => {
    const { fetchData, createRow, deleteRow, archiveRow, updateRow, isCreating, readingLists, columns, isDeleting, isFetching, isUpdating } = useReadingLists();

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate: MRT_TableOptions<ReadingLists>['onCreatingRowSave'] = async ({ values, table }) => {
        try {
            await createRow(values);
            toast.success('Uspešno unošenje podataka');
            table.setCreatingRow(null);
        } catch (err: any) {
            console.log(err);
            toast.error('Došlo je do greške!');
        }
    };

    const handleUpdate: MRT_TableOptions<ReadingLists>['onEditingRowSave'] = async ({ values, row, table }) => {
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

    const handleDelete = async (row: MRT_Row<ReadingLists>) => {
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


    const handleArchive = async (row: MRT_Row<ReadingLists>) => {
        if (window.confirm('Da li potvrdjujete arhiviranje?')) {
            try {
                await archiveRow(row.original.id);
                toast.success('Uspešno arhiviranje podataka');
            } catch (err) {
                console.log(err);
                toast('Došlo je do greške');
            }
        }
    };

    const table = useMaterialReactTable({
        ...globalTableProps,
        columns: columns,
        data: readingLists,
        createDisplayMode: 'modal',
        editDisplayMode: 'modal',
        enableEditing: true,
        getRowId: (row) => String(row.id),
        initialState: {
            columnVisibility: { id: false },
        },
        onEditingRowCancel: ({ table }) => table.setEditingRow(null),
        onCreatingRowSave: handleCreate,
        onEditingRowSave: handleUpdate,
        renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => {
            if (!row._valuesCache['datum_kreiranja']) {
                row._valuesCache['datum_kreiranja'] = dayjs().format('YYYY-MM-DD');
            }
            if (!row._valuesCache['status_id']) {
                row._valuesCache['status_id'] = `1 | U izradi`;
            }

            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
                        Unos
                    </DialogTitle>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
                    <DialogActions>
                        <MRT_EditActionButtons variant="text" table={table} row={row} />
                    </DialogActions>
                </Box>
            )
        },
        renderEditRowDialogContent: ({ table, row, internalEditComponents }) => {

            return (
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
            );
        },
        renderRowActions: ({ row, table }) => {
            return (
                <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Tooltip title="Arhiviranje">
                        <Button
                            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
                            size="small"
                            variant="contained"
                            color="warning"
                            onClick={() => handleArchive(row)}
                        >
                            <ArchiveIcon />
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
        </Main>
    );
};

export default ReadingListsPage;
