import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { api } from '@/services/api';
import { globalTableProps } from '@/utils/globalTableProps';
import { Box } from '@mui/material';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type WaterPricelistReview = {
  sifra_potrosaca: number;
  naziv_potrosaca: string;
  pricelist_id: number;
  service: string;
};

export default function WaterServicesReviewPage({ title }: { title: string }) {
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [rows, setRows] = useState<WaterPricelistReview[]>([]);

  async function handleFilterChange(newValue: string) {
    try {
      setIsFetching(true);

      const parts = newValue.split('|');
      const idmm = Number(parts[0].trim());

      const { data } = await api.get<WaterPricelistReview[]>(`/api/water-service-prices/by-measuring-point/${idmm}`);
      setRows(data);
    } catch (err) {
      console.error(err);
      toast.error('Došlo je do interne greške');
    } finally {
      setIsFetching(false);
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
          endpoint="/api/water-meters/measuring-points/search-list"
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
