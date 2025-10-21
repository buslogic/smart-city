import { MeasuringPoints } from '@/types/measuring-points';
import { fetchAPI } from '@/utils/fetchUtil';
import { useCallback, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useMeasuringPoints = () => {
  const [measuringPoints, setMeasuringPoints] = useState<MeasuringPoints[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchAPI<MeasuringPoints[]>(`${API_BASE}/api/measuring-points`, {
        method: 'GET',
      });
      setMeasuringPoints(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const updateRow = useCallback(async (row: MeasuringPoints) => {
    setIsUpdating(true);
    try {
      const res = await fetchAPI<MeasuringPoints>(`${API_BASE}/api/measuring-points/${row.IDMM}`, {
        method: 'PATCH',
        data: row,
      });
      setMeasuringPoints((prev) => prev.map((x) => (x.IDMM === row.IDMM ? res : x)));
    } catch (err: any) {
      console.error('Error updating measuring point:', err);
      const errorMessage = typeof err === 'string' ? err : (err?.message || 'Greška prilikom izmene');
      throw new Error(typeof errorMessage === 'string' ? errorMessage : 'Greška prilikom izmene');
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteRow = useCallback(async (idmm: number) => {
    setIsDeleting(true);
    try {
      await fetchAPI(`${API_BASE}/api/measuring-points/${idmm}`, {
        method: 'DELETE',
      });
      setMeasuringPoints((state) => state.filter((x) => x.IDMM !== idmm));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    measuringPoints,
    isFetching,
    isUpdating,
    isDeleting,
    fetchData,
    updateRow,
    deleteRow,
  };
};

export default useMeasuringPoints;
