import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { Box, Paper } from '@mui/material';
import { globalTableProps } from '@/utils/globalTableProps';
import { SearchList } from '@/components/ui/SearchList';
import { fetchPostData } from '@/utils/fetchUtil';
import { toast } from 'react-toastify';
import Main from '@/components/ui/Main';

type Consumption = {
  id_popis: string;
  idmm: number;
  idv: string;
  izmereno: number;
  meter_reading: string;
  napomena: string;
  pocetno_stanje: number;
  zavrsno_stanje: number;
};

type inputType = 'idmm' | 'consumer' | null;

const CONTROLLER = '../MeasuringPointsConsumptionController';

const MeasuringPointsConsumptionPage = ({ title }: { title: string }) => {
  const [inputType, setInputType] = useState<inputType>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [data, setData] = useState<Consumption[]>([]);
  const [idmmInput, setIdmmInput] = useState('');
  const [consumerInput, setConsumerInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  async function fetchData() {
    try {
      setIsFetching(true);
      const body = { value: inputValue, type: inputType };
      const { data, success } = await fetchPostData(CONTROLLER + '/getRows', body);
      console.log(data);
      if (success) {
        setData(data);
        return;
      }
      setData([]);
    } catch {
      toast.error('Došlo je do greške');
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (inputValue === '' || !inputType) return;
    fetchData();
  }, [inputType, inputValue]);

  const columns = useMemo<MRT_ColumnDef<Consumption>[]>(
    () => [
      {
        accessorKey: 'id_popis',
        header: 'ID Popis',
        size: 150,
      },
      {
        accessorKey: 'idmm',
        header: 'ID Mernog mesta',
        size: 150,
      },
      {
        accessorKey: 'idv',
        header: 'Brojilo',
        size: 150,
      },
      {
        accessorKey: 'pocetno_stanje',
        header: 'Početno stanje',
        size: 150,
      },
      {
        accessorKey: 'zavrsno_stanje',
        header: 'Završno stanje',
        size: 150,
      },
      {
        accessorKey: 'izmereno',
        header: 'Izmereno',
        size: 150,
      },
      {
        accessorKey: 'prosek',
        header: 'Prosek',
        size: 150,
      },
      {
        accessorKey: 'napomena',
        header: 'Stanje vodomera napomena',
        size: 300,
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    initialState: {
      columnVisibility: {
        id: false,
      },
    },
    state: {
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box mx="auto">
        <Paper sx={{ p: 2, mb: 4 }}>
          <Box display="flex" flexWrap={{ xs: 'wrap', sm: 'nowrap' }} marginTop={2} gap={2} alignItems="center" justifyContent="center">
            <SearchList
              label="Merno mesto"
              endpoint="../WaterMeterController/getMeasuringPointsForSL"
              multiple={false}
              textFieldProps={{
                variant: 'outlined',
                sx: {
                  '& .MuiInputBase-root': {
                    height: 36,
                  },
                  '& .MuiInputBase-input': {
                    padding: '8px 12px',
                    height: 'auto',
                  },
                  '& .MuiInputLabel-root': {
                    top: -8,
                  },
                },
              }}
              value={idmmInput}
              onChange={(newValue) => {
                const [id] = newValue.split(' | ');
                if (!id) return;
                setInputType('idmm');
                setInputValue(id);
                setIdmmInput(newValue);
                setConsumerInput('');
              }}
            />
            <SearchList
              label="Potrošač"
              endpoint="../ConsumersController/getConsumersForSL"
              multiple={false}
              value={consumerInput}
              textFieldProps={{
                variant: 'outlined',
                sx: {
                  '& .MuiInputBase-root': {
                    height: 36,
                  },
                  '& .MuiInputBase-input': {
                    padding: '8px 12px',
                    height: 'auto',
                  },
                  '& .MuiInputLabel-root': {
                    top: -8,
                  },
                },
              }}
              onChange={(newValue) => {
                const [id] = newValue.split(' | ');
                if (!id) return;
                setInputType('consumer');
                setInputValue(id);
                setConsumerInput(newValue);
                setIdmmInput('');
              }}
            />
          </Box>
        </Paper>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default MeasuringPointsConsumptionPage;
