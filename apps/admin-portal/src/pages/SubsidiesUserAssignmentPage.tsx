import Main from '@/components/ui/Main';
import { globalTableProps } from '@/utils/globalTableProps';
import { Add, Delete, Edit } from '@mui/icons-material';
import { Box, Button, Checkbox, DialogActions, DialogContent, DialogTitle, FormControlLabel, Tooltip } from '@mui/material';
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { SearchList } from '@/components/ui/SearchList';
import { fetchPostData } from '@/utils/fetchUtil';
import { SubsidyAssignment } from '@/types/subsidies';

export const SubsidiesUserAssignmentPage = ({ title }: { title: string }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<SubsidyAssignment[]>([]);
  const [userID, setUserID] = useState<number | null>(null);

  const handleCreate: MRT_TableOptions<SubsidyAssignment>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      const parts = values['naziv'].split(' | ');
      if (!userID || parts.length == 0) {
        toast.error('Došlo je do greške');
        return;
      }

      const body = {
        korisnik_id: userID,
        subvencija_id: parts[0].trim(),
        status: values['status'],
      };

      setIsSaving(true);
      const { success, data }: { success: boolean; data: SubsidyAssignment } = await fetchPostData(
        '../SubsidiesUserAssignmentController/assignSubvention',
        body
      );

      if (success) {
        setData((prev) => [data, ...prev]);
        toast.success('Uspešno unošenje podataka');
      } else {
        toast.error('Došlo je do greške!');
      }

      table.setCreatingRow(null);
      setIsSaving(false);
    } catch (err: any) {
      console.log(err);
      toast.error('Došlo je do greške!');
    }
  };

  const handleUpdate: MRT_TableOptions<SubsidyAssignment>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      if (!userID) {
        toast.error('Došlo je do greške. Nedostaje ID korisnika');
        return;
      }

      setIsSaving(true);
      const body = {
        id: row.original.id,
        status: values['status'],
        korisnik_id: userID,
        subvencija_id: values['subvencija_id'],
      };

      const parts = values['naziv'].split('|');
      if (parts.length > 1) {
        body['subvencija_id'] = Number(parts[0].trim());
      }

      const { success, data } = await fetchPostData('../SubsidiesUserAssignmentController/reassignSubvention', body);
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

  const handleDelete = async (row: MRT_Row<SubsidyAssignment>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsSaving(true);
        const { success }: { success: boolean; data: SubsidyAssignment } = await fetchPostData(
          '../SubsidiesUserAssignmentController/removeSubvention',
          { id: row.original.id }
        );

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

  const filterValues = useMemo(() => data.map((x) => String(x.subvencija_id)), [data]);

  const columns = useMemo<MRT_ColumnDef<SubsidyAssignment>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'korisnik_id',
        header: 'ID korisnika',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'subvencija_id',
        header: 'ID subvencije',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'naziv',
        header: 'Subvencija',
        size: 100,
        Edit: ({ row, column }) => {
          const { subvencija_id, naziv } = row.original;
          let value = '';
          if (naziv) {
            value = `${subvencija_id} | ${naziv}`;
          }
          return (
            <SearchList
              label="Subvencija"
              endpoint={`../SubsidiesController/getSubsidiesForSL`}
              value={value}
              multiple={false}
              filterValues={filterValues}
              onChange={(value) => {
                row._valuesCache[column.id] = value;
              }}
              textFieldProps={{
                variant: 'standard',
              }}
            />
          );
        },
      },
      {
        accessorKey: 'iznos',
        header: 'Iznos subvencije',
        size: 150,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'limit',
        header: 'Limit subvencije',
        size: 150,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'datum_dodele',
        header: 'Datum dodele',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'dodelio',
        header: 'Dodelio',
        size: 100,
        enableEditing: false,
        Edit: () => <></>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue() as number | undefined;
          return <Checkbox disabled checked={value === 1} />;
        },
        Edit: ({ cell, row, column }) => {
          const value = Number(cell.getValue());
          const initial = value !== undefined && value > 0;
          const [checked, setChecked] = useState(initial);
          return (
            <FormControlLabel
              label="Status"
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
            />
          );
        },
      },
    ];
  }, [data, filterValues]);

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
      columnVisibility: { id: false, subvencija_id: false, korisnik_id: false },
    },
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h4">Dodeli subvenciju</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </>
    ),
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Izmena">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="primary"
            onClick={() => table.setEditingRow(row)}
          >
            <Edit />
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
        Dodeli subvenciju
      </Button>
    ),
    state: {
      isLoading,
      isSaving: isSaving,
      showProgressBars: isFetching,
    },
  });

  function extractUserID(value: string) {
    const parts = value.split('|');
    const idParts = parts[0].split(':');
    let userId;
    if (idParts.length > 1) {
      userId = idParts[1].trim();
    } else {
      userId = parts[0].trim();
    }
    return userId;
  }

  async function handleUserAccountChange(newValue: string) {
    try {
      setIsFetching(true);
      const userId = extractUserID(newValue);
      const data = await fetchPostData('../SubsidiesUserAssignmentController/getAssignedSubventions', { id: userId });
      setIsFetching(false);
      setData(data);
      setUserID(Number(userId));
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
    }
  }

  return (
    <Main title={title}>
      <Box sx={{ width: '500px', marginBottom: '12px' }}>
        <SearchList
          label="Korisnik"
          endpoint={`../UserAccountController/getUserAccountsForSL`}
          multiple={false}
          onChange={handleUserAccountChange}
          textFieldProps={{
            variant: 'standard',
          }}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Main>
  );
};

export default SubsidiesUserAssignmentPage;
