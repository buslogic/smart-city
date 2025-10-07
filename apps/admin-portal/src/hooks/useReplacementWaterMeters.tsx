import { SearchList } from '@/components/ui/SearchList';
import { WaterMeter } from '@/types/water-meter';
import { fetchPostData } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const CONTROLLER = '../ReplacementWaterMetersController';

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
                accessorKey: 'measuring_point',
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
                accessorKey: 'availability_id',
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
                accessorKey: 'type_id',
                header: 'Tip',
                size: 150,
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
                accessorKey: 'manufacturer_id',
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
                accessorKey: 'serial_number',
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
                accessorKey: 'calibrated_from',
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
                                row._valuesCache['calibrated_from'] = newDate?.format('YYYY-MM-DD');
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
                                row._valuesCache['calibrated_to'] = newDate?.format('YYYY-MM-DD');
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'old_idv',
                header: 'Zamenjen vodomer',
                size: 150,
                enableEditing: false,
            },
        ];
    }, [replacementWaterMeters]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchPostData(CONTROLLER + '/getRows');
        setIsFetching(false);
        setReplacementWaterMeters(data);
    }, []);

    const updateRow = useCallback(async (row: WaterMeter) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        console.log("RESSS: ", res);
        setIsUpdating(false);
        if (!res.success) {
            console.log("uslo");
            throw new Error(res.error);
        }
        console.log(res);
        setReplacementWaterMeters((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setReplacementWaterMeters((state) => state.filter((x) => x.id !== id));
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
