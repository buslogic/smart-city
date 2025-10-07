import { SearchList } from '@/components/ui/SearchList';
import { FiscalDevice } from '@/types/cashRegister';
import { fetchPostData } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const CONTROLLER = '../FiscalDeviceController';

const useFiscalDevice = () => {
    const [fiscalDevice, setFiscalDevice] = useState<FiscalDevice[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<FiscalDevice>[]>(() => {
        return [
            {
                accessorKey: 'naziv',
                header: 'Naziv',
                size: 150,
            },
            {
                accessorKey: 'model',
                header: 'Model',
                size: 150,
            },
            {
                accessorKey: 'krajnja_tacka',
                header: 'Krajnja tačka',
                size: 150,
            },
            {
                accessorKey: 'poslednja_sinhronizacija',
                header: 'Poslednja sinhronizacija',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
                    return (
                        <DatePicker
                            value={initialValue}
                            label={'Poslednja sinhronizacija'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            onChange={(newDate) => {
                                row._valuesCache['poslednja_sinhronizacija'] = newDate?.format('YYYY-MM-DD');
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
                accessorKey: 'status',
                header: 'Status',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Status"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getStatusForSL'}
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
    }, [fiscalDevice]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchPostData(CONTROLLER + '/getRows');
        setIsFetching(false);
        setFiscalDevice(data);
    }, []);

    const createRow = useCallback(async (row: FiscalDevice): Promise<void> => {
        setIsCreating(true);
        const res = await fetchPostData(CONTROLLER + '/addRow', row);
        setIsCreating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setFiscalDevice((prev) => [res.data, ...prev]);
    }, []);

    const updateRow = useCallback(async (row: FiscalDevice) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setFiscalDevice((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setFiscalDevice((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        fiscalDevice,
        isFetching,
        isCreating,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        createRow,
        deleteRow,
    };
};

export default useFiscalDevice;
