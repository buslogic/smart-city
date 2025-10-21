import { NoteCategory } from '@/types/notes';
import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_ENDPOINT = '/api/note-categories';

const useNoteCategories = () => {
    const [noteCategories, setNoteCategories] = useState<NoteCategory[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<NoteCategory>[]>(() => {
        return [
            {
                accessorKey: 'name',
                header: 'Kategorija',
                size: 100,
            },
        ];
    }, []);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        try {
            const data = await fetchAPI<NoteCategory[]>(API_ENDPOINT, {
                method: 'GET',
            });
            setNoteCategories(data);
        } catch (error) {
            console.error('Greška pri učitavanju kategorija:', error);
        } finally {
            setIsFetching(false);
        }
    }, []);

    const createRow = useCallback(async (row: NoteCategory): Promise<void> => {
        setIsCreating(true);
        try {
            const newRow = await fetchAPI<NoteCategory>(API_ENDPOINT, {
                method: 'POST',
                data: row,
            });
            setNoteCategories((prev) => [newRow, ...prev]);
        } catch (error) {
            console.error('Greška pri kreiranju kategorije:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: NoteCategory) => {
        setIsUpdating(true);
        try {
            const { id, ...updateData } = row;
            const updatedRow = await fetchAPI<NoteCategory>(`${API_ENDPOINT}/${id}`, {
                method: 'PATCH',
                data: updateData,
            });
            setNoteCategories((prev) => prev.map((x) => (x.id === id ? updatedRow : x)));
        } catch (error) {
            console.error('Greška pri ažuriranju kategorije:', error);
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
            setNoteCategories((state) => state.filter((x) => x.id !== id));
        } catch (error) {
            console.error('Greška pri brisanju kategorije:', error);
            throw error;
        } finally {
            setIsDeleting(false);
        }
    }, []);

    return {
        columns,
        noteCategories,
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

export default useNoteCategories;
