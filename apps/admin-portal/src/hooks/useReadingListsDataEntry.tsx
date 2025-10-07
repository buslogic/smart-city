import Input from '@/components/ui/Input';
import { SearchList } from '@/components/ui/SearchList';
import { ReadingListsDataEntryShow } from '@/types/finance';
import { fetchPostData } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Paper, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const useReadingListsDataEntry = () => {
  const [isFetching, setIsFetching] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedAdress, setSelectedAdress] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<ReadingListsDataEntryShow[]>([]);
  const [selectedReadings, setSelectedReadings] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isClosed, setIsClosed] = useState<boolean>(false);

  const [openModal, setOpenModal] = useState<null | number>(null);

  const handleOpenModal = (modalIndex: number) => setOpenModal(modalIndex);
  const handleCloseModal = () => setOpenModal(null);

  const columns = useMemo<MRT_ColumnDef<ReadingListsDataEntryShow>[]>(
    () => [
      {
        accessorKey: 'idmm',
        header: 'ID mernog mesta',
        size: 100,
      },
      {
        accessorKey: 'broj_ulaz_stan',
        header: 'Broj - ulaz - stan',
        size: 120,
      },
      {
        accessorKey: 'KS',
        header: 'Kućni savet',
        size: 100,
      },
      {
        accessorKey: 'broj_clanova_ks',
        header: 'Broj članova kućnog saveta',
        size: 280,
      },
      {
        accessorKey: 'broj_potrosaca_ks',
        header: 'Broj potrošača kućnog saveta',
        size: 280,
      },
      {
        accessorKey: 'sifra_potrosaca',
        header: 'Šifra potrošača',
        size: 130,
      },
      {
        accessorKey: 'potrosac',
        header: 'Potrošač',
        size: 150,
      },
      {
        accessorKey: 'primarno_mm',
        header: 'Primarno MM',
        size: 120,
      },
      {
        accessorKey: 'idmm_idv',
        header: 'ID MM IDV',
        size: 120,
      },
      {
        accessorKey: 'pocetno_stanje',
        header: 'Početno stanje',
        size: 110,
      },
      {
        accessorKey: 'zavrsno_stanje',
        header: 'Završno stanje',
        size: 110,
        Cell: ({ cell, row }) => {
          const [value, setValue] = useState<number | ''>(cell.getValue<number>() ?? '');
          const handleBlur = async () => {
            await saveZavrsnoStanje(row.original, value);
          };

          useEffect(() => {
            setValue(cell.getValue<number>() ?? '');
          }, [cell.getValue()]);

          return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isClosed ? (
                <Typography>{value}</Typography>
              ) : (
                <Input
                  type="number"
                  variant="standard"
                  value={value}
                  onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={handleBlur}
                  inputProps={{ style: { textAlign: 'center' } }}
                  sx={{ width: '100px' }}
                />
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: 'napomena',
        header: 'Napomena',
        size: 150,
        Cell: ({ row, cell }) => {
          const [napomenaValue, setNapomenaValue] = useState<string>(cell.getValue<string>() ?? '');
          const [key, setKey] = useState(0);

          const handleNapomenaChange = (newValue: string) => {
            setNapomenaValue('');
            if (newValue) {
              setNapomenaValue(newValue);
              saveNapomena(row.original, newValue);
            } else {
              saveNapomena(row.original, '');
            }
            setKey((prev) => prev + 1);
          };

          useEffect(() => {
            setNapomenaValue(cell.getValue<string>() ?? '');
            setKey((prev) => prev + 1);
          }, [cell.getValue()]);

          return (
            <Box>
              {isClosed ? (
                <Typography>{napomenaValue}</Typography>
              ) : (
                <SearchList
                  key={key}
                  label="Napomena"
                  value={napomenaValue}
                  endpoint={`../ReadingListsDataEntryController/getNotes`}
                  multiple={false}
                  onChange={handleNapomenaChange}
                />
              )}
            </Box>
          );
        },
      },
    ],
    [isClosed, selectedMonth]
  );

  const saveZavrsnoStanje = async (rowData: ReadingListsDataEntryShow, value: number | '') => {
    try {
      await fetchPostData('../ReadingListsDataEntryController/saveZavrsnoStanje', {
        idmm: rowData.idmm,
        zavrsno_stanje: value,
        datum: selectedMonth.format('YYYY-MM'),
        idv: rowData.idv,
      });
    } catch (error) {
      console.error('Greška prilikom čuvanja završnog stanja:', error);
    }
  };

  const saveNapomena = async (rowData: ReadingListsDataEntryShow, value: string) => {
    try {
      await fetchPostData('../ReadingListsDataEntryController/saveNapomena', {
        idmm: rowData.idmm,
        napomena: value,
        datum: selectedMonth.format('YYYY-MM'),
        idv: rowData.idv,
      });
    } catch (error) {
      console.error('Greška prilikom čuvanja završnog stanja:', error);
    }
  };

  const checkIfClosed = async () => {
    try {
      const response = await fetchPostData('../ReadingListsDataEntryController/checkIfClosed', {
        datum: selectedMonth.format('YYYY-MM'),
      });
      setIsClosed(response);
      if (response == true) {
        toast.error('Obračun za izabrani mesec je zatvoren. Nema mogućnosti unosa podataka.');
      }
    } catch (error) {
      console.error('Greška prilikom provere zatvorenog obračuna:', error);
    }
  };

  const renderDateSelector = () => {
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
            Izaberite mesec za obračun
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
        </Box>
      </Paper>
    );
  };

  const renderModals = () => {
    const dialogPaperStyle = {
      maxWidth: 700,
      width: '90%',
      borderRadius: '12px',
      padding: '24px',
    };

    return (
      <>
        <Dialog open={openModal === 1} onClose={handleCloseModal} fullWidth maxWidth="md" PaperProps={{ style: dialogPaperStyle }}>
          <DialogTitle style={{ fontWeight: 700, fontSize: '1.5rem' }}>Unos po ulici</DialogTitle>
          <DialogContent dividers>
            <Grid item xs={6}>
              <SearchList
                endpoint="../ReadingListsDataEntryController/getAdress"
                label="Ulica"
                multiple={false}
                onChange={(newValue) => {
                  setSelectedAdress(newValue);
                }}
              />
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal} color="primary">
              ODUSTANI
            </Button>
            <Button
              onClick={async () => {
                if (selectedAdress) {
                  await checkIfClosed();
                  try {
                    const result = await fetchPostData('../ReadingListsDataEntryController/showAdresses', {
                      adresa: selectedAdress,
                      datum: selectedMonth.format('YYYY-MM'),
                    });
                    setSelectedData(result);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsLoadingData(false);
                    setIsFetching(false);
                  }
                }
                handleCloseModal();
              }}
              color="primary"
              variant="contained"
              style={{ fontWeight: '600' }}
            >
              POTVRDI
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 2} onClose={handleCloseModal} fullWidth maxWidth="md" PaperProps={{ style: dialogPaperStyle }}>
          <DialogTitle style={{ fontWeight: 700, fontSize: '1.5rem' }}>Unos po rejonu</DialogTitle>
          <DialogContent dividers>
            <Grid item xs={6}>
              <SearchList
                endpoint="../ReadingListsDataEntryController/getRegion"
                label="Rejon"
                multiple={false}
                onChange={(newValue) => {
                  setSelectedRegions(newValue);
                }}
              />
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal} color="primary">
              ODUSTANI
            </Button>
            <Button
              onClick={async () => {
                if (selectedRegions) {
                  await checkIfClosed();
                  try {
                    const result = await fetchPostData('../ReadingListsDataEntryController/showRegions', {
                      region: selectedRegions,
                      datum: selectedMonth.format('YYYY-MM'),
                    });
                    setSelectedData(result);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsLoadingData(false);
                    setIsFetching(false);
                  }
                }
                handleCloseModal();
              }}
              color="primary"
              variant="contained"
              style={{ fontWeight: '600' }}
            >
              POTVRDI
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 3} onClose={handleCloseModal} fullWidth maxWidth="md" PaperProps={{ style: dialogPaperStyle }}>
          <DialogTitle style={{ fontWeight: 700, fontSize: '1.5rem' }}>Unos po čitaču</DialogTitle>
          <DialogContent dividers>
            <Grid item xs={6}>
              <SearchList
                endpoint="../ReadingListsDataEntryController/getReadings"
                label="Čitač"
                multiple={false}
                onChange={(newValue) => {
                  setSelectedReadings(newValue);
                }}
              />
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal} color="primary">
              ODUSTANI
            </Button>
            <Button
              onClick={async () => {
                if (selectedReadings) {
                  await checkIfClosed();
                  try {
                    const result = await fetchPostData('../ReadingListsDataEntryController/showReadings', {
                      reading: selectedReadings,
                      datum: selectedMonth.format('YYYY-MM'),
                    });
                    setSelectedData(result);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsLoadingData(false);
                    setIsFetching(false);
                  }
                }
                handleCloseModal();
              }}
              color="primary"
              variant="contained"
              style={{ fontWeight: '600' }}
            >
              POTVRDI
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  };

  const renderActionButtons = () => (
    <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
      <Button
        variant="contained"
        onClick={() => handleOpenModal(1)}
        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
      >
        Unos po ulici
      </Button>
      <Button
        variant="contained"
        onClick={() => handleOpenModal(2)}
        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
      >
        Unos po rejonu
      </Button>
      <Button
        variant="contained"
        onClick={() => handleOpenModal(3)}
        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
      >
        Unos po čitaču
      </Button>
      <Button
        onClick={async () => {
          await checkIfClosed();
          try {
            const result = await fetchPostData('../ReadingListsDataEntryController/showMeasuringPoints', {
              datum: selectedMonth.format('YYYY-MM'),
            });
            setSelectedData(result);
          } catch (err) {
            console.error(err);
          } finally {
            setIsLoadingData(false);
            setIsFetching(false);
          }
          handleCloseModal();
        }}
        variant="contained"
        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
      >
        Unos svih mernih mesta
      </Button>
    </Box>
  );

  const table = useMaterialReactTable<ReadingListsDataEntryShow>({
    ...globalTableProps,
    columns,
    data: selectedData,
    editDisplayMode: 'modal',
    enableEditing: false,
    initialState: {
      density: 'compact',
    },
    getRowId: (row) => String(row.id),
    muiToolbarAlertBannerProps: undefined,
    state: {
      isLoading: isLoadingData,
      showProgressBars: isFetching,
    },
  });

  return {
    columns,
    isFetching,
    renderDateSelector,
    renderModals,
    renderActionButtons,
    selectedData,
    table,
    checkIfClosed,
  };
};

export default useReadingListsDataEntry;
