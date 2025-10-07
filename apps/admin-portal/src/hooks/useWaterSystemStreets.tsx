import { SearchList } from '@/components/ui/SearchList';
import { fetchPostData } from '@/utils/fetchUtil';
import { Checkbox, FormControlLabel } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

export type SystemStreet = {
  id: number;
  cityId: number;
  cityName: string;
  addressId: string;
  addressName: string;
  addressNumber: number | null;
  officialAddressCode: number | null;
  regionId: number | null;
  active: boolean;
  reader_id: number | null;
};

const CONTROLLER = '../WaterSystemStreetsController';

const useWaterSystemStreets = () => {
  const [systemStreets, setSystemStreets] = useState<SystemStreet[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<MRT_ColumnDef<SystemStreet>[]>(() => {
    return [
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
        Edit: ({ cell, column, row }) => (
          <SearchList
            label="Grad"
            value={cell.getValue() as string}
            endpoint={CONTROLLER + '/getCitiesForSL'}
            multiple={false}
            onChange={(newValue) => {
              const parsed = newValue?.split(' | ');
              if (parsed && parsed.length > 0) {
                row._valuesCache['city_id'] = parsed[0];
              }
              row._valuesCache[column.id] = newValue;
            }}
          />
        ),
        size: 100,
      },
      {
        accessorKey: 'region_name',
        header: 'Rejon',
        Edit: ({ cell, column, row }) => (
          <SearchList
            label="Rejon"
            value={cell.getValue() as string}
            endpoint={CONTROLLER + '/getRegionsForSL'}
            multiple={false}
            onChange={(newValue) => {
              const parsed = newValue?.split(' | ');
              if (parsed && parsed.length > 0) {
                row._valuesCache['region_id'] = parsed[0];
              }
              row._valuesCache[column.id] = newValue;
            }}
          />
        ),
        size: 100,
      },
      {
        accessorKey: 'active',
        header: 'Status',
        size: 100,
        Cell: ({ cell }) => {
          const value = Number(cell.getValue());
          return value === 1 ? 'Aktivan' : 'Neaktivan';
        },
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
        enableEditing: true,
      },
    ];
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsFetching(true);
      const data = await fetchPostData(CONTROLLER + '/getRows');
      setIsFetching(false);
      setSystemStreets(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  const createRow = useCallback(async (row: SystemStreet): Promise<void> => {
    setIsCreating(true);
    const res = await fetchPostData(CONTROLLER + '/addRow', row);
    setIsCreating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setSystemStreets((prev) => [res.data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: SystemStreet) => {
    setIsUpdating(true);
    const res = await fetchPostData(CONTROLLER + '/editRow', row);
    setIsUpdating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setSystemStreets((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchPostData(CONTROLLER + '/deleteRow', { id });
    setIsDeleting(false);
    setSystemStreets((state) => state.filter((x) => x.id !== id));
  }, []);

  return {
    columns,
    systemStreets,
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
