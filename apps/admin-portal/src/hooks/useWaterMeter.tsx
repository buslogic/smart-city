import { SearchList } from '@/components/ui/SearchList';
import { HistoryRow, WaterMeter } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useWaterMeter = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [waterMeters, setWaterMeters] = useState<WaterMeter[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [idvName, setIdvName] = useState<string>('');

  type TUseWaterMeterColumnsProps = {
    linkSetter?: (value: string) => void;
  };

  const historyColumns = useMemo<MRT_ColumnDef<HistoryRow>[]>(
    () => [
      {
        accessorKey: 'old_value',
        header: 'Stara vrednost',
        size: 150,
      },
      {
        accessorKey: 'new_value',
        header: 'Promenjena vrednost',
        size: 150,
      },
      {
        accessorKey: 'translate',
        header: 'Tip promene',
        size: 150,
      },
      {
        accessorKey: 'change_date',
        header: 'Datum promene',
        size: 150,
      },
      {
        accessorKey: 'changed_by',
        header: 'Promenu izvršio/la',
        size: 150,
      },
    ],
    []
  );

  const useWaterMeterColumns = ({ linkSetter = () => { } }: TUseWaterMeterColumnsProps = {}) => {
    return useMemo<MRT_ColumnDef<WaterMeter>[]>(
      () => [
        {
          accessorKey: 'idv',
          header: 'ID vodomera',
          size: 150,
          enableEditing: true,
          muiEditTextFieldProps: ({ cell, row }) => {
            return {
              value: cell.getValue() as string,
              onChange: (e) => {
                setIdvName(row.original.idv);
                cell.row._valuesCache['idv'] = e.target.value;
              },
            }
          },
        },
        {
          accessorKey: 'measuring_point',
          header: 'Merno mesto',
          size: 250,
          enableEditing: true,
          Edit: ({ cell, column, row }) => {
            return (
              <SearchList
                label="Merno mesto"
                value={cell.getValue() as string}
                disabled={isChecked}
                endpoint={`${API_BASE}/api/water-meters/search/measuring-points`}
                multiple={false}
                onChange={(newValue) => {
                  row._valuesCache[column.id] = newValue;
                }}
              />
            );
          },
          Cell: ({ cell }) => {
            const value = cell.getValue() as string | undefined;
            let idmm = '';
            if (value) {
              idmm = value?.split(' | ')[0];
            }
            return (
              <Link to="#" onClick={() => linkSetter(idmm ?? '')}>
                {value ?? ''}
              </Link>
            );
          },
        },
        {
          accessorKey: 'counter',
          header: 'Brojač',
          size: 150,
          muiEditTextFieldProps: ({ cell }) => ({
            value: cell.getValue() as string,
            onChange: (e) => {
              cell.row._valuesCache['counter'] = e.target.value;
            },
          }),
        },
        {
          accessorKey: 'availability_id',
          header: 'Dostupnost',
          size: 200,
          enableEditing: true,
          Edit: ({ cell, table, column, row }) => {
            const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
            const value = isChecked ? '' : (cell.getValue() as string);

            return (
              <SearchList
                label="Dostupnost"
                value={value}
                disabled={!isCreating && !isEditing}
                endpoint={`${API_BASE}/api/water-meter-availability/search`}
                multiple={false}
                onChange={(newValue) => {
                  row._valuesCache[column.id] = newValue;
                }}
              />
            );
          },
          Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
        },
        {
          accessorKey: 'type_id',
          header: 'Tip',
          size: 350,
          enableEditing: true,
          Edit: ({ cell, table, column, row }) => {
            const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
            const value = isChecked ? '' : (cell.getValue() as string);

            return (
              <SearchList
                label="Tip"
                value={value}
                disabled={!isCreating && !isEditing}
                endpoint={`${API_BASE}/api/water-meter-types/search`}
                multiple={false}
                onChange={(newValue) => {
                  row._valuesCache[column.id] = newValue;
                }}
              />
            );
          },
          Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
        },
        {
          accessorKey: 'manufacturer_id',
          header: 'Proizvođač',
          size: 150,
          enableEditing: true,
          Edit: ({ cell, table, column, row }) => {
            const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
            const value = isChecked ? '' : (cell.getValue() as string);

            return (
              <SearchList
                label="Proizvođač"
                value={value}
                disabled={!isCreating && !isEditing}
                endpoint={`${API_BASE}/api/water-meter-manufacturers/search`}
                multiple={false}
                onChange={(newValue) => {
                  row._valuesCache[column.id] = newValue;
                }}
              />
            );
          },
          Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
        },
        {
          accessorKey: 'serial_number',
          header: 'Fabrički broj',
          size: 150,
          enableEditing: true,
          muiEditTextFieldProps: ({ cell }) => ({
            value: cell.getValue() as string,
            onChange: (e) => {
              cell.row._valuesCache['serial_number'] = e.target.value;
            },
          }),
        },
        {
          accessorKey: 'module',
          header: 'Modul',
          size: 150,
          enableEditing: true,
          muiEditTextFieldProps: ({ cell }) => ({
            value: cell.getValue() as string,
            onChange: (e) => {
              cell.row._valuesCache['module'] = e.target.value;
            },
          }),
        },
        {
          accessorKey: 'calibrated_from',
          header: 'Baždaren od',
          size: 150,
          enableEditing: true,
          Cell: ({ cell }) => {
            return cell.getValue() ? dayjs(cell.getValue() as string).format('DD.MM.YYYY') : '';
          },
          Edit: ({ row, cell, column }) => {
            const initialValue = isChecked ? null : cell.getValue();
            const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(
              initialValue ? dayjs(initialValue as string) : null
            );

            return (
              <DatePicker
                value={selectedDate}
                label={'Baždaren od'}
                sx={{ width: '100%' }}
                slotProps={{
                  textField: {
                    variant: 'standard',
                  },
                }}
                onChange={(newDate) => {
                  setSelectedDate(newDate);
                  row._valuesCache[column.id] = newDate?.format('YYYY-MM-DD') ?? null;
                }}
              />
            );
          },
        },
        {
          accessorKey: 'calibrated_to',
          header: 'Baždaren do',
          size: 150,
          enableEditing: true,
          Cell: ({ cell }) => {
            return cell.getValue() ? dayjs(cell.getValue() as string).format('DD.MM.YYYY') : '';
          },
          Edit: ({ row, cell, column }) => {
            const initialValue = isChecked ? null : cell.getValue();
            const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(
              initialValue ? dayjs(initialValue as string) : null
            );

            return (
              <DatePicker
                label="Baždaren do"
                value={selectedDate}
                sx={{ width: '100%' }}
                slotProps={{
                  textField: {
                    variant: 'standard',
                  },
                }}
                onChange={(newDate) => {
                  setSelectedDate(newDate);
                  row._valuesCache[column.id] = newDate?.format('YYYY-MM-DD') ?? null;
                }}
              />
            );
          },
        },
        {
          accessorKey: 'zamenski_vodomer',
          header: 'Zamenski vodomer',
          size: 100,
          enableEditing: true,
          Cell: () => <></>,
          Edit: ({ cell, row, column, table }) => {
            const value = Number(cell.getValue());
            const initial = value !== undefined && value > 0;
            const [checked, setChecked] = useState(initial);

            if (table.getState().creatingRow) {
              return <></>;
            }

            return (
              <FormControlLabel
                label="Zamenski vodomer"
                control={
                  <Checkbox
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;

                      if (isChecked) {
                        row._valuesCache['idv'] = '';
                        row._valuesCache['counter'] = '';
                        row._valuesCache['serial_number'] = '';
                        row._valuesCache['module'] = '';
                      } else {
                        row._valuesCache['idv'] = row.original.idv;
                        row._valuesCache['counter'] = row.original.counter;
                        row._valuesCache['serial_number'] = row.original.serial_number;
                        row._valuesCache['module'] = row.original.module;
                        row._valuesCache['availability_id'] = row.original.availability_id;
                        row._valuesCache['type_id'] = row.original.type_id;
                        row._valuesCache['manufacturer_id'] = row.original.manufacturer_id;
                        row._valuesCache['calibrated_from'] = row.original.calibrated_from;
                        row._valuesCache['calibrated_to'] = row.original.calibrated_to;
                      }

                      setChecked(isChecked);
                      row._valuesCache[column.id] = isChecked ? 1 : 0;
                      setIsChecked(isChecked);
                    }}
                  />
                }
              />
            );
          },
        },
      ],
      [waterMeters, linkSetter, isChecked]
    );
  };

  const createItem = useCallback(async (row: WaterMeter): Promise<void> => {
    setIsCreating(true);
    try {
      const res = await fetchAPI<WaterMeter[]>(`${API_BASE}/api/water-meters`, {
        method: 'POST',
        data: row,
      });

      if (!res || !Array.isArray(res)) {
        throw new Error('Neuspešan unos podataka');
      }

      // Backend vraća kompletnu ažuriranu listu vodomera sortiranu po ID DESC
      setWaterMeters(res);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateItem = useCallback(async (id: number, data: any) => {
    setIsUpdating(true);
    try {
      const res = await fetchAPI<WaterMeter[]>(`${API_BASE}/api/water-meters/${id}`, {
        method: 'PATCH',
        data: data,
      });

      if (!res || !Array.isArray(res)) {
        throw new Error('Neuspešno ažuriranje');
      }

      // Backend vraća kompletnu ažuriranu listu vodomera sortiranu po ID DESC
      setWaterMeters(res);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const insertReplacementWaterMeter = useCallback(async (row: WaterMeter) => {
    setIsUpdating(true);
    try {
      console.log(idvName);
      const res = await fetchAPI(`${API_BASE}/api/replacement-water-meters`, {
        method: 'POST',
        data: row,
      });

      if (!res || !res.id) {
        throw new Error('Neuspešan unos zamene');
      }

      setWaterMeters((state) => state.filter((x) => x.idv !== row.old_idv))
    } finally {
      setIsUpdating(false);
    }
  }, [idvName]);

  const deleteItem = useCallback(async (id: number) => {
    setIsDeleting(true);
    try {
      await fetchAPI(`${API_BASE}/api/water-meters/${id}`, {
        method: 'DELETE',
      });

      setWaterMeters((state) => state.filter((x) => x.id !== id));
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const fetchWaterMeterRows = useCallback(async () => {
    if (!isFetching) return;

    try {
      const data = await fetchAPI<WaterMeter[]>(`${API_BASE}/api/water-meters`, {
        method: 'GET',
      });

      if (data && Array.isArray(data)) {
        setIsLoading(false);
        setWaterMeters(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching]);

  return {
    waterMeters,
    isLoading,
    isFetching,
    setWaterMeters,
    deleteItem,
    createItem,
    updateItem,
    fetchWaterMeterRows,
    isCreating,
    isUpdating,
    isDeleting,
    historyColumns,
    useWaterMeterColumns,
    insertReplacementWaterMeter,
    isChecked,
    idvName
  };
};

export default useWaterMeter;