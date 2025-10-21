import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/reading-anomalies`;

export type ReadingAnomaly = {
  id: number;
  status: string;
  description: string;
  created_at?: string;
};

const useReadingAnomalies = () => {
  const [anomalies, setAnomalies] = useState<ReadingAnomaly[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<MRT_ColumnDef<ReadingAnomaly>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        enableEditing: false,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 100,
      },
      {
        accessorKey: 'description',
        header: 'Opis',
        size: 100,
      },
    ];
  }, []);

  const fetchData = useCallback(async () => {
    setIsFetching(true);
    const data = await fetchAPI<ReadingAnomaly[]>(CONTROLLER + '/getRows', {
      method: 'POST',
    });
    setIsFetching(false);
    setAnomalies(data);
  }, []);

  const createRow = useCallback(async (row: ReadingAnomaly): Promise<void> => {
    setIsCreating(true);
    const res = await fetchAPI<{ success: boolean; error?: string; data: ReadingAnomaly }>(
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
    setAnomalies((prev) => [res.data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: ReadingAnomaly) => {
    setIsUpdating(true);
    const res = await fetchAPI<{ success: boolean; error?: string; data: ReadingAnomaly }>(
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
    setAnomalies((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchAPI(CONTROLLER + '/deleteRow', {
      method: 'POST',
      data: { id },
    });
    setIsDeleting(false);
    setAnomalies((state) => state.filter((x) => x.id !== id));
  }, []);

  return {
    columns,
    anomalies,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    fetchData,
    updateRow,
    createRow,
    deleteRow,
  };
};

export default useReadingAnomalies;
