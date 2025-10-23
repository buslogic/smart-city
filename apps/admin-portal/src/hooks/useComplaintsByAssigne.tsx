import { SearchList } from '@/components/ui/SearchList';
import { StatusHistory } from '@/types/complaints';
import { fetchAPI } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const useComplaintsByAssigne = () => {
    const [complaints, setSubsidies] = useState<StatusHistory[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const columns = useMemo<MRT_ColumnDef<StatusHistory>[]>(() => {
        return [
            {
                accessorKey: 'reklamacija_id',
                header: 'Reklamacija ID',
                size: 100,
                enableEditing: false,
            },
            {
                accessorKey: 'status_id',
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
                            endpoint={'/api/complaints/statuses/search'}
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
                accessorKey: 'datum_promene',
                header: 'Datum promene',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00 00:00:00' ? dayjs(rawValue) : null;
                    const [value, setValue] = useState(initialValue);

                    return (
                        <DatePicker
                            value={value}
                            label={'Datum promene'}
                            sx={{ width: '100%' }}
                            slotProps={{
                                textField: {
                                    variant: 'standard',
                                },
                            }}
                            onChange={(newDate) => {
                                setValue(newDate);
                                row._valuesCache['datum_promene'] = newDate ? newDate.format('YYYY-MM-DD') : '';
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => {
                    const date = cell.getValue();
                    if (!date || date === '0000-00-00 00:00:00') return '';
                    return dayjs(date as string).format('DD.MM.YYYY');
                },
            },
            {
                accessorKey: 'napomena',
                header: 'Napomena',
                size: 100,
                enableEditing: true,
            }
        ];
    }, [complaints]);

    const historyColumns = useMemo<MRT_ColumnDef<StatusHistory>[]>(
        () => [
            {
                accessorKey: 'reklamacija_id',
                header: 'Reklamacija ID',
                size: 150,
            },
            {
                accessorKey: 'status_id',
                header: 'Status',
                size: 150,
            },
            {
                accessorKey: 'napomena',
                header: 'Napomena',
                size: 150,
            },
            {
                accessorKey: 'datum_promene',
                header: 'Datum promene',
                size: 150,
                Cell: ({ cell }) => {
                    const date = cell.getValue();
                    if (!date || date === '0000-00-00 00:00:00') return '';
                    return dayjs(date as string).format('DD.MM.YYYY');
                },
            },
            {
                accessorKey: 'user_id',
                header: 'Promenu izvršio/la',
                size: 150,
            },
        ],
        []
    );

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchAPI<StatusHistory[]>('/api/complaints/by-assignee', { method: 'GET' });
        setIsFetching(false);
        setSubsidies(data);
    }, []);

    const updateRow = useCallback(async (row: StatusHistory) => {
        setIsUpdating(true);
        await fetchAPI('/api/complaints/status-history', {
            method: 'POST',
            data: {
                reklamacija_id: row.reklamacija_id,
                status_id: row.status_id,
                napomena: row.napomena,
                datum_promene: row.datum_promene
            }
        });
        const data = await fetchAPI<StatusHistory[]>('/api/complaints/by-assignee', { method: 'GET' });
        setSubsidies(data);
        setIsUpdating(false);
    }, []);

    return {
        columns,
        complaints,
        isFetching,
        isUpdating,
        fetchData,
        updateRow,
        historyColumns
    };
};

export default useComplaintsByAssigne;
