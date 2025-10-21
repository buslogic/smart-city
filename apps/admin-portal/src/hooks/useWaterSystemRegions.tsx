import { useCallback, useMemo, useState } from 'react';
import { MRT_ColumnDef } from 'material-react-table';
import { api } from '@/services/api';

export type Region = {
  id: number;
  region_name: string;
  reader_id?: number | null;
};

export type SystemStreet = {
  id: number;
  city_id: number;
  cities_name: string;
  address_name: string;
  address_number: number | null;
  official_address_code: number | null;
  region_id: number | null;
  active: number;
};

const useWaterSystemRegions = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingStreet, setIsRemovingStreet] = useState(false);

  const columns = useMemo<MRT_ColumnDef<Region>[]>(() => {
    return [
      {
        accessorKey: 'region_name',
        header: 'Rejon',
        size: 100,
      },
    ];
  }, []);

  const streetColumns = useMemo<MRT_ColumnDef<SystemStreet>[]>(
    () => [
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
        Cell: ({ cell }) => (Number(cell.getValue()) === 1 ? 'Aktivan' : 'Neaktivan'),
      },
    ],
    []
  );

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const response = await api.get('/api/water-system-regions');
      setRegions(response.data);
    } catch (err) {
      console.error('Error fetching regions:', err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const createRow = useCallback(async (row: Partial<Region>): Promise<void> => {
    setIsCreating(true);
    try {
      const { id, ...data } = row;
      const response = await api.post('/api/water-system-regions', data);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create');
      }
      setRegions((prev) => [response.data.data, ...prev]);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: Region) => {
    setIsUpdating(true);
    try {
      const response = await api.put(`/api/water-system-regions/${row.id}`, {
        region_name: row.region_name,
      });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update');
      }
      setRegions((prev) => prev.map((x) => (x.id === row.id ? response.data.data : x)));
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/water-system-regions/${id}`);
      setRegions((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const removeStreet = useCallback(async (id: number) => {
    setIsRemovingStreet(true);
    try {
      await api.delete(`/api/water-system-regions/streets/${id}`);
    } finally {
      setIsRemovingStreet(false);
    }
  }, []);

  const getStreetsByRegion = useCallback(async (regionId: number) => {
    try {
      const response = await api.get(`/api/water-system-regions/streets/${regionId}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching streets:', err);
      return [];
    }
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
    streetColumns,
    getStreetsByRegion,
  };
};

export default useWaterSystemRegions;
