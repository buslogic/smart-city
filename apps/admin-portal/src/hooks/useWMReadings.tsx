import { WaterMeterReading } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useWMReadings = () => {
  const [isFetching, setIsFetching] = useState(true);
  const [readings, setReadings] = useState<WaterMeterReading[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<MRT_ColumnDef<WaterMeterReading>[]>(
    () => [
      {
        accessorKey: 'meter_reading',
        header: 'Stanje',
        size: 100,
      },
      {
        accessorKey: 'note',
        header: 'Opis',
        size: 100,
      },
    ],
    []
  );

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchAPI<WaterMeterReading[]>(`${API_BASE}/api/water-meter-remarks`, {
        method: 'GET',
      });
      setIsFetching(false);
      setReadings(data);
    } catch (err) {
      console.log(err);
      setIsFetching(false);
    }
  }, []);

  const createRow = useCallback(async (row: WaterMeterReading): Promise<void> => {
    setIsCreating(true);
    try {
      const res = await fetchAPI<WaterMeterReading>(`${API_BASE}/api/water-meter-remarks`, {
        method: 'POST',
        data: row,
      });
      setReadings((prev) => [res, ...prev]);
    } catch (err) {
      console.log(err);
      throw new Error('Neuspešan unos podataka');
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: WaterMeterReading) => {
    setIsUpdating(true);
    try {
      const res = await fetchAPI<WaterMeterReading>(`${API_BASE}/api/water-meter-remarks/${row.id}`, {
        method: 'PATCH',
        data: row,
      });
      setReadings((prev) => prev.map((x) => (x.id === row.id ? res : x)));
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
      await fetchAPI(`${API_BASE}/api/water-meter-remarks/${id}`, {
        method: 'DELETE',
      });
      setReadings((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    readings,
    fetchData,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateRow,
    createRow,
    deleteRow,
    columns,
  };
};

export default useWMReadings;
