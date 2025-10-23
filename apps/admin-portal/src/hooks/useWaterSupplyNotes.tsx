import { SearchList } from '@/components/ui/SearchList';
import { WaterSupplyNote } from '@/types/notes';
import { fetchAPI } from '@/utils/fetchUtil';
import { Checkbox, FormControlLabel, TextField } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_ENDPOINT = '/api/water-supply-notes';

const useWaterSupplyNotes = () => {
    const [waterSupplyNotes, setWaterSupplyNotes] = useState<WaterSupplyNote[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<WaterSupplyNote>[]>(() => {
        return [
            {
                accessorKey: 'id',
                header: 'ID',
                size: 80,
                enableEditing: false,
            },
            {
                accessorKey: 'categoryId',
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
                            endpoint={API_ENDPOINT + '/categories/search'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'title',
                header: 'Naslov',
                size: 200,
                Edit: ({ cell, row, column }) => {
                    const value = (cell.getValue() as string) || '';
                    return (
                        <TextField
                            label="Naslov"
                            defaultValue={value}
                            fullWidth
                            variant="standard"
                            onChange={(e) => {
                                row._valuesCache[column.id] = e.target.value;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'body',
                header: 'Tekst',
                size: 300,
                Edit: ({ cell, row, column }) => {
                    const value = (cell.getValue() as string) || '';
                    return (
                        <TextField
                            label="Tekst"
                            defaultValue={value}
                            multiline
                            rows={4}
                            fullWidth
                            variant="standard"
                            onChange={(e) => {
                                row._valuesCache[column.id] = e.target.value;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'isPinned',
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
                accessorKey: 'isPrivate',
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
    }, []);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        try {
            const data = await fetchAPI<WaterSupplyNote[]>(API_ENDPOINT, {
                method: 'GET',
            });
            setWaterSupplyNotes(data);
        } catch (error) {
            console.error('Greška pri učitavanju beleški:', error);
        } finally {
            setIsFetching(false);
        }
    }, []);

    const createRow = useCallback(async (row: WaterSupplyNote): Promise<void> => {
        setIsCreating(true);
        try {
            const defaultValues = {
                isPinned: 0,
                isPrivate: 0,
                ...row,
            };
            const newRow = await fetchAPI<WaterSupplyNote>(API_ENDPOINT, {
                method: 'POST',
                data: defaultValues,
            });
            setWaterSupplyNotes((prev) => [newRow, ...prev]);
        } catch (error) {
            console.error('Greška pri kreiranju beleške:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: WaterSupplyNote) => {
        setIsUpdating(true);
        try {
            const { id, ...updateData } = row;
            const updatedRow = await fetchAPI<WaterSupplyNote>(`${API_ENDPOINT}/${id}`, {
                method: 'PATCH',
                data: updateData,
            });
            setWaterSupplyNotes((prev) => prev.map((x) => (x.id === id ? updatedRow : x)));
        } catch (error) {
            console.error('Greška pri ažuriranju beleške:', error);
            throw error;
        } finally {
            setIsUpdating(false);
        }
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        try {
            await fetchAPI(`${API_ENDPOINT}/${id}`, {
                method: 'DELETE',
            });
            setWaterSupplyNotes((state) => state.filter((x) => x.id !== id));
        } catch (error) {
            console.error('Greška pri brisanju beleške:', error);
            throw error;
        } finally {
            setIsDeleting(false);
        }
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
