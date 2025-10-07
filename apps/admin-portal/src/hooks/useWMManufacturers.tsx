import { SelectOption, WMManufacturer } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useWMManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<WMManufacturer[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchManufacturers = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchAPI<WMManufacturer[]>(`${API_BASE}/api/water-meter-manufacturers`, {
        method: 'GET',
      });
      setIsFetching(false);
      setManufacturers(data);
    } catch (err) {
      console.log(err);
      setIsFetching(false);
    }
  }, []);

  const manufacturerOpts = useMemo((): SelectOption[] => {
    return manufacturers.map((x) => ({ label: x.manufacturer, value: x.id }));
  }, [manufacturers]);

  const createRow = useCallback(async (row: WMManufacturer): Promise<void> => {
    setIsCreating(true);
    try {
      const res = await fetchAPI<WMManufacturer>(`${API_BASE}/api/water-meter-manufacturers`, {
        method: 'POST',
        data: row,
      });
      setManufacturers((prev) => [res, ...prev]);
    } catch (err) {
      console.log(err);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: WMManufacturer) => {
    setIsUpdating(true);
    try {
      const res = await fetchAPI<WMManufacturer>(`${API_BASE}/api/water-meter-manufacturers/${row.id}`, {
        method: 'PATCH',
        data: row,
      });
      setManufacturers((prev) => prev.map((x) => (x.id === row.id ? res : x)));
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
      await fetchAPI(`${API_BASE}/api/water-meter-manufacturers/${id}`, {
        method: 'DELETE',
      });
      setManufacturers((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const columns = useMemo<MRT_ColumnDef<WMManufacturer>[]>(
    () => [
      {
        accessorKey: 'manufacturer',
        header: 'Proizvođač',
        size: 100,
      },
    ],
    []
  );

  return {
    columns,
    manufacturers,
    fetchManufacturers,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateRow,
    createRow,
    deleteRow,
    manufacturerOpts,
  };
};

export default useWMManufacturers;
