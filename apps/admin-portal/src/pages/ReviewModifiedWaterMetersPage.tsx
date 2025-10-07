import { useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { fetchPostData } from '@/utils/fetchUtil';
import dayjs, { Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers';

type Row = {
  id: number;
  idmm: number;
};

export const ReviewModifiedWaterMetersPage = ({ title = 'Pregled izmenjenih vodomera' }: { title?: string }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [data, setData] = useState<Row[]>([]);
  const [, setPeriod] = useState<dayjs.Dayjs>();

  async function handleDateChange(value: Dayjs | null) {
    if (value && value.isValid()) {
      setIsFetching(true);
      const date = value.format('YYYY-MM');
      if (date.startsWith('2')) {
        try {
          // TODO: Implementirati backend endpoint
          const rows: Row[] = await fetchPostData('../ReadingsController/getReplacedWaterMetersForRedingPeriod', { period: date });
          console.log(rows);
          setData(rows);
          setPeriod(value);
        } catch (error) {
          console.error('Endpoint nije implementiran:', error);
          setData([]);
        }
      }
      setIsFetching(false);
    }
  }

  const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
      },
      {
        accessorKey: 'idmm',
        header: 'ID Mernog mesta',
        size: 100,
      },
      {
        accessorKey: 'z_vodomer',
        header: 'zVodomer',
        size: 100,
      },
      {
        accessorKey: 'z_pocetno',
        header: 'zPocetnoStanje',
        size: 100,
      },
      {
        accessorKey: 'z_zavrsno',
        header: 'zZavrsnoStanje',
        size: 100,
      },
      {
        accessorKey: 'z_izmereno',
        header: 'zIzmereno',
        size: 100,
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false },
    },
    state: {
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <DatePicker
        views={['month', 'year']}
        label="Mesec i godina"
        sx={{ width: '20%', mb: 2, mx: 'auto' }}
        onChange={(newValue) => handleDateChange(newValue)}
      />
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default ReviewModifiedWaterMetersPage;
