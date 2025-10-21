import { WaterMeterRemark } from '@/types/water-meter';
import { fetchAPI } from '@/utils/fetchUtil';
import { Checkbox, FormControlLabel, TextField } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_ENDPOINT = '/api/water-meter-remarks';

const useWaterMeterRemarks = () => {
    const [waterMeterRemarks, setWaterMeterRemarks] = useState<WaterMeterRemark[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const columns = useMemo<MRT_ColumnDef<WaterMeterRemark>[]>(() => {
        return [
            {
                accessorKey: 'id',
                header: 'ID',
                size: 80,
                enableEditing: false,
            },
            {
                accessorKey: 'meterReading',
                header: 'Očitanje vodomera',
                size: 150,
                Edit: ({ cell, row, column }) => {
                    const value = (cell.getValue() as string) || '-';
                    return (
                        <TextField
                            label="Očitanje vodomera"
                            defaultValue={value}
                            onChange={(e) => {
                                row._valuesCache[column.id] = e.target.value;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'faulty',
                header: 'Neispravan',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`faulty_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Neispravan"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'unreadable',
                header: 'Neočitljiv',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`unreadable_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Neočitljiv"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'notFoundOnSite',
                header: 'Nije pronađen',
                size: 140,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`not_found_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Nije pronađen"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'noMeter',
                header: 'Nema vodomera',
                size: 140,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`no_meter_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Nema vodomera"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'negativeConsumption',
                header: 'Negativna potrošnja',
                size: 170,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`neg_consumption_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Negativna potrošnja"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'transferToNextCl',
                header: 'Prenesi',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`transfer_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Prenesi"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'billPrintout',
                header: 'Štampanje računa',
                size: 150,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`bill_printout_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Štampanje računa"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'canceled',
                header: 'Otkazan',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`canceled_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Otkazan"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'priority',
                header: 'Prioritet',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`priority_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Prioritet"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'average',
                header: 'Prosek',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`average_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Prosek"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'meterReaderOnly',
                header: 'Samo očitač',
                size: 140,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`meter_reader_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Samo očitač"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'disconnected',
                header: 'Isključen',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`disconnected_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Isključen"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'censusSelect',
                header: 'Cenzus',
                size: 120,
                Cell: ({ cell }) => {
                    const value = cell.getValue() as number;
                    const checked = value !== undefined && value > 0;
                    return <Checkbox disabled checked={checked} id={`census_cell_${cell.row.id}`} />;
                },
                Edit: ({ cell, row, column }) => {
                    const value = Number(cell.getValue());
                    const initial = value !== undefined && value > 0;
                    const [checked, setChecked] = useState(initial);
                    return (
                        <FormControlLabel
                            label="Cenzus"
                            control={
                                <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setChecked(isChecked);
                                        row._valuesCache[column.id] = isChecked ? 1 : 0;
                                    }}
                                />
                            }
                        />
                    );
                },
            },
            {
                accessorKey: 'note',
                header: 'Napomena',
                size: 200,
                Edit: ({ cell, row, column }) => {
                    const value = (cell.getValue() as string) || '';
                    return (
                        <TextField
                            label="Napomena"
                            multiline
                            rows={3}
                            defaultValue={value}
                            onChange={(e) => {
                                row._valuesCache[column.id] = e.target.value;
                            }}
                        />
                    );
                },
            },
            {
                accessorKey: 'userAccount',
                header: 'Korisnički račun',
                size: 150,
                Edit: ({ cell, row, column }) => {
                    const value = (cell.getValue() as string) || '';
                    return (
                        <TextField
                            label="Korisnički račun"
                            defaultValue={value}
                            onChange={(e) => {
                                row._valuesCache[column.id] = e.target.value;
                            }}
                        />
                    );
                },
            },
        ];
    }, []);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        try {
            const data = await fetchAPI<WaterMeterRemark[]>(API_ENDPOINT, {
                method: 'GET',
            });
            setWaterMeterRemarks(data);
        } catch (error) {
            console.error('Greška pri učitavanju podataka:', error);
        } finally {
            setIsFetching(false);
        }
    }, []);

    const createRow = useCallback(async (row: WaterMeterRemark): Promise<void> => {
        setIsCreating(true);
        try {
            const newRow = await fetchAPI<WaterMeterRemark>(API_ENDPOINT, {
                method: 'POST',
                data: row,
            });
            setWaterMeterRemarks((prev) => [newRow, ...prev]);
        } catch (error) {
            console.error('Greška pri kreiranju reda:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: WaterMeterRemark) => {
        setIsUpdating(true);
        try {
            const updatedRow = await fetchAPI<WaterMeterRemark>(`${API_ENDPOINT}/${row.id}`, {
                method: 'PATCH',
                data: row,
            });
            setWaterMeterRemarks((prev) => prev.map((x) => (x.id === row.id ? updatedRow : x)));
        } catch (error) {
            console.error('Greška pri ažuriranju reda:', error);
            throw error;
        } finally {
            setIsUpdating(false);
        }
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        try {
            await fetchAPI(`${API_ENDPOINT}/${id}`, {
                method: 'DELETE',
            });
            setWaterMeterRemarks((state) => state.filter((x) => x.id !== id));
        } catch (error) {
            console.error('Greška pri brisanju reda:', error);
            throw error;
        } finally {
            setIsDeleting(false);
        }
    }, []);

    return {
        columns,
        waterMeterRemarks,
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

export default useWaterMeterRemarks;
