import { WaterService } from '@/types/finance';
import { api } from '@/services/api';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const useWaterServices = () => {
  const [service, setServices] = useState<WaterService[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<MRT_ColumnDef<WaterService>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        // muiEditTextFieldProps: getHideColumnProps,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'service',
        header: 'Usluga',
        size: 100,
      },
      {
        accessorKey: 'note',
        header: 'Napomena',
        size: 100,
      },
      {
        accessorKey: 'code',
        header: 'Šifra usluge',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
    ];
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const { data } = await api.get<WaterService[]>('/api/water-services');
      setServices(data);
    } catch (err) {
      console.log(err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const createRow = useCallback(async (row: WaterService): Promise<void> => {
    try {
      setIsCreating(true);
      const { data } = await api.post<WaterService>('/api/water-services', row);
      console.log('Inserted: ', data);
      setServices((prev) => [data, ...prev]);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: WaterService) => {
    try {
      setIsUpdating(true);
      const { id, ...updateData } = row;
      const { data } = await api.patch<WaterService>(`/api/water-services/${id}`, updateData);
      setServices((prev) => prev.map((x) => (x.id === id ? data : x)));
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/water-services/${id}`);
      setServices((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    columns,
    service,
    fetchData,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateRow,
    createRow,
    deleteRow,
  };
};

export default useWaterServices;
