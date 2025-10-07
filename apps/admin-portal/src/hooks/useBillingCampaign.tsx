import Input from '@/components/ui/Input';
import { SearchList } from '@/components/ui/SearchList';
import { BillingCampaign } from '@/types/billing-campaign';
import { globalTableProps } from '@/utils/globalTableProps';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons, MRT_TableOptions, useMaterialReactTable } from 'material-react-table';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

const useBillingCampaign = () => {
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIDV, setSelectedIDV] = useState<string | null>(null);
  const [selectedIDMM, setSelectedIDMM] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [showTable, setShowTable] = useState(false);
  const [isAccountingClosed, setIsAccountingClosed] = useState(false);
  const [formModalIDV, setformModalIDV] = useState<string | null>(null);
  const [data, setData] = useState<BillingCampaign[]>([]);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const idPopisRef = useRef<HTMLInputElement>(null);
  const pocetnoStanjeRef = useRef<HTMLInputElement>(null);
  const zavrsnoStanjeRef = useRef<HTMLInputElement>(null);
  const izmerenoRef = useRef<HTMLInputElement>(null);
  const zPocetnoStanjeRef = useRef<HTMLInputElement>(null);
  const zZavrsnoStanjeRef = useRef<HTMLInputElement>(null);
  const zIzmerenoRef = useRef<HTMLInputElement>(null);
  const zVodomerRef = useRef<HTMLInputElement>(null);
  const procenatRef = useRef<HTMLInputElement>(null);
  const napomenaRef = useRef<HTMLInputElement>(null);
  const nacinUpisaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkOpenAccountingPeriod();
  }, [selectedMonth]);

  const columns = useMemo<MRT_ColumnDef<BillingCampaign>[]>(
    () => [
      {
        accessorKey: 'id_popis',
        header: 'ID popis',
        size: 100,
        enableEditing: false,
        Edit: ({ row, column }) => (
          <Input defaultValue={row.getValue(column.id)} label="ID popis" disabled={true} fullWidth variant="standard" autoFocus />
        ),
      },
      {
        accessorKey: 'idmm',
        header: 'ID mernog mesta',
        size: 100,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="ID mernog mesta"
              value={cell.getValue() as string}
              endpoint="../BillingCampaignController/getMeasuringPoints"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
              disabled={isAccountingClosed}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'idv',
        header: 'ID vodomera',
        size: 110,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="ID vodomera"
              value={cell.getValue() as string}
              endpoint="../BillingCampaignController/getWaterMeters"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
              disabled={isAccountingClosed}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'pocetno_stanje',
        header: 'Početno stanje',
        size: 110,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'zavrsno_stanje',
        header: 'Završno stanje',
        size: 110,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'izmereno',
        header: 'Izmereno',
        size: 100,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'z_pocetno_stanje',
        header: 'Z početno stanje',
        size: 120,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'z_zavrsno_stanje',
        header: 'Z završno stanje',
        size: 120,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'z_izmereno',
        header: 'Z izmereno',
        size: 100,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'z_vodomer',
        header: 'Z vodomer',
        size: 100,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'meter_reading',
        header: 'Stanje vod. nap.',
        size: 130,
        Edit: ({ cell, column, row }) => {
          return (
            <SearchList
              label="Stanje vod. nap."
              value={cell.getValue() as string}
              endpoint="../BillingCampaignController/getWaterMeterReadings"
              multiple={false}
              onChange={(newValue) => {
                row._valuesCache[column.id] = newValue;
              }}
              disabled={isAccountingClosed}
            />
          );
        },
        Cell: ({ cell }) => cell.getValue() as string,
      },
      {
        accessorKey: 'procenat',
        header: 'Procenat',
        size: 100,
        Cell: ({ cell }) => (cell.getValue() ? `${cell.getValue()}%` : ''),
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'napomena',
        header: 'Napomena',
        size: 150,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
      {
        accessorKey: 'nacin_upisa',
        header: 'Način upisa',
        size: 110,
        muiEditTextFieldProps: {
          disabled: isAccountingClosed,
        },
      },
    ],
    [isAccountingClosed]
  );

  const handleZatvoriObracunClick = () => {
    fetchReadingListsRows(selectedMonth);
    setShowTable(true);
  };

  const createNewCalculation = async () => {
    try {
      const period = selectedMonth.format('YYYY-MM');

      const currentDate = dayjs();
      const selectedDate = selectedMonth.startOf('month');

      if (selectedDate.isBefore(currentDate.startOf('month'))) {
        toast.error('Nije moguće otvoriti kampanju za prethodni period.');
        return;
      }

      const response = await $.ajax({
        url: '../BillingCampaignController/createNewCalculation',
        type: 'POST',
        data: { period: period },
        dataType: 'json',
      });

      if (response.success) {
        toast.success(response.message);
        setIsAccountingClosed(true);
        await fetchReadingListsRows();
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Došlo je do greške prilikom zatvaranja kampanje');
    }
  };

  const handleCloseAccountingPeriod = () => {
    if (window.confirm(`Da li ste sigurni da želite da zatvorite kampanju za period: ${selectedMonth.format('YYYY-MM')}?`)) {
      closeAccountingPeriod();
    }
  };

  const closeAccountingPeriod = async () => {
    try {
      const period = selectedMonth.format('YYYY-MM');

      const response = await $.ajax({
        url: '../BillingCampaignController/closeAccountingPeriod',
        type: 'POST',
        data: { period: period },
        dataType: 'json',
      });

      if (response.success) {
        toast.success(`Kampanja za period ${selectedMonth.format('YYYY-MM')} je uspešno zatvorena`);
        setIsAccountingClosed(true);
        await fetchReadingListsRows();
      } else {
        toast.error(`Došlo je do greške prilikom zatvaranja kampanje za period ${selectedMonth.format('YYYY-MM')}`);
      }
    } catch (error) {
      console.log(error);
      toast.error('Došlo je do greške prilikom zatvaranja kampanje');
    }
  };

  const renderDateSelector = () => {
    const currentDate = dayjs();
    const isPastMonth = selectedMonth.startOf('month').isBefore(currentDate.startOf('month'));

    return (
      <Paper sx={{ p: 2, mb: 3, maxWidth: '600px', mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 'flex',
            mx: 'auto',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Izaberite mesec za kampanju
          </Typography>

          <DatePicker
            views={['month', 'year']}
            label="Mesec i godina"
            value={selectedMonth}
            onChange={(newDate) => {
              if (newDate) {
                setSelectedMonth(newDate);
              }
            }}
            sx={{ width: '60%', mb: 2, mx: 'auto' }}
          />

          <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
            <Button variant="contained" color="primary" onClick={handleZatvoriObracunClick}>
              Prikaži podatke
            </Button>
            <Tooltip title={isPastMonth ? 'Nije moguće otvoriti kampanju za prethodni period' : ''}>
              <span>
                <Button
                  variant="contained"
                  color="success"
                  onClick={createNewCalculation}
                  startIcon={<AddIcon />}
                  disabled={isAccountingClosed || isPastMonth}
                >
                  Otvori kampanju
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              color="error"
              onClick={handleCloseAccountingPeriod}
              startIcon={<RemoveCircleOutlineIcon />}
              disabled={isAccountingClosed}
            >
              Zatvori kampanju
            </Button>
          </Stack>

          {isPastMonth && (
            <Typography variant="caption" color="error" sx={{ mt: 2 }}>
              Nije moguće otvoriti kampanju za prethodni period
            </Typography>
          )}
        </Box>
      </Paper>
    );
  };

  const fetchReadingListsRows = async (date = selectedMonth) => {
    try {
      setIsLoadingData(true);
      setIsFetching(true);

      const formattedDate = date.format('YYYY-MM');

      await $.ajax({
        url: '../BillingCampaignController/getData',
        type: 'POST',
        data: { period: formattedDate },
        dataType: 'json',
        success: (response) => {
          setIsLoadingData(false);
          setIsFetching(false);

          if (response && response.error === 'table_not_exists') {
            setData([]);
            setShowTable(false);
            setIsAccountingClosed(false);
            toast.error(`Ne postoji kampanja za period: ${date.format('YYYY-MM')}`);
          } else {
            setShowTable(true);
            setData(response || []);

            const isClosed = response.length > 0 && response[0].zatvoren == 1;
            setIsAccountingClosed(isClosed);

            if (isClosed) {
              toast.info(`Kampanja za period ${date.format('YYYY-MM')} je zatvorena.`);
            }
          }
        },
        error: () => {
          setIsLoadingData(false);
          setIsFetching(false);
          setData([]);
          setShowTable(false);
          setIsAccountingClosed(false);
          toast.error('Došlo je do greške prilikom učitavanja podataka');
        },
      });
    } catch (error) {
      setIsLoadingData(false);
      setIsFetching(false);
      setData([]);
      setShowTable(false);
      setIsAccountingClosed(false);
      console.log(error);
      toast.error('Došlo je do greške prilikom učitavanja podataka');
    }
  };

  const renderDataTable = () =>
    showTable && (
      <>
        <Box sx={{ my: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="primary" fontWeight="500">
            Prikazani podaci za period: {selectedMonth.format('YYYY-MM')}
            {isAccountingClosed && (
              <Tooltip title="Kampanja je zatvorena">
                <LockIcon sx={{ ml: 1, color: 'warning.main', verticalAlign: 'middle' }} />
              </Tooltip>
            )}
          </Typography>
          {data.length === 0 && (
            <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
              Nema podataka za prikazani period
            </Typography>
          )}
        </Box>
        <MaterialReactTable table={table} />
      </>
    );

  const handleSaveMM: MRT_TableOptions<BillingCampaign>['onEditingRowSave'] = async ({ values, table, row }) => {
    try {
      if (isAccountingClosed) {
        toast.error('Kampanja je zatvorena i nije moguće sačuvati izmene');
        table.setEditingRow(null);
        return;
      }
      const id = row.original.id;
      const stanje_vodomera = row.original.stanje_vodomera;
      const response = await $.ajax({
        url: '../BillingCampaignController/editRow',
        type: 'POST',
        data: {
          ...values,
          id,
          stanje_vodomera,
          period: selectedMonth.format('YYYY-MM'),
        },
        dataType: 'json',
      });

      if (response.success) {
        toast.success('Čitačka lista je uspešno izmenjena');
        await fetchReadingListsRows();
      } else {
        toast.error('Došlo je do greške prilikom izmene čitačke liste');
      }
    } catch (error) {
      console.log(error);
      toast.error('Došlo je do greške prilikom izmene čitačke liste');
    }

    table.setEditingRow(null);
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
    muiTableBodyCellProps: {
      align: 'center',
    },
    muiTableHeadCellProps: {
      align: 'center',
    },
    muiTableContainerProps: {
      sx: {
        minHeight: '500px',
        width: 'auto',
        maxWidth: '100%',
        overflowX: 'auto',
      },
    },
    muiEditTextFieldProps: {
      variant: 'standard',
    },
    onEditingRowSave: handleSaveMM,
    renderEditRowDialogContent: ({ table, row, internalEditComponents }) => (
      <Dialog open={true} onClose={() => table.setEditingRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Izmena čitačke liste</DialogTitle>
        {isAccountingClosed && (
          <Box sx={{ px: 3, mb: 2 }}>
            <Alert severity="warning" icon={<LockIcon />}>
              Kampanja je zatvorena. Polja su onemogućena za izmenu.
            </Alert>
          </Box>
        )}
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            padding: '24px',
            overflow: 'scroll',
          }}
        >
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
        <Tooltip title={isAccountingClosed ? 'Moguć samo pregled' : 'Izmeni'}>
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
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" color="success" onClick={() => setIsAddModalOpen(true)} startIcon={<AddIcon />} disabled={isAccountingClosed}>
        Dodaj
      </Button>
    ),
    state: {
      isLoading: isLoadingData,
      showProgressBars: isFetching,
    },
  });

  const handleCreate = async () => {
    try {
      const newFormData = {
        id_popis: idPopisRef.current?.value || null,
        idmm: selectedIDMM || null,
        idv: selectedIDV || null,
        pocetno_stanje: pocetnoStanjeRef.current?.value || null,
        zavrsno_stanje: zavrsnoStanjeRef.current?.value || null,
        izmereno: izmerenoRef.current?.value || null,
        z_pocetno_stanje: zPocetnoStanjeRef.current?.value || null,
        z_zavrsno_stanje: zZavrsnoStanjeRef.current?.value || null,
        z_izmereno: zIzmerenoRef.current?.value || null,
        z_vodomer: zVodomerRef.current?.value || null,
        stanje_vodomera: selectedState || null,
        procenat: procenatRef.current?.value || null,
        napomena: napomenaRef.current?.value || null,
        nacin_upisa: nacinUpisaRef.current?.value || null,
        period: selectedMonth.format('YYYY-MM'),
      };

      const response = await $.ajax({
        url: '../BillingCampaignController/addNewRow',
        type: 'POST',
        data: {
          id_popis: newFormData.id_popis,
          idmm: newFormData.idmm,
          idv: newFormData.idv,
          pocetno_stanje: newFormData.pocetno_stanje,
          zavrsno_stanje: newFormData.zavrsno_stanje,
          izmereno: newFormData.izmereno,
          z_pocetno_stanje: newFormData.z_pocetno_stanje,
          z_zavrsno_stanje: newFormData.z_zavrsno_stanje,
          z_izmereno: newFormData.z_izmereno,
          z_vodomer: newFormData.z_vodomer,
          stanje_vodomera: newFormData.stanje_vodomera,
          procenat: newFormData.procenat,
          napomena: newFormData.napomena,
          nacin_upisa: newFormData.nacin_upisa,
          period: newFormData.period,
        },
        dataType: 'json',
      });

      if (response === true) {
        await fetchReadingListsRows();
        toast.success('Čitačka lista je uspešno dodata');
        setIsAddModalOpen(false);

        setSelectedIDV(null);
        setSelectedIDMM(null);
      } else {
        toast.error('Došlo je do greške prilikom dodavanja čitačke liste');
      }
    } catch (error) {
      console.log(error);
      toast.error('Došlo je do greške prilikom dodavanja čitačke liste');
    }
  };

  const renderAddModal = () => (
    <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>Dodaj</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <SearchList
              endpoint="../BillingCampaignController/getMeasuringPoints"
              label="ID mernog mesta"
              multiple={false}
              onChange={(newValue) => {
                setSelectedIDMM(newValue);
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <SearchList
              endpoint="../BillingCampaignController/getWaterMeters"
              label="ID vodomera"
              multiple={false}
              onChange={(newValue) => {
                setSelectedIDV(newValue);
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input
              inputRef={pocetnoStanjeRef}
              autoComplete="off"
              name="pocetno_stanje"
              label="Početno stanje"
              fullWidth
              variant="standard"
              type="number"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input
              inputRef={zavrsnoStanjeRef}
              autoComplete="off"
              name="zavrsno_stanje"
              label="Završno stanje"
              fullWidth
              variant="standard"
              type="number"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input inputRef={izmerenoRef} autoComplete="off" name="izmereno" label="Izmereno" fullWidth variant="standard" type="number" />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input
              inputRef={zPocetnoStanjeRef}
              autoComplete="off"
              name="z_pocetno_stanje"
              label="Z početno stanje"
              fullWidth
              variant="standard"
              type="number"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input
              inputRef={zZavrsnoStanjeRef}
              autoComplete="off"
              name="z_zavrsno_stanje"
              label="Z završno stanje"
              fullWidth
              variant="standard"
              type="number"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input inputRef={zIzmerenoRef} autoComplete="off" name="z_izmereno" label="Z izmereno" fullWidth variant="standard" type="number" />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input inputRef={zVodomerRef} autoComplete="off" name="z_vodomer" label="Z vodomer" fullWidth variant="standard" type="number" />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <SearchList
              endpoint="../BillingCampaignController/getWaterMeterReadings"
              label="Stanje vod. nap."
              multiple={false}
              onChange={(newValue) => {
                setSelectedState(newValue);
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input inputRef={procenatRef} autoComplete="off" name="procenat" label="Procenat" fullWidth variant="standard" />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Input inputRef={nacinUpisaRef} autoComplete="off" name="nacin_upisa" label="Način upisa" fullWidth variant="standard" />
          </Grid>

          <Grid item xs={12}>
            <Input inputRef={napomenaRef} autoComplete="off" name="napomena" label="Napomena" fullWidth variant="standard" multiline rows={2} />
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

  const checkOpenAccountingPeriod = async () => {
    const formattedDate = selectedMonth.format('YYYY-MM');
    const response = await $.ajax({
      url: '../BillingCampaignController/checkOpenAccountingPeriod',
      type: 'POST',
      data: { period: formattedDate },
      dataType: 'json',
    });
    if (response.success === false) {
      toast.error(response.message);
      setTimeout(() => {
        setWarningMessage(null);
      }, 5000);
    }
  };

  return {
    fetchReadingListsRows,
    isLoadingData,
    isFetching,
    renderDataTable,
    columns,
    table,
    renderAddModal,
    renderDateSelector,
    formModalIDV,
    setformModalIDV,
    warningMessage,
  };
};

export default useBillingCampaign;
