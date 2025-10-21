import { fetchAPI } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { SearchList } from '@/components/ui/SearchList';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/water-readers`;

export type RegionReader = {
  id: number;
  reader_id: number;
  region_name: string;
};

export type AddressReader = {
  id: number;
  reader_id: number;
  address_name: string;
};

export type WaterReader = {
  id: number;
  first_name: string;
  last_name: string;
  employee_code: number;
  regions: RegionReader[];
  addresses: AddressReader[];
  region_ids?: number[];
  address_ids?: number[];
};

const useWaterReaders = () => {
  const [readers, setReaders] = useState<WaterReader[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo<MRT_ColumnDef<WaterReader>[]>(() => {
    return [
      {
        accessorKey: 'first_name',
        header: 'Ime',
        size: 100,
      },
      {
        accessorKey: 'last_name',
        header: 'Prezime',
        size: 100,
      },
      {
        accessorKey: 'employee_code',
        header: 'Šifra zaposlenog',
        size: 100,
      },
      {
        accessorKey: 'region_ids',
        header: 'Rejon',
        size: 100,
        Edit: ({ cell, row }) => {
          const isCreate = !row.original?.id;
          return isCreate ? (
            <SearchList
              label="Rejon"
              value={cell.getValue() as string[]}
              endpoint={CONTROLLER + '/getRegionsForSL'}
              fetchOnRender={true}
              multiple={true}
              onChange={(value) => {
                row._valuesCache['region_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parseInt(parsed[0]);
                });
              }}
            />
          ) : null;
        },
      },
      {
        accessorKey: 'address_ids',
        header: 'Ulice',
        size: 100,
        Edit: ({ cell, row }) => {
          const isCreate = !row.original?.id;
          return isCreate ? (
            <SearchList
              label="Ulica"
              value={cell.getValue() as string[]}
              endpoint={CONTROLLER + '/getAddressesForSL'}
              fetchOnRender={true}
              multiple={true}
              onChange={(value) => {
                row._valuesCache['address_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parseInt(parsed[0]);
                });
              }}
            />
          ) : null;
        },
      },
    ];
  }, [readers]);

  const getRowByID = async (readerId: number | null): Promise<WaterReader | null> => {
    try {
      if (!readerId) return null;
      const data = await fetchAPI<WaterReader>(CONTROLLER + '/getrowbyid', {
        method: 'POST',
        data: { id: readerId },
      });
      return data;
    } catch (err) {
      return null;
    }
  };

  const assignReaderRegion = useCallback(
    async (row: RegionReader): Promise<void> => {
      const res = await fetchAPI<{ success: boolean; error?: string }>(
        CONTROLLER + '/assignReaderRegion',
        {
          method: 'POST',
          data: row,
        }
      );
      if (!res.success) {
        throw new Error(res.error);
      }

      const data = await getRowByID(row.id);
      if (data) {
        setReaders((readers) => readers.map((r) => (r.id === data.id ? data : r)));
      }
    },
    [readers]
  );

  const assignReaderAddress = useCallback(
    async (row: AddressReader): Promise<void> => {
      const res = await fetchAPI<{ success: boolean; error?: string }>(
        CONTROLLER + '/assignReaderAddress',
        {
          method: 'POST',
          data: row,
        }
      );
      if (!res.success) {
        throw new Error(res.error);
      }

      const data = await getRowByID(row.id);
      if (data) {
        setReaders((readers) => readers.map((r) => (r.id === data.id ? data : r)));
      }
    },
    [readers]
  );

  const removeReaderRegion = useCallback(
    async (row: RegionReader): Promise<void> => {
      const res = await fetchAPI<{ success: boolean; error?: string }>(
        CONTROLLER + '/removeReaderRegion',
        {
          method: 'POST',
          data: row,
        }
      );
      if (!res.success) {
        throw new Error(res.error);
      }

      const data = await getRowByID(row.reader_id);
      if (data) {
        setReaders((readers) => readers.map((r) => (r.id === row.reader_id ? data : r)));
      }
    },
    [readers]
  );

  const removeReaderAddress = useCallback(
    async (row: AddressReader): Promise<void> => {
      const res = await fetchAPI<{ success: boolean; error?: string }>(
        CONTROLLER + '/removeReaderAddress',
        {
          method: 'POST',
          data: row,
        }
      );
      if (!res.success) {
        throw new Error(res.error);
      }

      const data = await getRowByID(row.reader_id);
      if (data) {
        setReaders((readers) => readers.map((reader) => (reader.id === row.reader_id ? data : reader)));
      }
    },
    [readers]
  );

  const regionColumns = useMemo<MRT_ColumnDef<RegionReader>[]>(() => {
    return [
      {
        accessorKey: 'region_name',
        header: 'Rejon',
        size: 100,
        Edit: ({ cell, row }) => {
          const isCreate = !row.original?.id;
          return isCreate ? (
            <SearchList
              label="Rejon"
              value={cell.getValue() as string[]}
              endpoint={CONTROLLER + '/getRegionsForSL'}
              fetchOnRender={true}
              multiple={true}
              onChange={(value) => {
                row._valuesCache['region_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parseInt(parsed[0]);
                });
              }}
            />
          ) : null;
        },
      },
    ];
  }, [readers]);

  const addressColumns = useMemo<MRT_ColumnDef<AddressReader>[]>(() => {
    return [
      {
        accessorKey: 'address_name',
        header: 'Ulica',
        size: 100,
        Edit: ({ cell, row }) => {
          const isCreate = !row.original?.id;
          return isCreate ? (
            <SearchList
              label="Ulica"
              value={cell.getValue() as string[]}
              endpoint={CONTROLLER + '/getAddressesForSL'}
              fetchOnRender={true}
              multiple={true}
              onChange={(value) => {
                row._valuesCache['address_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parseInt(parsed[0]);
                });
              }}
            />
          ) : null;
        },
      },
    ];
  }, [readers]);

  const fetchData = useCallback(async () => {
    setIsFetching(true);
    const data = await fetchAPI<WaterReader[]>(CONTROLLER + '/getRows', {
      method: 'POST',
    });
    setIsFetching(false);
    setReaders(data);
  }, []);

  const createRow = useCallback(async (row: WaterReader): Promise<void> => {
    setIsCreating(true);
    const res = await fetchAPI<{ success: boolean; error?: string; data: WaterReader }>(
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
    setReaders((prev) => [res.data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: WaterReader) => {
    setIsUpdating(true);
    const res = await fetchAPI<{ success: boolean; error?: string; data: WaterReader }>(
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
    setReaders((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchAPI(CONTROLLER + '/deleteRow', {
      method: 'POST',
      data: { id },
    });
    setIsDeleting(false);
    setReaders((state) => state.filter((x) => x.id !== id));
  }, []);

  return {
    columns,
    readers,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    fetchData,
    updateRow,
    createRow,
    deleteRow,
    addressColumns,
    regionColumns,
    removeReaderAddress,
    removeReaderRegion,
    assignReaderAddress,
    assignReaderRegion,
  };
};

export default useWaterReaders;
