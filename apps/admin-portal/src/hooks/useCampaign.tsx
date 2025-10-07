import { SearchList } from '@/components/ui/SearchList';
import { Campaign } from '@/types/billing-campaign';
import { fetchPostData } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const CONTROLLER = '../CampaignController';

const useCampaign = () => {
    const [campaign, setCampaign] = useState<Campaign[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<Campaign>[]>(() => {
        return [
            {
                accessorKey: 'period',
                header: 'Period',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00' ? dayjs(rawValue) : null;

                    return (
                        <DatePicker
                            views={['month', 'year']}
                            value={initialValue}
                            label={'Period *'}
                            sx={{ width: '100%' }}
                            format="MM.YYYY"
                            onChange={(newDate) => {
                                row._valuesCache['godina'] = newDate ? newDate.year() : '';
                                row._valuesCache['mesec'] = newDate ? newDate.month() + 1 : '';
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => {
                    const date = cell.getValue();
                    if (!date || date === '0000-00-00') return '';
                    return dayjs(date as string).format('MM.YYYY');
                },
            },
            {
                accessorKey: 'sifra',
                header: 'Šifra',
                size: 150,
            },
            {
                accessorKey: 'datum_kreiranja',
                header: 'Datum kreiranja',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00' ? dayjs(rawValue) : null;

                    return (
                        <DatePicker
                            value={initialValue}
                            label={'Datum kreiranja'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            onChange={(newDate) => {
                                row._valuesCache['datum_kreiranja'] = newDate ? newDate.format('YYYY-MM-DD') : '';
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
                accessorKey: 'datum_zatvaranja',
                header: 'Datum zatvaranja',
                size: 150,
                enableEditing: true,
                Edit: ({ row, cell }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00' ? dayjs(rawValue) : null;

                    return (
                        <DatePicker
                            value={initialValue}
                            label={'Datum zatvaranja'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            onChange={(newDate) => {
                                row._valuesCache['datum_zatvaranja'] = newDate ? newDate.format('YYYY-MM-DD') : '';
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
                accessorKey: 'status_id',
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
        ];
    }, [campaign]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchPostData(CONTROLLER + '/getRows');
        setIsFetching(false);
        setCampaign(data);
    }, []);

    const createRow = useCallback(async (row: Campaign): Promise<void> => {
        const exists = await fetchPostData(CONTROLLER + '/checkIfCampaignExists', {
            godina: row.godina,
            mesec: row.mesec,
        });
        if (exists && exists.exists) {
            toast.error('Kampanja za izabrani period već postoji');
            return;
        } else {
            setIsCreating(true);
            const res = await fetchPostData(CONTROLLER + '/addRow', row);
            setIsCreating(false);
            if (!res.success) {
                throw new Error(res.error);
            }
            setCampaign((prev) => [res.data, ...prev]);
        }
    }, []);

    const updateRow = useCallback(async (row: Campaign) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setCampaign((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setCampaign((state) => state.filter((x) => x.id !== id));
    }, []);

    const isPeriodExists = (godina: number, mesec: number) => {
        return campaign.some(c => c.godina === godina && c.mesec === mesec);
    };

    const isPeriodLocked = (godina: number, mesec: number): boolean => {
        const now = dayjs();
        const period = dayjs().year(godina).month(mesec - 1).startOf('month');
        return period.isBefore(now.startOf('month'));
    };

    return {
        columns,
        campaign,
        isFetching,
        isCreating,
        isUpdating,
        isDeleting,
        fetchData,
        updateRow,
        createRow,
        deleteRow,
        isPeriodExists,
        isPeriodLocked
    };
};

export default useCampaign;
