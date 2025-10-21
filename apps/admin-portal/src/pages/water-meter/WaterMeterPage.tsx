import { FormModal } from '@/components/ui/FormModal';
import Main from '@/components/ui/Main';
import useWaterMeter from '@/hooks/useWaterMeter';
import { WaterMeter } from '@/types/water-meter';
import { globalTableProps } from '@/utils/globalTableProps';
import { AllInclusive } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip } from '@mui/material';
import { MaterialReactTable, MRT_EditActionButtons, MRT_Row, MRT_TableInstance, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useMeasuringPointsColumns } from '../MeasuringPointsPage';
import AssignWaterMeterToUserModal from './components/AssignToUserModal';
import ChangeHistoryModal from './components/ChangeHistoryModal';

export const WaterMeterPage = ({ title }: { title: string }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formModalIDMM, setFormModalIDMM] = useState<string | null>(null);
  const [assignRowID, setAssignRowID] = useState<number>(0);
  const [changeHistoryID, setChangeHistoryID] = useState<number>(0);

  const {
    historyColumns,
    useWaterMeterColumns,
    waterMeters,
    createItem,
    deleteItem,
    updateItem,
    fetchWaterMeterRows,
    isLoading,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    insertReplacementWaterMeter,
    isChecked,
    idvName
  } = useWaterMeter();

  const waterMeterColumns = useWaterMeterColumns({
    linkSetter: setFormModalIDMM,
  });
  const measuringPointsColumns = useMeasuringPointsColumns({ linkSetter: setFormModalIDMM });

  const fetchData = async () => {
    try {
      fetchWaterMeterRows();
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate: MRT_TableOptions<WaterMeter>['onCreatingRowSave'] = async ({ values, table }) => {
    try {
      const parts = values['measuring_point']?.split(' | ');
      if (parts && parts.length > 0) {
        const [idmmStr] = parts;

        // Transformiši podatke u format koji očekuje backend DTO
        const payload: any = {
          idmm: parseInt(idmmStr),
          counter: values['counter'] ? parseInt(values['counter']) : undefined,
          idv: values['idv'] || undefined,
          serialNumber: values['serial_number'] || undefined,
          module: values['module'] || undefined,
          calibratedFrom: values['calibrated_from'] ? `${values['calibrated_from']}T00:00:00.000Z` : undefined,
          calibratedTo: values['calibrated_to'] ? `${values['calibrated_to']}T00:00:00.000Z` : undefined,
          aktivan: true,
        };

        // Parsiraj ID-eve iz search list vrednosti (format: "ID | Naziv")
        if (values['availability_id']) {
          const availParts = values['availability_id'].split(' | ');
          payload.availabilityId = availParts[0] ? parseInt(availParts[0]) : undefined;
        }

        if (values['type_id']) {
          const typeParts = values['type_id'].split(' | ');
          payload.typeId = typeParts[0] ? parseInt(typeParts[0]) : undefined;
        }

        if (values['manufacturer_id']) {
          const manuParts = values['manufacturer_id'].split(' | ');
          payload.manufacturerId = manuParts[0] ? parseInt(manuParts[0]) : undefined;
        }

        await createItem(payload);

        toast.success('Uspešno unošenje podataka');
        table.setCreatingRow(null);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave: MRT_TableOptions<WaterMeter>['onEditingRowSave'] = async ({ values, row, table }) => {
    try {
      const { id } = row.original;

      // Ako je zamenski vodomer, koristi stari format
      if (isChecked) {
        values['id'] = id;
        let newIdMM = null;
        if (values['measuring_point']) {
          const parts = values['measuring_point'].split(' | ');
          if (parts.length > 1) newIdMM = parts[0].trim();
        }
        values['idmm'] = newIdMM;
        values['old_idv'] = idvName;

        await insertReplacementWaterMeter(values);
        toast.success('Uspešno unet zamenski vodomer');
      } else {
        // Transformiši podatke u format koji očekuje backend DTO
        const payload: any = {
          counter: values['counter'] ? parseInt(values['counter']) : undefined,
          idv: values['idv'] || undefined,
          serialNumber: values['serial_number'] || undefined,
          module: values['module'] || undefined,
          calibratedFrom: values['calibrated_from']
            ? (values['calibrated_from'].includes('T') ? values['calibrated_from'] : `${values['calibrated_from']}T00:00:00.000Z`)
            : undefined,
          calibratedTo: values['calibrated_to']
            ? (values['calibrated_to'].includes('T') ? values['calibrated_to'] : `${values['calibrated_to']}T00:00:00.000Z`)
            : undefined,
          aktivan: true,
        };

        // Parsiraj IDMM iz measuring_point
        if (values['measuring_point']) {
          const parts = values['measuring_point'].split(' | ');
          if (parts.length > 0) {
            payload.idmm = parseInt(parts[0]);
          }
        }

        // Parsiraj ID-eve iz search list vrednosti (format: "ID | Naziv")
        if (values['availability_id']) {
          const availParts = values['availability_id'].split(' | ');
          payload.availabilityId = availParts[0] ? parseInt(availParts[0]) : undefined;
        }

        if (values['type_id']) {
          const typeParts = values['type_id'].split(' | ');
          payload.typeId = typeParts[0] ? parseInt(typeParts[0]) : undefined;
        }

        if (values['manufacturer_id']) {
          const manuParts = values['manufacturer_id'].split(' | ');
          payload.manufacturerId = manuParts[0] ? parseInt(manuParts[0]) : undefined;
        }

        await updateItem(id, payload);
        toast.success('Uspešna izmena podataka');
      }

      table.setEditingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<WaterMeter>) => {
    if (window.confirm('Da li potvrdjujete brisanje vodomera?')) {
      try {
        await deleteItem(row.original.id);
        toast.success('Uspešno brisanje podataka');
      } catch (err) {
        console.log(err);
        toast.error('Došlo je do greške');
      }
    }
  };

  const handleEditClose = (table: MRT_TableInstance<WaterMeter>) => {
    table.setEditingRow(null);
    setSearchParams(
      (prev) => {
        prev.delete('idmm');
        return prev;
      },
      { replace: true }
    );
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns: waterMeterColumns,
    data: waterMeters,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    enableEditing: true,
    getRowId: (row) => String(row.idmm),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleSave,
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h4">Unos vodomera</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>{internalEditComponents}</DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </>
    ),
    onEditingRowCancel: ({ table }) => handleEditClose(table),
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
      <Dialog open={true} onClose={() => handleEditClose(table)} maxWidth="lg" fullWidth>
        <DialogTitle variant="h4" marginBottom={2}>
          Izmena vodomera
        </DialogTitle>
        <DialogContent
          sx={{
            padding: '24px',
            overflow: 'scroll',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem',
            }}
          >
            {internalEditComponents}
          </Box>
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Dialog>
    ),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Istorija promena">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto', backgroundColor: 'lightsteelblue' }}
            size="small"
            variant="contained"
            onClick={() => {
              setChangeHistoryID(row.original.id);
            }}
          >
            <ChangeHistoryIcon />
          </Button>
        </Tooltip>
        <Tooltip title="Dodela korisniku">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="warning"
            onClick={() => {
              setAssignRowID(row.original.id);
            }}
          >
            <AllInclusive />
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
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Unos vodomera
      </Button>
    ),
    state: {
      isLoading,
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  useEffect(() => {
    const idmm = searchParams.get('idmm');
    if (waterMeters.length === 0 || !idmm) return;
    try {
      const tableRow = table.getRow('' + idmm);
      if (tableRow) {
        table.setEditingRow(tableRow as MRT_Row<WaterMeter>);
      }
    } catch (err) {
      console.warn('failed to get row from table by idmm: ', idmm, err);
    }
  }, [waterMeters, table, searchParams]);

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
      {assignRowID > 0 && <AssignWaterMeterToUserModal rowID={assignRowID} open={true} close={() => setAssignRowID(0)} />}
      {changeHistoryID > 0 && <ChangeHistoryModal rowID={changeHistoryID} open={true} close={() => setChangeHistoryID(0)} columns={historyColumns} />}
      {!!formModalIDMM && (
        <FormModal
          url={`${import.meta.env.VITE_API_URL || 'http://localhost:3010'}/api/water-meters/measuring-point`}
          dataBody={{ idmm: formModalIDMM }}
          title="Prikaz mernog mesta"
          columns={measuringPointsColumns}
          navigateURL={`/vodovod/merna-mesta?idmm=${formModalIDMM}`}
          navigatePageTitle="Merna mesta"
          readOnly
          handleClose={() => {
            setFormModalIDMM(null);
          }}
        />
      )}
    </Main>
  );
};

export default WaterMeterPage;
