import Input from '@/components/ui/Input';
import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { HouseCouncil } from '@/types/house-council';
import { globalTableProps } from '@/utils/globalTableProps';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Tooltip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import {
  MRT_EditActionButtons,
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_TableOptions,
} from 'material-react-table';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

export const HouseCouncilPage = ({ title }: { title: string }) => {
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIDMM, setSelectedIDMM] = useState<string | null>(null);
  const [selectedAdress, setSelectedAdress] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [data, setData] = useState<HouseCouncil[]>([]);

  const datumUgradnjeRef = useRef<HTMLInputElement>(null);
  const brojClanovaKSRef = useRef<HTMLInputElement>(null);
  const brojPotrosacaKSRef = useRef<HTMLInputElement>(null);
  const iduRef = useRef<HTMLInputElement>(null);
  const brojRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(null);

  const fetchHouseCouncilRows = async () => {
    try {
      await $.ajax({
        url: '../HouseCouncilController/getData',
        type: 'POST',
        dataType: 'json',
        success: (rows) => {
          setIsLoadingData(false);
          setIsFetching(false);
          setData(rows);
        },
      });
    } catch (err) {
      console.error(err);
      setIsLoadingData(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchHouseCouncilRows();
  }, []);

  const columns = useMemo<MRT_ColumnDef<HouseCouncil>[]>(
    () => [
      {
        accessorKey: 'idmm',
        header: 'IDMM',
        size: 100,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          return (
            <SearchList
              label="ID mernog mesta"
              value={cell.getValue() as string}
              endpoint="../HouseCouncilController/getMeasuringPoints"
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'datum_ugradnje',
        header: 'Datum ugradnje',
        size: 150,
        enableEditing: true,
        Edit: ({ row, cell }) => {
          const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
          return (
            <DatePicker
              value={initialValue}
              label={'Datum ugradnje'}
              sx={{ width: '100%' }}
              slotProps={{
                textField: {
                  variant: 'standard',
                },
              }}
              onChange={(newDate) => {
                row._valuesCache['datum_ugradnje'] = newDate?.format('YYYY-MM-DD');
              }}
            />
          );
        },
        Cell: ({ cell }) => {
          const date = cell.getValue();
          return date ? dayjs(date as string).format('DD.MM.YYYY') : '';
        },
      },
      {
        accessorKey: 'adresa',
        header: 'Ulica',
        size: 150,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Ulica"
              value={cell.getValue() as string}
              endpoint="../HouseCouncilController/getAdress"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'broj_clanova_KS',
        header: 'Broj Članova KS',
        size: 100,
      },
      {
        accessorKey: 'broj_potrosaca_KS',
        header: 'Broj Potrošača KS',
        size: 100,
      },
      {
        accessorKey: 'prim_MM',
        header: 'Primarno merno mesto',
        size: 300,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const isCreating = table.getState().creatingRow;
          const isEditing = table.getState().editingRow;
          const excludeId = row._valuesCache['idmm'] as string;
          return (
            <SearchList
              label="Primarno merno mesto"
              value={cell.getValue() as string}
              endpoint={`../MeasuringPointsController/getPrimaryMeasuringPoints?excludeId=${excludeId}`}
              disabled={!isCreating && !isEditing}
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'naselje',
        header: 'Naselje',
        size: 150,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Naselje"
              value={cell.getValue() as string}
              endpoint="../HouseCouncilController/getCity"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'broj',
        header: 'Kućni broj',
        size: 100,
      },
    ],
    []
  );

  const handleCreate = async () => {
    try {
      const datumUgradnjeDayjs = dayjs(datumUgradnjeRef.current?.value);

      const datumUgradnjeFormatted = datumUgradnjeDayjs.isValid() ? datumUgradnjeDayjs.format('YYYY-MM-DD') : '';

      const newFormData = {
        IDMM: selectedIDMM || '',
        adresa: selectedAdress || '',
        naselje: selectedCity || '',
        datum_ugradnje: datumUgradnjeFormatted,
        broj_clanova_KS: brojClanovaKSRef.current?.value || '',
        broj_potrosaca_KS: brojPotrosacaKSRef.current?.value || '',
        prim_MM: selectedPrimary || '',
        idu: iduRef.current?.value || '',
        broj: brojRef.current?.value || '',
        KS: selectedIDMM || '',
      };

      const response = await $.ajax({
        url: '../HouseCouncilController/addNewRow',
        type: 'POST',
        data: {
          idmm: newFormData.IDMM,
          adresa: newFormData.adresa,
          naselje: newFormData.naselje,
          datum_ugradnje: newFormData.datum_ugradnje,
          broj_clanova_KS: newFormData.broj_clanova_KS,
          broj_potrosaca_KS: newFormData.broj_potrosaca_KS,
          prim_MM: newFormData.prim_MM,
          idu: newFormData.idu,
          broj: newFormData.broj,
          kucni_savet: newFormData.KS,
        },
        dataType: 'json',
      });

      if (response === true) {
        await fetchHouseCouncilRows();
        toast.success('Kućni savet je uspešno dodat');
        setIsAddModalOpen(false);

        setSelectedIDMM(null);
        setSelectedAdress(null);
        setSelectedCity(null);
        setSelectedPrimary(null);
      } else {
        toast.error('Došlo je do greške prilikom dodavanja kućnog saveta');
      }
    } catch (error) {
      console.error('Error creating measuring point:', error);
      toast.error('Došlo je do greške prilikom dodavanja kućnog saveta');
    }
  };

  const renderAddModal = () => (
    <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Dodaj kućni savet</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <SearchList
              endpoint="../HouseCouncilController/getMeasuringPoints"
              label="ID mernog mesta"
              multiple={false}
              onChange={(newValue) => {
                setSelectedIDMM(newValue);
              }}
            />
          </Grid>

          <Grid item xs={6}>
            <SearchList
              endpoint="../HouseCouncilController/getAdress"
              label="Ulica"
              multiple={false}
              onChange={(newValue) => {
                setSelectedAdress(newValue);
              }}
            />
          </Grid>

          <Grid item xs={6}>
            <SearchList
              endpoint="../HouseCouncilController/getCity"
              label="Naselje"
              multiple={false}
              onChange={(newValue) => {
                setSelectedCity(newValue);
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <DatePicker
              value={date}
              onChange={(newDate) => {
                // @ts-expect-error asfasf
                setDate(newDate);
              }}
              // @ts-expect-error asfasf
              renderInput={(params) => <Input {...params} fullWidth variant="standard" label="Datum ugradnje" />}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Input inputRef={brojClanovaKSRef} autoComplete="off" name="broj_clanova_KS" label="Broj članova KS" fullWidth variant="standard" />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Input inputRef={brojPotrosacaKSRef} autoComplete="off" name="broj_potrosaca_KS" label="Broj potrošača KS" fullWidth variant="standard" />
          </Grid>

          <Grid item xs={6}>
            <SearchList
              endpoint="../MeasuringPointsController/getPrimaryMeasuringPoints?excludeId=${selectedIDMM}"
              label="Primarno merno mesto"
              multiple={false}
              onChange={(newValue) => {
                setSelectedPrimary(newValue);
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Input inputRef={brojRef} autoComplete="off" name="broj" label="Kućni broj" fullWidth variant="standard" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() => {
            setIsAddModalOpen(false);
          }}
        >
          Odustani
        </Button>
        <Button variant="contained" onClick={handleCreate}>
          Sačuvaj
        </Button>
      </DialogActions>
    </Dialog>
  );

  // UPDATE action
  const handleSaveMM: MRT_TableOptions<HouseCouncil>['onEditingRowSave'] = async ({ values, table, row }) => {
    try {
      console.log(values);
      const id = row.original.id;
      const response = await $.ajax({
        url: '../HouseCouncilController/editRow',
        type: 'POST',
        data: {
          ...values,
          id,
        },
        dataType: 'json',
      });

      if (response.success) {
        toast.success('Kućni savet je uspešno izmenjen');
        await fetchHouseCouncilRows();
      } else {
        toast.error('Došlo je do greške prilikom izmene kućnog saveta');
      }
    } catch (error) {
      console.error('Error updating measuring point:', error);
      toast.error('Došlo je do greške prilikom izmene kućnog saveta');
    }

    table.setEditingRow(null);
  };

  const handleDelete = async (idmm: number) => {
    $.ajax({
      url: '../HouseCouncilController/removeRow',
      type: 'POST',
      data: {
        idmm: idmm,
      },
      dataType: 'json',
      success: function (response) {
        if (response.success) {
          fetchHouseCouncilRows();
          toast.success('Kućni savet je uspešno obrisan');
        } else {
          toast.error('Greška prilikom deaktivacije kućnog saveta');
        }
      },
      error: function (errorThrown) {
        console.error('Error during soft delete:', errorThrown);
        toast.error('Greška prilikom deaktivacije kućnog saveta');
      },
    });
  };

  const openDeleteConfirmModal = (row: MRT_Row<HouseCouncil>) => {
    if (window.confirm('Da li ste sigurni da želite da obrišete ovaj kućni savet?')) {
      handleDelete(row.original.id);
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data,
    editDisplayMode: 'modal',
    enableEditing: true,
    initialState: {
      density: 'compact',
    },
    getRowId: (row) => String(row.id),
    muiToolbarAlertBannerProps: undefined,
    onEditingRowSave: handleSaveMM,
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
      <Dialog open={true} onClose={() => table.setEditingRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle variant="h4">Izmena kućnog saveta</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '24px', overflow: 'scroll' }}>
          <Grid container spacing={3}>
            {React.Children.map(internalEditComponents, (child, index) => (
              <Grid item xs={6} key={index}>
                {child}
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons variant="text" table={table} row={row} />
        </DialogActions>
      </Dialog>
    ),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Izmeni">
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
        <Tooltip title="Obriši">
          <Button
            sx={{ padding: '4px 6px', minWidth: 'auto', width: 'auto' }}
            size="small"
            variant="contained"
            color="error"
            onClick={() => openDeleteConfirmModal(row)}
          >
            <DeleteIcon />
          </Button>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" onClick={() => setIsAddModalOpen(true)}>
        Dodaj kućni savet
      </Button>
    ),
    state: {
      isLoading: isLoadingData,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <MaterialReactTable table={table} />
      {renderAddModal()}
    </Main>
  );
};

export default HouseCouncilPage;
