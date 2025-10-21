import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-toastify';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { api } from '@/services/api';
import { SearchList } from '@/components/ui/SearchList';

type SystemZone = {
  id: number;
  zone_name: string;
  type_id: number;
  type: string;
  type_name: string;
  edit_datetime?: string;
  edit_user_id?: number;
};

type ZoneMeasuringPoint = {
  id: number;
  zone_id: number;
  idmm: number;
  address_name?: string;
  region_name?: string;
};

export const WaterSystemZonesPage = ({ title }: { title: string }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<SystemZone[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [zoneMeasuringPoints, setZoneMeasuringPoints] = useState<ZoneMeasuringPoint[]>([]);
  const [refreshMeasuringPoints, setRefreshMeasuringPoints] = useState(0);

  const fetchData = async () => {
    try {
      setIsFetching(true);
      const response = await api.get('/api/water-system-zones');
      setData(response.data);
    } catch (err: any) {
      console.error(err);
      toast.error('Došlo je do greške');
    } finally {
      setIsFetching(false);
    }
  };

  const fetchZoneMeasuringPoints = async (zoneId: number) => {
    try {
      const response = await api.get(`/api/water-system-zones/${zoneId}/measuring-points`);
      setZoneMeasuringPoints(response.data);
    } catch (err: any) {
      console.error(err);
      toast.error('Greška pri učitavanju mernih mesta');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedZoneId) {
      fetchZoneMeasuringPoints(selectedZoneId);
    }
  }, [selectedZoneId, refreshMeasuringPoints]);

  const handleCreate: MRT_TableOptions<SystemZone>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      setIsSaving(true);
      const typeParts = values.type?.split(' | ');
      if (!typeParts || typeParts.length === 0) {
        toast.error('Tip zone je obavezan');
        return;
      }

      const { id, edit_datetime, edit_user_id, type, type_name, ...createData } = values;
      const body = { ...createData, type_id: parseInt(typeParts[0]) };
      const response = await api.post('/api/water-system-zones', body);
      const { success, data } = response.data;
      if (success) {
        setData((x) => [data, ...x]);
        toast.success('Uspešno unošenje podataka');
      } else {
        toast.error('Došlo je do greške prilikom čuvanja podataka');
      }
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate: MRT_TableOptions<SystemZone>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      setIsSaving(true);
      const id = row.original.id;
      const typeParts = values.type?.split(' | ');
      if (!typeParts || typeParts.length === 0) {
        toast.error('Tip zone je obavezan');
        return;
      }

      const { id: _, edit_datetime, edit_user_id, type, type_name, type_id, ...updateData } = values;
      const body = { ...updateData, type_id: parseInt(typeParts[0]) };
      const response = await api.put(`/api/water-system-zones/${id}`, body);
      const { success, data } = response.data;
      table.setEditingRow(null);
      if (success) {
        setData((p) => p.map((x) => (x.id === id ? data : x)));
        toast.success('Uspešna izmena podataka');
      } else {
        toast.error('Neuspešna izmena podataka');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: MRT_Row<SystemZone>) => {
    if (window.confirm('Da li potvrđujete brisanje?')) {
      try {
        setIsSaving(true);
        await api.delete(`/api/water-system-zones/${row.original.id}`);
        setData((x) => x.filter((x) => x.id !== row.original.id));
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.error(err);
        toast.error('Došlo je do greške');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCreateMeasuringPoint = async (values: any) => {
    try {
      const regionParts = values.region_name?.split(' | ');
      const idmmParts = values.idmm?.split(' | ');

      const body: any = { zone_id: selectedZoneId };
      if (regionParts && regionParts.length > 0) {
        body.region_id = parseInt(regionParts[0]);
      }
      if (idmmParts && idmmParts.length > 0) {
        body.idmm = parseInt(idmmParts[0]);
      }

      const response = await api.post('/api/water-system-zones/measuring-points', body);
      if (response.data.success) {
        const message = response.data.message || 'Uspešno dodato merno mesto';
        if (response.data.addedCount === 0) {
          toast.info(message);
        } else {
          toast.success(message);
        }
        setRefreshMeasuringPoints((prev) => prev + 1);
      } else {
        toast.error('Greška pri dodavanju mernog mesta');
      }
    } catch (err) {
      console.error(err);
      toast.error('Došlo je do greške');
    }
  };

  const handleDeleteMeasuringPoint = async (row: MRT_Row<ZoneMeasuringPoint>) => {
    if (window.confirm('Da li potvrđujete brisanje mernog mesta?')) {
      try {
        const response = await api.delete(
          `/api/water-system-zones/${row.original.zone_id}/measuring-points/${row.original.idmm}`
        );
        if (response.data.success) {
          toast.success('Uspešno obrisano merno mesto');
          setRefreshMeasuringPoints((prev) => prev + 1);
        } else {
          toast.error('Greška pri brisanju mernog mesta');
        }
      } catch (err) {
        console.error(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const columns = useMemo<MRT_ColumnDef<SystemZone>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        Edit: () => <></>,
      },
      {
        accessorKey: 'zone_name',
        header: 'Naziv zone',
        size: 100,
      },
      {
        accessorKey: 'type',
        header: 'Tip zone',
        size: 250,
        enableEditing: true,
        Cell: ({ cell }) => {
          const value = cell.getValue() as string;
          return value?.split(' | ')[1] || '';
        },
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Tip zone"
              value={cell.getValue() as string}
              endpoint="/api/water-system-zones/zone-types/search-list"
              multiple={false}
              fetchOnRender={true}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
      },
    ];
  }, []);

  const measuringPointColumns = useMemo<MRT_ColumnDef<ZoneMeasuringPoint>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        Edit: () => <></>,
      },
      {
        accessorKey: 'address_name',
        header: 'Adresa',
        size: 200,
        Edit: () => <></>,
      },
      {
        accessorKey: 'idmm',
        header: 'IDMM',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          if (typeof value === 'string' && value.includes(' | ')) {
            return value.split(' | ')[1];
          }
          return value || '';
        },
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Merno mesto"
              value={cell.getValue() as string}
              endpoint="/api/water-meters/measuring-points/search-list"
              multiple={false}
              fetchOnRender={true}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
      },
      {
        accessorKey: 'region_name',
        header: 'Rejon',
        size: 200,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          if (typeof value === 'string' && value.includes(' | ')) {
            return value.split(' | ')[1];
          }
          return value || '';
        },
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Rejon"
              value={cell.getValue() as string}
              endpoint="/api/water-system-regions/search-list"
              multiple={false}
              fetchOnRender={true}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
      },
    ];
  }, []);

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
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Upisivanje
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
          Izmena (ID: {row.original.id})
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
          <Tooltip title="Informacije">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="info"
              onClick={() => setSelectedZoneId(row.original.id)}
            >
              <InfoIcon />
            </Button>
          </Tooltip>
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
      <Box
        sx={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          Dodaj
        </Button>
      </Box>
    ),
    state: {
      isLoading: isFetching,
      isSaving: isSaving,
      showProgressBars: isFetching,
    },
  });

  const measuringPointsTable = useMaterialReactTable({
    ...globalTableProps,
    columns: measuringPointColumns,
    data: zoneMeasuringPoints,
    createDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.id),
    initialState: {
      columnVisibility: { id: false },
    },
    onEditingRowCancel: ({ table }) => table.setCreatingRow(null),
    onCreatingRowSave: ({ values, table }) => {
      handleCreateMeasuringPoint(values);
      table.setCreatingRow(null);
    },
    renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
          Dodaj merno mesto
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Box>
    ),
    renderRowActions: ({ row }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleDeleteMeasuringPoint(row)}
            >
              <DeleteIcon />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Dodaj merno mesto
      </Button>
    ),
  });

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
      <Dialog open={!!selectedZoneId} onClose={() => setSelectedZoneId(null)} fullWidth maxWidth="lg">
        <DialogTitle variant="h5" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Merna mesta u zoni - {selectedZoneId}
          <IconButton onClick={() => setSelectedZoneId(null)} edge="end" aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <MaterialReactTable table={measuringPointsTable} />
        </DialogContent>
      </Dialog>
    </Main>
  );
};

export default WaterSystemZonesPage;
