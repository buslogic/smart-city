import { SearchList } from '@/components/ui/SearchList';
import { Subsidy } from '@/types/subsidies';
import { HistoryRow } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/subsidies`;

const useSubsidies = () => {
    const [subsidies, setSubsidies] = useState<Subsidy[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<Subsidy>[]>(() => {
        return [
            {
                accessorKey: 'naziv',
                header: 'Naziv',
                size: 150,
            },
            {
                accessorKey: 'tip',
                header: 'Tip',
                size: 250,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Tip"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getTypesForSL'}
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
                accessorKey: 'procenat',
                header: 'Procenat',
                size: 150,
            },
            {
                accessorKey: 'iznos',
                header: 'Iznos',
                size: 150,
            },
            {
                accessorKey: 'datum_od',
                header: 'Datum od',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
                    const [value, setValue] = useState(initialValue);
                    return (
                        <DatePicker
                            value={value}
                            label={'Datum od'}
                            sx={{ width: '100%' }}
                            onChange={(newDate) => {
                                setValue(newDate);
                                row._valuesCache['datum_od'] = newDate?.format('YYYY-MM-DD');
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
                accessorKey: 'datum_do',
                header: 'Datum do',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
                    const [value, setValue] = useState(initialValue);
                    return (
                        <DatePicker
                            value={value}
                            label={'Datum do'}
                            sx={{ width: '100%' }}
                            onChange={(newDate) => {
                                setValue(newDate);
                                row._valuesCache['datum_do'] = newDate?.format('YYYY-MM-DD');
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
                accessorKey: 'limit',
                header: 'Limit',
                size: 150,
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
            {
                accessorKey: 'fiksni_deo',
                header: 'Fiksni deo',
                size: 100,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number | undefined;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`fixed_charge_cell_${cell.row.id}`} />;
                },
                enableEditing: true,
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Fiksni deo"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'varijabilni_deo',
                header: 'Varijabilni deo',
                size: 100,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number | undefined;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`variable_charge_cell_${cell.row.id}`} />;
                },
                enableEditing: true,
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Varijabilni deo"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
        ];
    }, [subsidies]);

    const historyColumns = useMemo<MRT_ColumnDef<HistoryRow>[]>(
        () => [
            {
                accessorKey: 'old_value',
                header: 'Stara vrednost',
                size: 150,
            },
            {
                accessorKey: 'new_value',
                header: 'Promenjena vrednost',
                size: 150,
            },
            {
                accessorKey: 'translate',
                header: 'Tip promene',
                size: 150,
            },
            {
                accessorKey: 'note',
                header: 'Napomena',
                size: 150,
            },
            {
                accessorKey: 'change_date',
                header: 'Datum promene',
                size: 150,
            },
            {
                accessorKey: 'changed_by',
                header: 'Promenu izvršio/la',
                size: 150,
            },
        ],
        []
    );

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const response = await fetchAPI(CONTROLLER + '/getRows', { method: 'POST' });
        setIsFetching(false);
        setSubsidies(response.data || []);
    }, []);

    const createRow = useCallback(async (row: Subsidy): Promise<void> => {
        setIsCreating(true);
        const res = await fetchAPI(CONTROLLER + '/addRow', { method: 'POST', data: row });
        setIsCreating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setSubsidies((prev) => [res.data, ...prev]);
    }, []);

    const updateRow = useCallback(async (row: Subsidy) => {
        setIsUpdating(true);
        const res = await fetchAPI(CONTROLLER + '/editRow', { method: 'POST', data: row });
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setSubsidies((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchAPI(CONTROLLER + '/deleteRow', { method: 'POST', data: { id } });
        setIsDeleting(false);
        setSubsidies((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        subsidies,
        isFetching,
        isCreating,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        createRow,
        deleteRow,
        historyColumns,
    };
};

export default useSubsidies;
