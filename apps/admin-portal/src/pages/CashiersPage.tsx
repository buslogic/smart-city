import Main from '@/components/ui/Main';
import { globalTableProps } from '@/utils/globalTableProps';
import { Add, Delete } from '@mui/icons-material';
import { Box, Button, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import {
  LiteralUnion,
  MaterialReactTable,
  MRT_ColumnDef,
  MRT_EditActionButtons,
  MRT_Row,
  MRT_TableOptions,
  useMaterialReactTable,
} from 'material-react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchPostData } from '@/utils/fetchUtil';
import { SearchList } from '@/components/ui/SearchList';

type Cashier = {
  id: number;
  crm_contact_id: number;
  kasa_id: number;
  crm_contacts_first_name: string;
  crm_contacts_last_name: string;
  naziv_kase: string;
  status: number;
};

export const CashiersPage = ({ title }: { title: string }) => {
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<Cashier[]>([]);

  const getRequestBody = (
    values: Record<
      LiteralUnion<'id' | 'crm_contact_id' | 'kasa_id' | 'crm_contacts_first_name' | 'crm_contacts_last_name' | 'naziv_kase' | 'status', string>,
      any
    >
  ) => {
    let kasa_id = null;
    let { crm_contact_id, naziv_kase } = values;

    const parts = crm_contact_id.split('|');
    if (parts.length > 1) {
      const idParts = parts[0].split(':');
      crm_contact_id = Number(idParts[1].trim());
    }

    const kasaParts = naziv_kase.split('|');
    if (kasaParts.length > 1) {
      kasa_id = Number(kasaParts[0].trim());
    }

    if (!crm_contact_id && !kasa_id) {
      return null;
    }

    return { crm_contact_id, kasa_id };
  };

  const handleCreate: MRT_TableOptions<Cashier>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      const body = getRequestBody(values);
      if (!body) {
        console.log('failed to get request body');
        return;
      }

      setIsSaving(true);

      const { success, data }: { success: boolean; data: Cashier } = await fetchPostData('../CashiersController/addRow', body);
      if (success) {
        setData((prev) => [data, ...prev]);
        toast.success('Uspešno unošenje podataka');
      } else {
        toast.error('Došlo je do greške!');
      }

      setIsSaving(false);
      table.setCreatingRow(null);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleUpdate: MRT_TableOptions<Cashier>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      const body = getRequestBody(values);
      if (!body) {
        console.log('failed to get request body');
        return;
      }

      const bodyData = { ...body, id: row.original.id };
      setIsSaving(true);

      console.log(bodyData);

      const { success, data } = await fetchPostData('../CashiersController/editRow', bodyData);
      if (success) {
        setData((prev) => prev.map((x) => (x.id == data.id ? data : x)));
        toast.success('Uspešna izmena podataka');
      } else {
        toast.error('Došlo je do greške!');
      }

      table.setEditingRow(null);
      setIsSaving(false);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleDelete = async (row: MRT_Row<Cashier>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsSaving(true);
        const { success }: { success: boolean; data: Cashier } = await fetchPostData('../CashiersController/deleteRow', {
          id: row.original.id,
        });

        if (success) {
          setData((prev) => prev.filter((x) => x.id !== row.original.id));
          toast.success('Uspešno brisanje podataka');
        } else {
          toast.error('Došlo je do greške');
        }

        setIsSaving(false);
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const columns = useMemo<MRT_ColumnDef<Cashier>[]>(() => {
    return [
      {
        accessorKey: 'crm_contacts_first_name',
        header: 'Ime',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'crm_contacts_last_name',
        header: 'Prezime',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'crm_contact_id',
        header: 'Ime',
        size: 100,
        Edit: ({ column, row }) => {
          return (
            <SearchList
              label="Fizičko lice"
              endpoint={'../UserAccountController/getUnusedCashierCrmContactsForSL'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
      },
      {
        accessorKey: 'naziv_kase',
        header: 'Kasa',
        size: 100,
        enableEditing: false,
        Edit: ({ cell, column, row }) => {
          console.log('EDIT:', cell.getValue());
          return (
            <SearchList
              label="Kasa"
              value={cell.getValue() as string}
              endpoint={'../CashRegisterController/getCashRegisterForSL'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status kase',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
        Cell: ({ cell }) => {
          const value = Number(cell.getValue());
          return <>{value === 1 ? 'Otvorena' : 'Zatvorena'}</>;
        },
      },
    ];
  }, [data]);

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    initialState: {
      columnVisibility: { crm_contact_id: false, kasa: false },
    },
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h5">Novi blagajnik</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </>
    ),
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <Tooltip title="Brisanje">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="error"
            onClick={() => handleDelete(row)}
          >
            <Delete />
          </Button>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        variant="contained"
        color="primary"
        startIcon={<Add />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Novi blagajnik
      </Button>
    ),
    state: {
      isLoading,
      isSaving: isSaving,
      showProgressBars: isFetching,
    },
  });

  const fetchCashiers = async () => {
    try {
      const data = await fetchPostData('../CashiersController/getAll');
      console.log(data);
      setIsFetching(false);
      setData(data);
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
    }
  };

  useEffect(() => {
    fetchCashiers();
  }, []);

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default CashiersPage;
