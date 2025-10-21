import { SearchList } from '@/components/ui/SearchList';
import { Campaign } from '@/types/billing-campaign';
import { fetchAPI } from '@/utils/fetchUtil';
import { Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/campaigns`;

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
                Edit: ({ row, cell, column }) => {
                    const rawValue = cell.getValue() as string | null;
                    // Period dolazi kao "YYYY/MM" string, treba ga parsirati
                    let initialValue: Dayjs | null = null;
                    if (rawValue && rawValue !== '0000-00-00') {
                        const parts = rawValue.split('/');
                        if (parts.length === 2) {
                            const year = parseInt(parts[0]);
                            const month = parseInt(parts[1]) - 1; // dayjs month je 0-indexed
                            initialValue = dayjs().year(year).month(month);
                        }
                    }

                    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialValue);

                    return (
                        <DatePicker
                            views={['month', 'year']}
                            value={selectedDate}
                            label={'Period *'}
                            sx={{ width: '100%' }}
                            format="MM.YYYY"
                            slotProps={{
                                textField: {
                                    variant: 'standard',
                                },
                            }}
                            onChange={(newDate) => {
                                setSelectedDate(newDate);
                                if (newDate) {
                                    row._valuesCache['godina'] = newDate.year();
                                    row._valuesCache['mesec'] = newDate.month() + 1;
                                    row._valuesCache[column.id] = `${newDate.year()}/${newDate.month() + 1}`;
                                }
                            }}
                        />
                    );
                },
                Cell: ({ cell }) => {
                    const date = cell.getValue();
                    if (!date || date === '0000-00-00') return '';
                    const parts = (date as string).split('/');
                    if (parts.length === 2) {
                        return `${parts[1].padStart(2, '0')}.${parts[0]}`;
                    }
                    return date as string;
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
                Edit: ({ row, cell, column }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00' && rawValue !== '' ? dayjs(rawValue) : null;
                    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialValue);

                    return (
                        <DatePicker
                            value={selectedDate}
                            label={'Datum kreiranja'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            slotProps={{
                                textField: {
                                    variant: 'standard',
                                },
                            }}
                            onChange={(newDate) => {
                                setSelectedDate(newDate);
                                row._valuesCache[column.id] = newDate ? newDate.format('YYYY-MM-DD') : null;
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
                Edit: ({ row, cell, column }) => {
                    const rawValue = cell.getValue() as string | null;
                    const initialValue = rawValue && rawValue !== '0000-00-00' && rawValue !== '' ? dayjs(rawValue) : null;
                    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialValue);

                    return (
                        <DatePicker
                            value={selectedDate}
                            label={'Datum zatvaranja'}
                            sx={{ width: '100%' }}
                            format="DD.MM.YYYY"
                            slotProps={{
                                textField: {
                                    variant: 'standard',
                                },
                            }}
                            onChange={(newDate) => {
                                setSelectedDate(newDate);
                                row._valuesCache[column.id] = newDate ? newDate.format('YYYY-MM-DD') : null;
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
                            endpoint={`${CONTROLLER}/getStatusForSL`}
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
        const data = await fetchAPI<Campaign[]>(`${CONTROLLER}/getRows`, { method: 'POST' });
        setIsFetching(false);
        setCampaign(data);
    }, []);

    const createRow = useCallback(async (row: Campaign): Promise<void> => {
        const exists = await fetchAPI<{ exists: boolean }>(
            `${CONTROLLER}/checkIfCampaignExists`,
            {
                method: 'POST',
                data: {
                    godina: row.godina,
                    mesec: row.mesec,
                }
            }
        );
        if (exists && exists.exists) {
            toast.error('Kampanja za izabrani period već postoji');
            return;
        } else {
            setIsCreating(true);
            const res = await fetchAPI<{ success: boolean; error?: string; data: Campaign }>(
                `${CONTROLLER}/addRow`,
                { method: 'POST', data: row }
            );
            setIsCreating(false);
            if (!res.success) {
                throw new Error(res.error);
            }
            setCampaign((prev) => [res.data, ...prev]);
        }
    }, []);

    const updateRow = useCallback(async (row: Campaign) => {
        setIsUpdating(true);
        const res = await fetchAPI<{ success: boolean; error?: string; data: Campaign }>(
            `${CONTROLLER}/editRow`,
            { method: 'POST', data: row }
        );
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setCampaign((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchAPI(`${CONTROLLER}/deleteRow`, { method: 'POST', data: { id } });
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
