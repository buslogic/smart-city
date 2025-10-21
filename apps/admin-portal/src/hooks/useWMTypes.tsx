import { SelectOption, WMType } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useWMTypes = () => {
  const [isFetching, setIsFetching] = useState(true);
  const [wmTypes, setWmTypes] = useState<WMType[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWMTypes = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchAPI<WMType[]>(`${API_BASE}/api/water-meter-types`, {
        method: 'GET',
      });
      setIsFetching(false);
      setWmTypes(data);
    } catch (err) {
      console.log(err);
      setIsFetching(false);
    }
  }, []);

  const typeOpts = useMemo((): SelectOption[] => {
    return wmTypes.map((x) => ({ label: x.type, value: x.id }));
  }, [wmTypes]);

  const createItem = useCallback(async (row: WMType): Promise<void> => {
    setIsCreating(true);
    try {
      const res = await fetchAPI<WMType[]>(`${API_BASE}/api/water-meter-types`, {
        method: 'POST',
        data: row,
      });
      // Backend vraća kompletnu listu sortiranu po ID DESC (najnoviji prvi)
      if (Array.isArray(res)) {
        setWmTypes(res);
      }
    } catch (err) {
      console.log(err);
      throw new Error('Neuspešan unos podataka');
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateItem = useCallback(async (row: WMType) => {
    setIsUpdating(true);
    try {
      const res = await fetchAPI<WMType>(`${API_BASE}/api/water-meter-types/${row.id}`, {
        method: 'PATCH',
        data: row,
      });
      // Ako je response objekat (jedan tip), ažuriraj samo taj red
      if (res && !Array.isArray(res)) {
        setWmTypes((prev) => prev.map((x) => (x.id === row.id ? res : x)));
      }
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteItem = useCallback(async (id: number) => {
    setIsDeleting(true);
    try {
      await fetchAPI(`${API_BASE}/api/water-meter-types/${id}`, {
        method: 'DELETE',
      });
      setWmTypes((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const columns = useMemo<MRT_ColumnDef<WMType>[]>(
    () => [
      {
        accessorKey: 'type',
        header: 'Tip',
        size: 100,
      },
    ],
    []
  );

  return {
    types: wmTypes,
    fetchWMTypes,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateItem,
    createItem,
    deleteItem,
    typeOpts,
    columns
  };
};

export default useWMTypes;
