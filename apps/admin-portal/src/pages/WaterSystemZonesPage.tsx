import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, MRT_ColumnDef, MRT_Row, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import { toast } from 'react-toastify';
import { globalTableProps } from '@/utils/globalTableProps';
import Main from '@/components/ui/Main';
import { fetchPostData } from '@/utils/fetchUtil';
import { SearchList } from '@/components/ui/SearchList';
import { GenericTable } from '@/components/ui/GenericTable';

type SystemZone = {
  id: number;
  zone_name: string;
  type_id: number;
  type_name: string;
};

type SystemZoneMeasuringPoint = {
  id: number;
  zone_id: number;
  idmm: number;
  address_name: number;
  region_name: number;
};

export const WaterSystemZonesPage = ({ title }: { title: string }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<SystemZone[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [zoneID, setZoneID] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchData = async () => {
    try {
      setIsFetching(true);
      const data = await fetchPostData('../WaterSystemZonesController/getRows');
      console.log(data);
      setIsFetching(false);
      setData(data);
      console.log(data);
    } catch (err: any) {
      console.log(err);
      toast.error('Doslo je do greske');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<SystemZone>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      const parts = values.type.split('|');
      if (parts.length <= 0) {
        toast.error('Doslo je do greske');
        return;
      }

      setIsSaving(true);
      const body = { type_id: parts[0], zone_name: values.zone_name };
      const { success, data } = await fetchPostData('../WaterSystemZonesController/create', body);
      setIsSaving(false);

      if (success) {
        setData((x) => [data, ...x]);
        toast.success('Uspešno unošenje podataka');
      } else {
        toast.error('Došlo je do greške prilikom čuvanja podataka');
      }
      table.setCreatingRow(null);
    } catch (err: any) {
      console.log(err.message);
      toast.error('Doslo je do greske');
    }
  };

  const handleUpdate: MRT_TableOptions<SystemZone>['onEditingRowSave'] = async ({ values, table }) => {
    try {
      const parts = values.type.split('|');
      if (parts.length <= 0) {
        toast.error('Doslo je do greske');
        return;
      }

      setIsSaving(true);
      const body = { id: values.id, type_id: parts[0], zone_name: values.zone_name };
      const { success, data } = await fetchPostData('../WaterSystemZonesController/update', body);
      setIsSaving(false);

      table.setEditingRow(null);
      if (success) {
        setData((p) => p.map((x) => (x.id === values.id ? data : x)));
        toast.success('Uspešna izmena podataka');
      } else {
        toast.error('Neuspešna izmena podataka');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<SystemZone>) => {
    if (window.confirm('Da li potvrdjujete brisanje?')) {
      try {
        setIsSaving(true);
        const res = await fetchPostData('../WaterSystemZonesController/delete', { id: row.original.id });
        if (res) {
          setIsSaving(false);
          setData((x) => x.filter((x) => x.id !== row.original.id));
          toast.success('Uspešno brisanje podataka');
        }
      } catch (err) {
        console.log(err);
        toast('Došlo je do greške');
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
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Tip zone"
              value={cell.getValue() as string}
              endpoint={'../WaterSystemZonesController/getZoneTypesForSL'}
              multiple={false}
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
    renderRowActions: ({ row, table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Tooltip title="Informacije">
            <Button
              sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
              size="small"
              variant="contained"
              color="info"
              onClick={() => setZoneID(row.original.id)}
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

  const zoneMeasuringPointColumns = useMemo<MRT_ColumnDef<SystemZoneMeasuringPoint>[]>(() => {
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
        size: 100,
        Edit: () => <></>,
      },
      {
        accessorKey: 'idmm',
        header: 'IDMM',
        size: 100,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Merno mesto"
              value={cell.getValue() as string}
              endpoint={'../WaterMeterController/getMeasuringPointsForSL'}
              multiple={false}
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
        size: 250,
        enableEditing: true,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Rejon"
              value={cell.getValue() as string}
              endpoint={'../WaterSystemRegionController/getRegionsForSL'}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
      },
    ];
  }, []);

  const createZoneMeasuringPoint = async (values: any) => {
    try {
      const regionParts = values.region_name.split(' | ');
      const idmm = values.idmm.split(' | ');
      const body = { zone_id: zoneID, region_id: regionParts[0], idmm: idmm[0] };

      const res = await fetchPostData('../WaterSystemZonesController/createZoneMeasuringPoint', body);
      console.log(res);
      if (res) {
        toast.info('Uspešan upis podataka');
      } else {
        toast.error('Došlo je do greške');
      }
    } catch (err) {
      console.log(err);
    }
  };

  const deleteZoneMeasuringPoint = async (row: MRT_Row<SystemZoneMeasuringPoint>) => {
    try {
      const res = await fetchPostData('../WaterSystemZonesController/deleteZoneMeasuringPoint', row.original);
      setRefreshKey(row.original.idmm);
      if (res) {
        toast.info('Uspešno brisanje');
      } else {
        toast.error('Došlo je do greške');
      }
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
      <Dialog open={!!zoneID} onClose={() => setZoneID(null)} fullWidth maxWidth="lg">
        <DialogTitle variant="h5" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Merna mesta u zoni - {zoneID}
          <IconButton onClick={() => setZoneID(null)} edge="end" aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <GenericTable<SystemZoneMeasuringPoint>
            columns={zoneMeasuringPointColumns}
            title=""
            fetchUrl="../WaterSystemZonesController/getZoneMeasuringPoints"
            fetchParams={{ zone_id: zoneID }}
            enableCreate
            enableDelete
            initialState={{
              columnVisibility: { id: false },
            }}
            onCreatingRowSave={({ values }) => createZoneMeasuringPoint(values)}
            onDelete={(row) => deleteZoneMeasuringPoint(row)}
            key={`zone_idmm_${refreshKey}`}
          />
        </DialogContent>
      </Dialog>
    </Main>
  );
};

export default WaterSystemZonesPage;
