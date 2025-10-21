import { useCallback, useMemo, useState } from 'react';
import { MRT_ColumnDef } from 'material-react-table';
import { api } from '@/services/api';
import { SearchList } from '@/components/ui/SearchList';
import { Checkbox, FormControlLabel } from '@mui/material';

export type Street = {
  id: number;
  city_id: number;
  address_name: string;
  address_number: string | null;
  official_address_code: string | null;
  region_id: number | null;
  active: number;
  edit_user_id?: number | null;
  edit_datetime?: string | null;
  cities_name?: string;
  region_name?: string;
};

const useWaterSystemStreets = () => {
  const [streets, setStreets] = useState<Street[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<MRT_ColumnDef<Street>[]>(() => {
    return [
      {
        accessorKey: 'address_name',
        header: 'Naziv ulice',
        size: 200,
      },
      {
        accessorKey: 'address_number',
        header: 'Broj',
        size: 100,
      },
      {
        accessorKey: 'official_address_code',
        header: 'Zvanična šifra',
        size: 150,
      },
      {
        accessorKey: 'cities_name',
        header: 'Grad',
        size: 150,
        Edit: ({ cell, column, row }) => (
          <SearchList
            label="Grad"
            value={cell.getValue() as string}
            endpoint="/api/water-system-streets/cities/search-list"
            multiple={false}
            fetchOnRender={true}
            onChange={(newValue) => {
              const parsed = newValue?.split(' | ');
              if (parsed && parsed.length > 0) {
                row._valuesCache['city_id'] = Number(parsed[0]);
              }
              row._valuesCache[column.id] = newValue;
            }}
          />
        ),
      },
      {
        accessorKey: 'region_name',
        header: 'Rejon',
        size: 150,
        Edit: ({ cell, column, row }) => (
          <SearchList
            label="Rejon"
            value={cell.getValue() as string}
            endpoint="/api/water-system-regions/search-list"
            multiple={false}
            fetchOnRender={true}
            onChange={(newValue) => {
              const parsed = newValue?.split(' | ');
              if (parsed && parsed.length > 0) {
                row._valuesCache['region_id'] = Number(parsed[0]);
              } else {
                row._valuesCache['region_id'] = null;
              }
              row._valuesCache[column.id] = newValue;
            }}
          />
        ),
      },
      {
        accessorKey: 'active',
        header: 'Status',
        size: 100,
        Cell: ({ cell }) => (Number(cell.getValue()) === 1 ? 'Aktivan' : 'Neaktivan'),
        Edit: ({ cell, row, column }) => {
          const value = Number(cell.getValue());
          const initial = value === 1;
          const [checked, setChecked] = useState(initial);
          return (
            <FormControlLabel
              control={
                <Checkbox
                  checked={checked}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setChecked(isChecked);
                    row._valuesCache[column.id] = isChecked ? 1 : 0;
                  }}
                />
              }
              label="Status"
            />
          );
        },
      },
    ];
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const response = await api.get('/api/water-system-streets');
      setStreets(response.data);
    } catch (err) {
      console.error('Error fetching streets:', err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const createRow = useCallback(async (row: Partial<Street>): Promise<void> => {
    setIsCreating(true);
    try {
      const { id, cities_name, region_name, ...data } = row;
      const response = await api.post('/api/water-system-streets', data);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create');
      }
      setStreets((prev) => [response.data.data, ...prev]);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: Street) => {
    setIsUpdating(true);
    try {
      const { id, cities_name, region_name, edit_user_id, edit_datetime, ...data } = row;
      const response = await api.put(`/api/water-system-streets/${id}`, data);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update');
      }
      setStreets((prev) => prev.map((x) => (x.id === id ? response.data.data : x)));
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/water-system-streets/${id}`);
      setStreets((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return {
    columns,
    streets,
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

export default useWaterSystemStreets;
