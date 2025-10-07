import { SearchList } from '@/components/ui/SearchList';
import { StatusHistory } from '@/types/complaints';
import { fetchPostData } from '@/utils/fetchUtil';
import { TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const CONTROLLER = '../ComplaintsByAssigneController';

const useComplaintsByAssigne = () => {
    const [complaints, setSubsidies] = useState<StatusHistory[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
                            endpoint={'../ComplaintController/getComplaintStatusForSL'}
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

                    return (
                        <DatePicker
                            value={initialValue}
                            label={'Datum promene'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            onChange={(newDate) => {
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
                Edit: ({ cell, row }) => {
                    const value = cell.getValue() as string;

                    return (
                        <TextField
                            label="Napomena"
                            defaultValue={value || ''}
                            multiline
                            minRows={3}
                            fullWidth
                            onChange={(e) => {
                                row._valuesCache['napomena'] = e.target.value;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => (
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                        {cell.getValue() as string}
                    </Typography>
                ),
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
        const data = await fetchPostData(CONTROLLER + '/getRows');
        setIsFetching(false);
        setSubsidies(data);
    }, []);

    const updateRow = useCallback(async (row: StatusHistory) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setSubsidies((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setSubsidies((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        complaints,
        isFetching,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        deleteRow,
        historyColumns
    };
};

export default useComplaintsByAssigne;
