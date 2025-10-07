import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import usePayments from '@/hooks/usePayments';
import { Payments } from '@/types/cashRegister';
import { fetchPostData } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { Add, Remove } from '@mui/icons-material';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export const PaymentsPage = ({ title }: { title: string }) => {
    const { createRow, deleteRow, updateRow, isCreating, isDeleting, isUpdating, isFetching, fetchRows, fetchInactiveRows, payments, inactivePayments } = usePayments();
    const [usePaymentID, setPaymentID] = useState<number>();
    const [usePaymentName, setPaymentName] = useState<string>();
    const [selectedPayments, setSelectedPayments] = useState<{ [key: string]: string[] }>({});
    const [loggedUserId, setLoggedUserId] = useState<string>('');
    const [loggedUserName, setLoggedUserName] = useState<string>('');
    const [isShiftOpen, setIsShiftOpen] = useState<number>(0);
    const [useCashRegisterName, setCashRegisterName] = useState<string>('');
    const [useCashRegisterId, setCashRegisterId] = useState<string>('');
    const [useGotovina, setUseGotovina] = useState<number>(0);
    const [useKartica, setUseKartica] = useState<number>(0);
    const [useCek, setUseCek] = useState<number>(0);
    const [useVaucer, setUseVaucer] = useState<number>(0);

    useEffect(() => {
        const getLoggedUser = async () => {
            const data = await fetchPostData('../UserAccountController/getLoggedUser', {});
            if (data) {
                setLoggedUserId(data.id);
                setLoggedUserName(data.name);
            }
        };

        const getShiftStatus = async () => {
            const data = await fetchPostData('../CashiersSessionController/isSessionOpen', {});
            if (data) {
                setIsShiftOpen(data);
            }
        };

        const getCashRegister = async () => {
            const data = await fetchPostData('../PaymentsController/gdetCashRegister', {});
            if (data) {
                setCashRegisterId(data.id);
                setCashRegisterName(data.name);
            }
        };

        getLoggedUser();
        getShiftStatus();
        getCashRegister();
    }, []);

    async function handleFilterChange(value: string) {
        try {
            const parts = value.split('|');
            if (parts.length > 0) {
                const id = Number(parts[0].replace('ID:', '').trim());
                const name = String(parts[2]);
                if (!isNaN(id)) {
                    fetchRows(id);
                    fetchInactiveRows(id);
                    setPaymentID(id);
                    setPaymentName(name);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    const parseMethod = (v?: string | number) => {
        const s = v?.toString() ?? "";
        return s.includes(" | ") ? s.split(" | ")[1].trim() : s;
    };

    const columns = useMemo<MRT_ColumnDef<Payments>[]>(() => {
        return [
            {
                accessorKey: 'uplatilac_id',
                header: 'Ime uplatioca',
                size: 100,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Ime uplatioca"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../UserAccountController/getUserAccountsForSL'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'id_fakture',
                header: 'Broj fakture',
                size: 100,
                enableEditing: true,
            },
            {
                accessorKey: 'nacin_placanja_id',
                header: 'Način plaćanja',
                enableEditing: true,
                Edit: ({ row }) => {
                    const rowKey = (row.original as Payments).id?.toString() ?? row.id;

                    const value = row._valuesCache['nacin_placanja_id'] ??
                        (row.original.nacin_placanja_id
                            ? [row.original.nacin_placanja_id]
                            : []);

                    const paymentMethods = [
                        { value: "1", label: "Keš" },
                        { value: "2", label: "Kartica" },
                        { value: "3", label: "Ček" },
                        { value: "4", label: "Vaučer" },
                    ];

                    return (
                        <Autocomplete
                            multiple
                            options={paymentMethods}
                            getOptionLabel={(option) => option.label}
                            value={paymentMethods.filter(pm => value.includes(pm.value))}
                            onChange={(_, newValues) => {
                                const values = newValues.map(v => v.value);
                                const paymentNames = newValues.map(v => v.label);

                                setSelectedPayments(prev => ({ ...prev, [rowKey]: paymentNames }));

                                row._valuesCache['nacin_placanja_id'] = values;
                            }}
                            renderInput={(params) => (
                                <TextField {...params} label="Način plaćanja" />
                            )}
                        />
                    );
                }
            },
            {
                accessorKey: 'iznos_gotovina',
                header: 'Iznos gotovina',
                enableEditing: true,
                Edit: ({ row }) => {
                    const rowKey = (row.original as Payments).id?.toString() ?? row.id;
                    const methods = selectedPayments[rowKey] || [parseMethod(row.original.nacin_placanja_id)];
                    return (
                        <TextField
                            key={`got-${rowKey}-${methods.join(",")}`}
                            type="number"
                            defaultValue={row.original.iznos_gotovina}
                            label="Iznos gotovina"
                            size="small"
                            fullWidth
                            disabled={!methods.includes('Keš')}
                            onChange={(e) => {
                                row._valuesCache['iznos_gotovina'] = e.target.value;
                                setUseGotovina(parseFloat(e.target.value) || 0);

                                const gotovina = parseFloat(row._valuesCache['iznos_gotovina'] || 0);
                                const kartica = parseFloat(row._valuesCache['iznos_kartica'] || 0);
                                const cek = parseFloat(row._valuesCache['iznos_cek'] || 0);
                                const vaucer = parseFloat(row._valuesCache['iznos_vaucer'] || 0);

                                row._valuesCache['iznos_ukupno'] = gotovina + kartica + cek + vaucer;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'iznos_kartica',
                header: 'Iznos kartica',
                enableEditing: true,
                Edit: ({ row }) => {
                    const rowKey = (row.original as Payments).id?.toString() ?? row.id;
                    const methods = selectedPayments[rowKey] || [parseMethod(row.original.nacin_placanja_id)];
                    return (
                        <TextField
                            key={`got-${rowKey}-${methods.join(",")}`}
                            type="number"
                            defaultValue={row.original.iznos_kartica}
                            label="Iznos kartica"
                            size="small"
                            fullWidth
                            disabled={!methods.includes('Kartica')}
                            onChange={(e) => {
                                row._valuesCache['iznos_kartica'] = e.target.value;
                                setUseKartica(parseFloat(e.target.value) || 0);

                                const gotovina = parseFloat(row._valuesCache['iznos_gotovina'] || 0);
                                const kartica = parseFloat(row._valuesCache['iznos_kartica'] || 0);
                                const cek = parseFloat(row._valuesCache['iznos_cek'] || 0);
                                const vaucer = parseFloat(row._valuesCache['iznos_vaucer'] || 0);

                                row._valuesCache['iznos_ukupno'] = gotovina + kartica + cek + vaucer;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'iznos_cek',
                header: 'Iznos ček',
                enableEditing: true,
                Edit: ({ row }) => {
                    const rowKey = (row.original as Payments).id?.toString() ?? row.id;
                    const methods = selectedPayments[rowKey] || [parseMethod(row.original.nacin_placanja_id)];
                    return (
                        <TextField
                            key={`got-${rowKey}-${methods.join(",")}`}
                            type="number"
                            defaultValue={row.original.iznos_cek}
                            label="Iznos ček"
                            size="small"
                            fullWidth
                            disabled={!methods.includes('Ček')}
                            onChange={(e) => {
                                row._valuesCache['iznos_cek'] = e.target.value;
                                setUseCek(parseFloat(e.target.value) || 0);

                                const gotovina = parseFloat(row._valuesCache['iznos_gotovina'] || 0);
                                const kartica = parseFloat(row._valuesCache['iznos_kartica'] || 0);
                                const cek = parseFloat(row._valuesCache['iznos_cek'] || 0);
                                const vaucer = parseFloat(row._valuesCache['iznos_vaucer'] || 0);

                                row._valuesCache['iznos_ukupno'] = gotovina + kartica + cek + vaucer;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'iznos_vaucer',
                header: 'Iznos vaučer',
                enableEditing: true,
                Edit: ({ row }) => {
                    const rowKey = (row.original as Payments).id?.toString() ?? row.id;
                    const methods = selectedPayments[rowKey] || [parseMethod(row.original.nacin_placanja_id)];
                    return (
                        <TextField
                            key={`got-${rowKey}-${methods.join(",")}`}
                            type="number"
                            defaultValue={row.original.iznos_vaucer}
                            label="Iznos vaučer"
                            size="small"
                            fullWidth
                            disabled={!methods.includes('Vaučer')}
                            onChange={(e) => {
                                row._valuesCache['iznos_vaucer'] = e.target.value;
                                setUseVaucer(parseFloat(e.target.value) || 0);

                                const gotovina = parseFloat(row._valuesCache['iznos_gotovina'] || 0);
                                const kartica = parseFloat(row._valuesCache['iznos_kartica'] || 0);
                                const cek = parseFloat(row._valuesCache['iznos_cek'] || 0);
                                const vaucer = parseFloat(row._valuesCache['iznos_vaucer'] || 0);

                                row._valuesCache['iznos_ukupno'] = gotovina + kartica + cek + vaucer;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'iznos_ukupno',
                header: 'Iznos ukupno',
                size: 100,
                enableEditing: false,
                Edit: ({ row }) => {
                    const rowKey = (row.original as Payments).id?.toString() ?? row.id;

                    const value = row._valuesCache['iznos_ukupno'] ?? row.original.iznos_ukupno ?? 0;

                    return (
                        <TextField
                            key={`ukupno-${rowKey}`}
                            type="number"
                            value={value}
                            label="Iznos ukupno"
                            size="small"
                            fullWidth
                            disabled
                        />
                    );
                },
            },
            {
                accessorKey: 'valuta',
                header: 'Valuta',
                size: 100,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Valuta"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../PaymentsController/getCurrencyForSL'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'datum_kreiranja',
                header: 'Datum kreiranja',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
                    return (
                        <DatePicker
                            value={initialValue}
                            label={'Datum kreiranja'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            onChange={(newDate) => {
                                row._valuesCache['datum_kreiranja'] = newDate?.format('YYYY-MM-DD');
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => {
                    const date = cell.getValue();
                    return date ? dayjs(date as string).format('DD.MM.YYYY') : '';
                },
            },
            {
                accessorKey: 'broj_fiskalnog_racuna',
                header: 'Broj fiskalnog računa',
                size: 150,
                enableEditing: true,
            },
            {
                accessorKey: 'pos_referenca',
                header: 'POS referenca',
                size: 150,
                enableEditing: true,
            },
            {
                accessorKey: 'ip_adresa',
                header: 'IP adresa',
                size: 150,
                enableEditing: true,
            },
            {
                accessorKey: 'kreirao_id',
                header: 'Blagajnik',
                size: 100,
                enableEditing: false,
            },
            {
                accessorKey: 'kasa_id',
                header: 'Broj kase',
                size: 100,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Broj kase"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../CashRegisterController/getCashRegisterForSL'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'status',
                header: 'Status',
                size: 100,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Status"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../CashRegisterController/getStatusForSL'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
        ];
    }, [selectedPayments, useGotovina, useKartica, useCek, useVaucer]);

    const handleCreate: MRT_TableOptions<Payments>['onCreatingRowSave'] = async ({ values, table }) => {
        try {
            if (!values['id_fakture']) {
                toast.error('Niste uneli broj fakture');
                return;
            }
            if (!values['nacin_placanja_id']) {
                toast.error('Niste uneli nijedan način plaćanja');
                return;
            }
            await createRow(values);
            toast.success('Uspešno unošenje podataka');
            table.setCreatingRow(null);
        } catch (err: any) {
            console.log(err);
            toast.error('Došlo je do greške!');
        }
    };

    const handleUpdate: MRT_TableOptions<Payments>['onEditingRowSave'] = async ({ values, row, table }) => {
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

    const handleDelete = async (row: MRT_Row<Payments>) => {
        if (window.confirm('Da li potvrdjujete deaktiviranje?')) {
            try {
                await deleteRow(row.original.id);
                toast.success('Uspešno brisanje podataka');
            } catch (err) {
                console.log(err);
                toast('Došlo je do greške');
            }
        }
    };

    const table1 = useMaterialReactTable<Payments>({
        ...globalTableProps,
        columns,
        data: payments,
        enableEditing: true,
        getRowId: (row) => String(row.id),
        initialState: {
            columnVisibility: { id: false, nacin_placanja_id: false },
        },
        onEditingRowCancel: ({ table }) => table.setEditingRow(null),
        onCreatingRowSave: handleCreate,
        onEditingRowSave: handleUpdate,
        renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => {
            if (!row._valuesCache['uplatilac_id'] && usePaymentID) {
                row._valuesCache['uplatilac_id'] = `${usePaymentID} | ${usePaymentName}`;
            }
            if (!row._valuesCache['kreirao_id']) {
                row._valuesCache['kreirao_id'] = `${loggedUserId} | ${loggedUserName}`;
            }
            if (!row._valuesCache['datum_kreiranja']) {
                row._valuesCache['datum_kreiranja'] = dayjs().format('YYYY-MM-DD');
            }
            if (!row._valuesCache['valuta']) {
                row._valuesCache['valuta'] = `1 | RSD`;
            }
            if (!row._valuesCache['status']) {
                row._valuesCache['status'] = `1 | Aktivan`;
            }
            if (!row._valuesCache['kasa_id']) {
                row._valuesCache['kasa_id'] = `${useCashRegisterId} | ${useCashRegisterName}`;
            }

            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
                        Unos
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
        renderRowActions: ({ row }) => {
            return (
                <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    {/* <Tooltip title="Izmena">
                        <Button
                            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
                            size="small"
                            variant="contained"
                            color="primary"
                            onClick={() => table.setEditingRow(row)}
                        >
                            <Edit />
                        </Button>
                    </Tooltip> */}
                    <Tooltip title="Deaktiviraj">
                        <Button
                            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => handleDelete(row)}
                        >
                            <Remove />
                        </Button>
                    </Tooltip>
                </Box>
            );
        },
        renderTopToolbarCustomActions: ({ table }) => (
            <Box>
                <Typography
                    sx={{
                        color: 'primary.main',
                        textDecoration: 'underline',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    Aktivne uplate
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    disabled={!usePaymentID}
                    onClick={() => {
                        table.setCreatingRow(true);
                    }}
                >
                    Dodaj
                </Button>
            </Box>
        ),
        state: {
            showProgressBars: isFetching,
            isSaving: isCreating || isUpdating || isDeleting,
        },
    });

    const table2 = useMaterialReactTable<Payments>({
        ...globalTableProps,
        columns,
        data: inactivePayments,
        enableEditing: false,
        initialState: {
            columnVisibility: { id: false, nacin_placanja_id: false },
        },
        renderTopToolbarCustomActions: () => (
            <Typography
                sx={{
                    color: 'primary.main',
                    textDecoration: 'underline',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    fontWeight: 500
                }}
            >
                Neaktivne uplate
            </Typography>
        ),
        state: {
            showProgressBars: isFetching,
        },
    });

    return (
        <Main title={title}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px', justifyContent: 'space-between' }}>
                <Box sx={{ width: '400px', marginRight: '12px' }}>
                    {!isShiftOpen && (
                        <Typography sx={{ color: 'red', marginBottom: '8px' }}>
                            SMENA NIJE OTVORENA!
                        </Typography>
                    )}
                    <SearchList
                        label="Odaberi korisnika"
                        endpoint={`../UserAccountController/getUserAccountsForSL`}
                        multiple={false}
                        onChange={handleFilterChange}
                        textFieldProps={{ variant: 'standard' }}
                        disabled={!isShiftOpen}
                    />
                </Box>
            </Box>
            <MaterialReactTable table={table1} />
            <MaterialReactTable table={table2} />
        </Main>
    );
};

export default PaymentsPage;
