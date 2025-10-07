import { fetchPostData } from '@/utils/fetchUtil';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { SearchList } from '@/components/ui/SearchList';

const CONTROLLER = '../WaterReadersController';

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
  firstName: string;
  lastName: string;
  employee_code: string;
  regions: RegionReader[];
  addresses: AddressReader[];
  // region_ids: string[];
  // address_ids: string[];
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
              multiple={true}
              onChange={(value) => {
                row._valuesCache['region_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parsed[0];
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
              multiple={true}
              onChange={(value) => {
                row._valuesCache['address_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parsed[0];
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
      const data = await fetchPostData(CONTROLLER + '/getRowByID', { id: readerId });
      return data as WaterReader;
    } catch (err) {
      return null;
    }
  };

  const assignReaderRegion = useCallback(
    async (row: RegionReader): Promise<void> => {
      const res = await fetchPostData(CONTROLLER + '/assignReaderRegion', row);
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
      const res = await fetchPostData(CONTROLLER + '/assignReaderAddress', row);
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
      const res = await fetchPostData(CONTROLLER + '/removeReaderRegion', row);
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
      const res = await fetchPostData(CONTROLLER + '/removeReaderAddress', row);
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
              multiple={true}
              onChange={(value) => {
                row._valuesCache['region_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parsed[0];
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
              multiple={true}
              onChange={(value) => {
                row._valuesCache['address_ids'] = value.map((x) => {
                  const parsed = x.split(' | ');
                  return parsed[0];
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
    const data = await fetchPostData(CONTROLLER + '/getRows');
    setIsFetching(false);
    setReaders(data);
  }, []);

  const createRow = useCallback(async (row: WaterReader): Promise<void> => {
    setIsCreating(true);
    const res = await fetchPostData(CONTROLLER + '/addRow', row);
    setIsCreating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setReaders((prev) => [res.data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: WaterReader) => {
    setIsUpdating(true);
    const res = await fetchPostData(CONTROLLER + '/editRow', row);
    setIsUpdating(false);
    if (!res.success) {
      throw new Error(res.error);
    }
    setReaders((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchPostData(CONTROLLER + '/deleteRow', { id });
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
