import { SearchList } from '@/components/ui/SearchList';
import { Notes } from '@/types/notes';
import { fetchPostData } from '@/utils/fetchUtil';
import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const CONTROLLER = '../WaterSupplyNotesController';

const useWaterSupplyNotes = () => {
    const [waterSupplyNotes, setWaterSupplyNotes] = useState<Notes[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<Notes>[]>(() => {
        return [
            {
                accessorKey: 'category_id',
                header: 'Kategorija',
                size: 250,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Kategorija"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getCategoryForSL'}
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
                accessorKey: 'title',
                header: 'Naslov',
                size: 150,
            },
            {
                accessorKey: 'body',
                header: 'Tekst',
                size: 150,
            },
            {
                accessorKey: 'is_pinned',
                header: 'Zakačeno',
                size: 100,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number | undefined;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`is_pinned_cell_${cell.row.id}`} />;
                },
                enableEditing: true,
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Zakačeno"
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
                accessorKey: 'is_private',
                header: 'Privatno',
                size: 100,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number | undefined;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`is_private_cell_${cell.row.id}`} />;
                },
                enableEditing: true,
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Privatno"
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
    }, [waterSupplyNotes]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchPostData(CONTROLLER + '/getRows');
        setIsFetching(false);
        setWaterSupplyNotes(data);
    }, []);

    const createRow = useCallback(async (row: Notes): Promise<void> => {
        setIsCreating(true);
        const res = await fetchPostData(CONTROLLER + '/addRow', row);
        setIsCreating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setWaterSupplyNotes((prev) => [res.data, ...prev]);
    }, []);

    const updateRow = useCallback(async (row: Notes) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setWaterSupplyNotes((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setWaterSupplyNotes((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        waterSupplyNotes,
        isFetching,
        isCreating,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        createRow,
        deleteRow
    };
};

export default useWaterSupplyNotes;
