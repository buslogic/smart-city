import { SearchList } from '@/components/ui/SearchList';
import { Readings } from '@/types/billing-campaign';
import { fetchPostData } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const CONTROLLER = '../ReadingsController';

const useReadings = () => {
    const [readings, setReadings] = useState<Readings[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [changeCount, setChangeCount] = useState(0);

    const columns = useMemo<MRT_ColumnDef<Readings>[]>(() => {
        return [
            {
                accessorKey: 'pod_kampanja_id',
                header: 'Pod kampanja',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Pod kampanja"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={'../ReadingListsController/getSubCampaignForSL'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                                setChangeCount(prev => prev + 1);
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'idmm',
                header: 'Merno mesto',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;
                    const campaingId = row._valuesCache['pod_kampanja_id'].split(' | ')[0];

                    return (
                        <SearchList
                            label="Merno mesto"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={`../ReadingsController/getMeasuringPoints?campaignId=${campaingId}`}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                                setChangeCount(prev => prev + 1);

                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'idv',
                header: 'Vodomer',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;
                    const idmm = row._valuesCache['idmm'].split(' | ')[0];
                    const campaingId = row._valuesCache['pod_kampanja_id'].split(' | ')[0];

                    const addedWaterMeters = readings.filter(x => String(x.idmm).startsWith(idmm) && String(x.pod_kampanja_id).startsWith(campaingId)).map(x => String(x.idv));

                    return (
                        <SearchList
                            label="Vodomer"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={`../ReadingsController/getWaterMeter?idmm=${idmm}`}
                            multiple={false}
                            filterValues={addedWaterMeters}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'stavka_za_citanje_id',
                header: 'Stavka za čitanje',
                size: 200,
                // EXPLAIN WHAT THIS IS ???
            },
            {
                accessorKey: 'datum',
                header: 'Datum',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00' ? dayjs(rawValue) : null;

                    return (
                        <DatePicker
                            value={initialValue}
                            label={'Datum'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            onChange={(newDate) => {
                                row._valuesCache['datum'] = newDate ? newDate.format('YYYY-MM-DD') : '';
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => {
                    const date = cell.getValue();
                    if (!date || date === '0000-00-00') return '';
                    return dayjs(date as string).format('DD.MM.YYYY');
                },
            },
            {
                accessorKey: 'pocetno_stanje',
                header: 'Početno stanje',
                size: 200,
                enableEditing: false,
            },
            {
                accessorKey: 'zavrsno_stanje',
                header: 'Završno stanje',
                size: 200,
                enableEditing: true,
            },
            {
                accessorKey: 'izvor_citanja',
                header: 'Izvor čitanja',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Izvor čitanja"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getReadingSourceForSL'}
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
                accessorKey: 'napomena',
                header: 'Napomena',
                size: 200,
                enableEditing: true,
            },
            {
                accessorKey: 'status',
                header: 'Status',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Status"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getStatusForSL'}
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
                accessorKey: 'citac_id',
                header: 'Čitač',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Čitač"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={CONTROLLER + '/getReaderForSL'}
                            multiple={false}
                            onChange={(newValue) => {
                                row._valuesCache[column.id] = newValue;
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
        ];
    }, [readings, changeCount]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchPostData(CONTROLLER + '/getRows');
        setIsFetching(false);
        setReadings(data);
    }, []);

    const createRow = useCallback(async (row: Readings): Promise<void> => {
        setIsCreating(true);
        const res = await fetchPostData(CONTROLLER + '/addRow', row);
        setIsCreating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setReadings((prev) => [res.data, ...prev]);
    }, []);

    const updateRow = useCallback(async (row: Readings) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setReadings((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setReadings((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        readings,
        isFetching,
        isCreating,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        createRow,
        deleteRow,
    };
};

export default useReadings;
