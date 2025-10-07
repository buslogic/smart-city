import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { fetchPostData } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { Box } from '@mui/material';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type WaterPricelistReview = {
  sifra_potrosaca: number;
  naziv_potrosaca: string;
  pricelist_id: number;
  service: string;
};

export default function WaterServicesReviewPage({ title }: { title: string }) {
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [filterIDMM, setFilterIDMM] = useState('');
  const [rows, setRows] = useState<WaterPricelistReview[]>([]);

  useEffect(() => {
    console.log(filterIDMM);
  }, []);

  async function handleFilterChange(newValue: string) {
    try {
      setIsFetching(true);

      const parts = newValue.split('|');
      const idmm = parts[0].trim();
      const data: WaterPricelistReview[] = await fetchPostData('../WaterServicesPricelistController/getPricelistsByIDMM', { idmm });

      setRows(data);
      setFilterIDMM(idmm);
      setIsFetching(false);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do interne greške');
    }
  }

  const columns = useMemo<MRT_ColumnDef<WaterPricelistReview>[]>(() => {
    return [
      {
        accessorKey: 'sifra_potrosaca',
        header: 'Šifra potrošača',
        size: 100,
      },
      {
        accessorKey: 'naziv_potrosaca',
        header: 'Ime i prezime/Naziv',
        size: 100,
      },
      {
        accessorKey: 'service',
        header: 'Usluga',
        size: 100,
      },
      {
        accessorKey: 'pricelist_id',
        header: 'ID cenovnika usluge',
        size: 100,
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: rows,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    initialState: {
      columnVisibility: { id: false },
    },
    state: {
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box sx={{ width: '500px', marginBottom: '12px' }}>
        <SearchList
          label="Merno mesto"
          endpoint={`../WaterMeterController/getMeasuringPointsForSL`}
          multiple={false}
          textFieldProps={{
            variant: 'standard',
          }}
          onChange={handleFilterChange}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Main>
  );
}
