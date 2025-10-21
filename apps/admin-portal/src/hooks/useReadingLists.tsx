import { SearchList } from '@/components/ui/SearchList';
import { ReadingLists } from '@/types/billing-campaign';
import { fetchAPI } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/reading-lists`;

const useReadingLists = () => {
    const [readingLists, setReadingLists] = useState<ReadingLists[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<ReadingLists>[]>(() => {
        return [
            {
                accessorKey: 'pod_kampanja_id',
                header: 'Pod kampanja',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Pod kampanja"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getSubCampaignForSL'}
                            fetchOnRender={true}
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
                accessorKey: 'ulica',
                header: 'Ulica',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Ulica"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={`${API_BASE}/api/water-system-streets/search-list`}
                            fetchOnRender={true}
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
                            fetchOnRender={true}
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
    }, [readingLists]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchAPI<ReadingLists[]>(CONTROLLER + '/getRows', {
            method: 'POST',
        });
        setIsFetching(false);
        setReadingLists(data);
    }, []);

    const createRow = useCallback(async (row: ReadingLists): Promise<void> => {
        setIsCreating(true);
        const res = await fetchAPI<{ success: boolean; error?: string; data: ReadingLists }>(
            CONTROLLER + '/addRow',
            {
                method: 'POST',
                data: row,
            }
        );
        setIsCreating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setReadingLists((prev) => [res.data, ...prev]);
    }, []);

    const updateRow = useCallback(async (row: ReadingLists) => {
        setIsUpdating(true);
        const res = await fetchAPI<{ success: boolean; error?: string; data: ReadingLists }>(
            CONTROLLER + '/editRow',
            {
                method: 'POST',
                data: row,
            }
        );
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setReadingLists((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchAPI(CONTROLLER + '/deleteRow', {
            method: 'POST',
            data: { id },
        });
        setIsDeleting(false);
        setReadingLists((state) => state.filter((x) => x.id !== id));
    }, []);

    const archiveRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchAPI(CONTROLLER + '/archiveRow', {
            method: 'POST',
            data: { id },
        });
        setIsDeleting(false);
        setReadingLists((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        readingLists,
        isFetching,
        isCreating,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        createRow,
        deleteRow,
        archiveRow
    };
};

export default useReadingLists;
