import { useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Checkbox, FormControlLabel, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { fetchPostData } from '@/utils/fetchUtil';
import dayjs from 'dayjs';

type Row = {
  id: number;
  service: string;
  category: string;
  created_at: string;
  updated_at: string;
  active: boolean;
  pricelist_id: number;
};

export const ManageWaterServicesPage = ({ title }: { title: string }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [data, setData] = useState<Row[]>([]);
  const [userAccountID, setUserAccountID] = useState<null | string>(null);

  async function fetchUserAccountServices(user_account_id: string) {
    setIsFetching(true);
    const data: Row[] = await fetchPostData('../UserAccountController/getServicesByUserAccountID', { user_account_id });
    setIsFetching(false);
    setUserAccountID(user_account_id);
    setData(data);
  }

  function handleFilterChange(newValue: string) {
    const parts = newValue.split('|');
    const idParts = parts[0].split(':');
    let userId;
    if (idParts.length > 1) {
      userId = idParts[1].trim();
    } else {
      userId = parts[0].trim();
    }
    fetchUserAccountServices(userId);
  }

  const handleCreate: MRT_TableOptions<Row>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsCreating(true);
      const body = { pricelist_id: values.service, user_account_id: userAccountID };
      const { success, data: row } = await fetchPostData('../UserAccountController/assignPricelistToUserAccount', body);
      setIsCreating(false);

      if (success) {
        setData((rows) => [row, ...rows]);
        toast.success('Uspešno unošenje podataka');
        table.setCreatingRow(null);
        return;
      }

      toast.error('Neuspešno čuvanje podataka');
    } catch (err: any) {
      console.log(err.message);
      toast.error('Došlo je do interne greške');
    }
  };

  const handleDelete = async (row: MRT_Row<Row>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsDeleting(true);
        const { success } = await fetchPostData('../UserAccountController/removeAccountService', { id: row.original.id });
        setIsDeleting(false);
        if (success) {
          setData((rows) => rows.filter((x) => x.id !== row.original.id));
          toast.success('Uspešno brisanje podataka');
        } else {
          toast.error('Neuspešno brisanje podataka');
        }
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
      }
    }
  };

  const handleUpdate: MRT_TableOptions<Row>['onEditingRowSave'] = async ({ values, row }) => {
    try {
      setIsUpdating(true);
      values['id'] = row.original.id;
      const { id, pricelist_id } = row.original;
      const body = { id, active: values.active, pricelist_id, user_account_id: userAccountID };
      const { data, success } = await fetchPostData('../UserAccountController/editUserAccountService', body);
      setIsUpdating(false);
      if (success) {
        table.setEditingRow(null);
        toast.success('Uspešna izmena podataka');
        setData((rows) => rows.map((x) => (x.id === data.id ? data : x)));
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filterValues = useMemo(() => data.map((x) => '' + x.pricelist_id), [data]);

  const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'service',
        header: 'Usluga',
        size: 100,
        enableEditing: false,
        Edit: ({ cell, row, column }) => {
          if (table.getState().editingRow) return <></>;

          let value = cell.getValue() as string;
          if (value) value = row.original.pricelist_id + ' | ' + value;

          return (
            <SearchList
              label="Usluga"
              endpoint="../WaterServicesPricelistController/getPricelistServicesForSL"
              value={value}
              multiple={false}
              filterValues={filterValues}
              allOptionsFilteredComponent={
                <Typography variant="body2" color="info">
                  Sve usluge su dodeljene ovom korisniku
                </Typography>
              }
              onChange={(newValue) => {
                if (typeof newValue === 'string' && newValue.includes('|')) {
                  const id = newValue.split('|')[0]?.trim();
                  row._valuesCache[column.id] = Number(id);
                }
              }}
            />
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Kategorija',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'created_at',
        header: 'Datum dodele',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
        Cell: ({ row }) => {
          const date = dayjs(row.original.created_at, 'YYYY-MM-DD HH:mm:ss');
          return date.isValid() ? date.format('DD.MM.YYYY HH:mm:ss') : '';
        },
      },
      {
        accessorKey: 'updated_at',
        header: 'Datum izmene',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
        Cell: ({ row }) => {
          const date = dayjs(row.original.updated_at, 'YYYY-MM-DD HH:mm:ss');
          return date.isValid() ? date.format('DD.MM.YYYY HH:mm:ss') : '';
        },
      },
      {
        accessorKey: 'active',
        header: 'Aktivno',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue() as number | undefined;
          const checked = value !== undefined && value > 0;
          return <Checkbox disabled checked={checked} id={`fixed_charge_cell_${cell.row.id}`} />;
        },
        Edit: ({ cell, row, column }) => {
          const value = Number(cell.getValue());
          const initial = value !== undefined && value > 0;
          const [checked, setChecked] = useState(initial);
          const isCreatingRow = !!table.getState().creatingRow;
          return (
            <FormControlLabel
              label="Aktivno"
              control={
                <Checkbox
                  checked={checked || isCreatingRow}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setChecked(isChecked);
                    row._valuesCache[column.id] = isChecked ? 1 : 0;
                  }}
                />
              }
            />
          );
        },
      },
    ];
  }, [filterValues]);

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false },
    },
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
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
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleDelete(row)}
            >
              <DeleteIcon />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        disabled={!userAccountID}
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Dodeli uslugu
      </Button>
    ),
    state: {
      isSaving: isCreating || isDeleting || isUpdating,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box sx={{ width: '500px', marginBottom: '12px' }}>
        <SearchList
          label="Korisnik"
          endpoint={`../UserAccountController/getUserAccountsForSL`}
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

export default ManageWaterServicesPage;
