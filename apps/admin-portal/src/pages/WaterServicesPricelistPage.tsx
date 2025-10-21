import { useState } from 'react';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { WaterServicesPricelist } from '@/types/finance';
import useWaterServicesPricelist from '@/hooks/useWaterServicesPricelist';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';

export const WaterServicesPricelistPage = ({ title }: { title: string }) => {
  const { documentFile, service, columns, fetchData, createRow, deleteRow, updateRow, isFetching } = useWaterServicesPricelist();
  const [category, setCategory] = useState('');

  async function handleFilterChange(value: string) {
    try {
      const parts = value.split('|');
      if (parts.length == 2) {
        const id = parts[0].trim();
        await fetchData(id);
        setCategory(value);
      }
    } catch (err) {
      console.log(err);
    }
  }

  const parseCategory = (category: string) => {
    const parts = category.split('|');
    if (parts.length == 2) {
      const id = parts[0].trim();
      const name = parts[1].trim();
      return { id, name };
    }
    return null;
  };

  const validatePricelist = (row: WaterServicesPricelist): boolean => {
    if (row.price <= 0) {
      toast.error('Cena mora biti veća od nule!');
      return false;
    }
    return true;
  };

  const handleCreate: MRT_TableOptions<WaterServicesPricelist>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      if (!validatePricelist(values)) return;

      const categoryParsed = parseCategory(category);
      if (!categoryParsed) {
        toast.error('Došlo je do greške');
        return;
      }

      const { name: categoryName, id } = categoryParsed;
      values['category_id'] = id;
      values['category_name'] = categoryName;

      const serviceParsed = parseCategory(values.service);
      if (!serviceParsed) {
        toast.error('Došlo je do greške');
        return;
      }

      const { id: serviceId, name: serviceName } = serviceParsed;
      values['service_id'] = serviceId;
      values['service_name'] = serviceName;
      values['document_file'] = documentFile;

      await createRow(values);
      toast.success('Uspešno unošenje podataka');
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<WaterServicesPricelist>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      if (!validatePricelist(values)) return;

      values['id'] = row.original.id;

      const categoryParsed = parseCategory(category);
      if (!categoryParsed) {
        toast.error('Došlo je do greške');
        return;
      }

      const { name: categoryName, id } = categoryParsed;
      values['category_id'] = id;
      values['category_name'] = categoryName;
      values['document_file'] = documentFile;

      const serviceParsed = parseCategory(values.service);
      if (!serviceParsed) {
        toast.error('Došlo je do greške');
        return;
      }
      const { id: serviceId, name: serviceName } = serviceParsed;
      values['service_id'] = serviceId;
      values['service_name'] = serviceName;

      await updateRow(values);
      table.setEditingRow(null);
      toast.success('Uspešna izmena podataka');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<WaterServicesPricelist>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        await deleteRow(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      }
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: service,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false, code: false },
    },
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Dodavanje novog cenovnika
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderEditRowDialogContent: ({ table, internalEditComponents, row }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Izmena cenovnika (ID: {row.original.id})
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderRowActions: ({ row, table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Izmena">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="primary"
              onClick={() => table.setEditingRow(row)}
            >
              <EditIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Deaktiviraj">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleDelete(row)}
            >
              <RemoveCircleIcon />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        disabled={!category}
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Dodaj
      </Button>
    ),
    state: {
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box sx={{ width: '500px', marginBottom: '12px' }}>
        <SearchList
          label="Kategorija usluga"
          endpoint="/api/water-service-prices/search-categories"
          multiple={false}
          onChange={handleFilterChange}
          textFieldProps={{
            variant: 'standard',
          }}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default WaterServicesPricelistPage;
