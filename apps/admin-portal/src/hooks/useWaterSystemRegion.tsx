import { fetchPostData } from '@/utils/fetchUtil';
import { getHideColumnProps } from '@/utils/props';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { SystemStreet } from './useWaterSystemStreets';

const CONTROLLER = '../WaterSystemRegionController';

export type Region = {
  id: number;
  region_name: string;
  reader_id: number | null;
};

const useWaterSystemRegion = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingStreet, setIsRemovingStreet] = useState(false);

  const columns = useMemo<MRT_ColumnDef<Region>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        enableEditing: false,
        muiEditTextFieldProps: getHideColumnProps,
      },
      {
        accessorKey: 'region_name',
        header: 'Rejon',
        size: 100,
      },
    ];
  }, []);

  const streetColumns = useMemo<MRT_ColumnDef<SystemStreet>[]>(() => [
    {
      accessorKey: 'address_name',
      header: 'Adresa',
      size: 100,
    },
    {
      accessorKey: 'address_number',
      header: 'Broj',
      size: 100,
    },
    {
      accessorKey: 'official_address_code',
      header: 'Zvanična šifra adrese',
      size: 100,
    },
    {
      accessorKey: 'cities_name',
      header: 'Grad',
      size: 100,
    },
    {
      accessorKey: 'active',
      header: 'Status',
      size: 100,
      Cell: ({ cell }) => Number(cell.getValue()) === 1 ? "Aktivan" : "Neaktivan",
    },
  ], []);

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchPostData(CONTROLLER + '/getRows');
      setIsFetching(false);
      setRegions(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  const createRow = useCallback(async (row: Region): Promise<void> => {
    setIsCreating(true);
    const res = await fetchPostData(CONTROLLER + '/addRow', row);
    setIsCreating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setRegions((prev) => [res.data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: Region) => {
    setIsUpdating(true);
    const res = await fetchPostData(CONTROLLER + '/editRow', row);
    setIsUpdating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setRegions((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchPostData(CONTROLLER + '/deleteRow', { id });
    setIsDeleting(false);
    setRegions((state) => state.filter((x) => x.id !== id));
  }, []);

  const removeStreet = useCallback(async (id: number) => {
    setIsRemovingStreet(true);
    await fetchPostData(CONTROLLER + '/removeStreet', { id });
    setIsRemovingStreet(false);
    setRegions((state) => state.filter((x) => x.id !== id));
  }, []);

  return {
    columns,
    regions,
    fetchData,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateRow,
    createRow,
    deleteRow,
    removeStreet,
    isRemovingStreet,
    streetColumns
  };
};

export default useWaterSystemRegion;
