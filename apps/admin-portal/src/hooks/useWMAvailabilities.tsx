import { SelectOption, WMAvailability } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useWMAvailabilities = () => {
  const [isFetching, setIsFetching] = useState(true);
  const [availabilities, setAvailabilities] = useState<WMAvailability[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWMAvailabilities = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchAPI<WMAvailability[]>(`${API_BASE}/api/water-meter-availability`, {
        method: 'GET',
      });
      setIsFetching(false);
      setAvailabilities(data);
    } catch (err) {
      console.log(err);
      setIsFetching(false);
    }
  }, []);

  const availabilityOpts = useMemo((): SelectOption[] => {
    return availabilities.map((x) => ({ label: x.availability, value: x.id }));
  }, [availabilities]);

  const createRow = useCallback(async (row: WMAvailability): Promise<void> => {
    setIsCreating(true);
    try {
      const res = await fetchAPI<WMAvailability>(`${API_BASE}/api/water-meter-availability`, {
        method: 'POST',
        data: row,
      });
      setAvailabilities((prev) => [res, ...prev]);
    } catch (err) {
      console.log(err);
      throw new Error('Neuspešan unos podataka');
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: WMAvailability) => {
    setIsUpdating(true);
    try {
      const res = await fetchAPI<WMAvailability>(`${API_BASE}/api/water-meter-availability/${row.id}`, {
        method: 'PATCH',
        data: row,
      });
      setAvailabilities((prev) => prev.map((x) => (x.id === row.id ? res : x)));
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    try {
      await fetchAPI(`${API_BASE}/api/water-meter-availability/${id}`, {
        method: 'DELETE',
      });
      setAvailabilities((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const columns = useMemo<MRT_ColumnDef<WMAvailability>[]>(
    () => [
      {
        accessorKey: 'availability',
        header: 'Status',
        size: 100,
      },
    ],
    []
  );

  return {
    availabilities,
    fetchWMAvailabilities,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateRow,
    createRow,
    deleteRow,
    availabilityOpts,
    columns,
  };
};

export default useWMAvailabilities;
