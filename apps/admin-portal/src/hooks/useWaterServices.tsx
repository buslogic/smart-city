import { WaterService } from '@/types/finance';
import { fetchPostData } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const CONTROLLER = '../WaterServicesController';

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
      const data = await fetchPostData(CONTROLLER + '/getRows');
      setIsFetching(false);
      setServices(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  const createRow = useCallback(async (row: WaterService): Promise<void> => {
    setIsCreating(true);
    const res = await fetchPostData(CONTROLLER + '/addRow', row);
    console.log('Inserted: ', res);
    setIsCreating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setServices((prev) => [res.data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: WaterService) => {
    setIsUpdating(true);
    const res = await fetchPostData(CONTROLLER + '/editRow', row);
    if (!res.success) {
      throw new Error(res.error);
    }
    setServices((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    setIsUpdating(false);
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchPostData(CONTROLLER + '/deleteRow', { id });
    setIsDeleting(false);
    setServices((state) => state.filter((x) => x.id !== id));
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
