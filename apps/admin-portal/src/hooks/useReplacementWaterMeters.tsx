import { SearchList } from '@/components/ui/SearchList';
import { WaterMeter } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

const useReplacementWaterMeters = () => {
    const [replacementWaterMeters, setReplacementWaterMeters] = useState<WaterMeter[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<WaterMeter>[]>(() => {
        return [
            {
                accessorKey: 'idv',
                header: 'ID vodomera',
                size: 150,
                enableEditing: true,
            },
            {
                accessorKey: 'measuringPoint',
                header: 'Merno mesto',
                size: 250,
                enableEditing: true,
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
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'counter',
                header: 'Brojač',
                size: 150,
            },
            {
                accessorKey: 'availabilityId',
                header: 'Dostupnost',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Dostupnost"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../WaterMeterAvailabilityController/getAvailabilityForSL'}
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
                accessorKey: 'typeId',
                header: 'Tip',
                size: 350,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Tip"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../WaterMeterTypesController/getTypesForSL'}
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
                accessorKey: 'manufacturerId',
                header: 'Proizvođač',
                size: 150,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Proizvođač"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../WaterMeterManufacturersController/getManufacturersForSL'}
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
                accessorKey: 'serialNumber',
                header: 'Fabrički broj',
                size: 150,
                enableEditing: true,
            },
            {
                accessorKey: 'module',
                header: 'Modul',
                size: 150,
                enableEditing: true,
            },
            {
                accessorKey: 'calibratedFrom',
                header: 'Baždaren od',
                size: 150,
                enableEditing: true,
                Cell: ({ cell }) => {
                    return cell.getValue() ? dayjs(cell.getValue() as string).format('DD.MM.YYYY') : '';
                },
                Edit: ({ row, cell }) => {
                    const initialDate = dayjs(cell.getValue() as string);
                    return (
                        <DatePicker
                            value={initialDate}
                            label={'Baždaren od'}
                            sx={{ width: '100%' }}
                            slotProps={{
                                textField: {
                                    variant: 'standard',
                                },
                            }}
                            onChange={(newDate) => {
                                row._valuesCache['calibratedFrom'] = newDate?.format('YYYY-MM-DD');
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'calibratedTo',
                header: 'Baždaren do',
                size: 150,
                enableEditing: true,
                Cell: ({ cell }) => {
                    return cell.getValue() ? dayjs(cell.getValue() as string).format('DD.MM.YYYY') : '';
                },
                Edit: ({ row, cell }) => {
                    const initialDate = dayjs(cell.getValue() as string);
                    return (
                        <DatePicker
                            label="Baždaren do"
                            value={initialDate}
                            sx={{ width: '100%' }}
                            slotProps={{
                                textField: {
                                    variant: 'standard',
                                },
                            }}
                            onChange={(newDate) => {
                                row._valuesCache['calibratedTo'] = newDate?.format('YYYY-MM-DD');
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'oldIdv',
                header: 'Zamenjen vodomer',
                size: 150,
                enableEditing: false,
            },
        ];
    }, [replacementWaterMeters]);

    const fetchData = useCallback(async () => {
        try {
            setIsFetching(true);
            const data = await fetchAPI<WaterMeter[]>(`${API_BASE}/api/replacement-water-meters`, {
                method: 'GET',
            });
            setReplacementWaterMeters(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsFetching(false);
        }
    }, []);

    const updateRow = useCallback(async (row: WaterMeter) => {
        setIsUpdating(true);
        try {
            const res = await fetchAPI<WaterMeter>(`${API_BASE}/api/replacement-water-meters/${row.id}`, {
                method: 'PATCH',
                data: row,
            });
            setReplacementWaterMeters((prev) => prev.map((x) => (x.id === row.id ? res : x)));
        } catch (err: any) {
            console.error(err);
            throw new Error(err.message || 'Greška prilikom izmene');
        } finally {
            setIsUpdating(false);
        }
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        try {
            await fetchAPI(`${API_BASE}/api/replacement-water-meters/${id}`, {
                method: 'DELETE',
            });
            setReplacementWaterMeters((state) => state.filter((x) => x.id !== id));
        } finally {
            setIsDeleting(false);
        }
    }, []);

    return {
        columns,
        replacementWaterMeters,
        isFetching,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        deleteRow,
    };
};

export default useReplacementWaterMeters;
