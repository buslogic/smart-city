import { SearchList } from '@/components/ui/SearchList';
import { SubCampaign } from '@/types/billing-campaign';
import { fetchAPI } from '@/utils/fetchUtil';
import { Autocomplete, TextField, Typography } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';
const CONTROLLER = `${API_BASE}/api/sub-campaigns`;

const useSubCampaign = () => {
    const [subCampaign, setSubCampaign] = useState<SubCampaign[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const daniUNedelji = [
        "Ponedeljak",
        "Utorak",
        "Sreda",
        "Četvrtak",
        "Petak",
        "Subota",
        "Nedelja"
    ];

    const columns = useMemo<MRT_ColumnDef<SubCampaign>[]>(() => {
        return [
            {
                accessorKey: 'kampanja',
                header: 'Kampanja',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Kampanja"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={`${CONTROLLER}/getCampaignForSL`}
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
                accessorKey: 'dan',
                header: 'Dan',
                size: 150,
                enableEditing: true,
                Edit: ({ table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const [value, setValue] = useState<string>(() => {
                        return row.getValue(column.id) ?? "";
                    });
                    const handleChange = (_event: any, newValue: string | null) => {
                        setValue(newValue ?? "");
                    };
                    const handleBlur = () => {
                        row._valuesCache[column.id] = value;
                    };
                    return (
                        <Autocomplete
                            disabled={!isCreating && !isEditing}
                            options={daniUNedelji}
                            value={value}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            renderInput={(params) => <TextField {...params} label="Dan" variant="standard" />}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'vreme_od',
                header: 'Vreme od',
                size: 150,
                enableEditing: true,
                Edit: ({ column, row, table }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const [value, setValue] = useState<string>(() => {
                        return row.getValue(column.id) ?? "";
                    });
                    const [error, setError] = useState<string | null>(null);
                    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                        const val = event.target.value;
                        if (/^\d*$/.test(val)) {
                            setValue(val);
                            row._valuesCache[column.id] = val;
                            const num = Number(val);
                            if (val === "" || (num >= 0 && num <= 24)) {
                                setError(null);
                            } else {
                                setError("Vrednost mora biti između 0 i 24");
                            }
                        }
                    };
                    return (
                        <TextField
                            label="Vreme od"
                            variant="standard"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            onChange={handleChange}
                            error={!!error}
                            helperText={error}
                            fullWidth
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'vreme_do',
                header: 'Vreme do',
                size: 150,
                enableEditing: true,
                Edit: ({ column, row, table }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const [value, setValue] = useState<string>(() => {
                        return row.getValue(column.id) ?? "";
                    });
                    const [error, setError] = useState<string | null>(null);
                    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                        const val = event.target.value;
                        if (/^\d*$/.test(val)) {
                            setValue(val);
                            const num = Number(val);
                            if (val === "" || (num >= 0 && num <= 24)) {
                                setError(null);
                                row._valuesCache[column.id] = val;
                            } else {
                                setError("Vrednost mora biti između 0 i 24");
                            }
                        }
                    };
                    return (
                        <TextField
                            label="Vreme do"
                            variant="standard"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            onChange={handleChange}
                            error={!!error}
                            helperText={error}
                            fullWidth
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        />
                    );
                },
                Cell: ({ cell }) => <Typography>{cell.getValue() as string}</Typography>,
            },
            {
                accessorKey: 'region_id',
                header: 'Rejon',
                size: 200,
                enableEditing: true,
                Edit: ({ cell, table, column, row }) => {
                    const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
                    const value = cell.getValue() as string;

                    return (
                        <SearchList
                            label="Rejon"
                            value={value}
                            disabled={!isCreating && !isEditing}
                            endpoint={`${CONTROLLER}/getRegionForSL`}
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
                            endpoint={`${CONTROLLER}/getCitacForSL`}
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
    }, [subCampaign]);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        const data = await fetchAPI<SubCampaign[]>(`${CONTROLLER}/getRows`, { method: 'POST' });
        setIsFetching(false);
        setSubCampaign(data);
    }, []);

    const createRow = useCallback(async (row: SubCampaign): Promise<{ success: boolean; error?: string }> => {
        const vremeOd = Number(row.vreme_od);
        const vremeDo = Number(row.vreme_do);
        if (
            isNaN(vremeOd) || vremeOd < 0 || vremeOd > 24 ||
            isNaN(vremeDo) || vremeDo < 0 || vremeDo > 24
        ) {
            return { success: false, error: "Vrednosti 'Vreme od' i 'Vreme do' moraju biti brojevi između 0 i 24." };
        }
        setIsCreating(true);
        try {
            // Konvertuj vreme_od i vreme_do u brojeve
            const dataToSend = {
                ...row,
                vreme_od: vremeOd,
                vreme_do: vremeDo
            };
            const res = await fetchAPI<{ success: boolean; error?: string; data: SubCampaign }>(
                `${CONTROLLER}/addRow`,
                { method: 'POST', data: dataToSend }
            );
            if (!res.success) {
                return { success: false, error: res.error || "Greška prilikom čuvanja." };
            }
            setSubCampaign((prev) => [res.data, ...prev]);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || "Greška prilikom čuvanja." };
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: SubCampaign) => {
        const vremeOd = Number(row.vreme_od);
        const vremeDo = Number(row.vreme_do);
        if (
            isNaN(vremeOd) || vremeOd < 0 || vremeOd > 24 ||
            isNaN(vremeDo) || vremeDo < 0 || vremeDo > 24
        ) {
            return { success: false, error: "Vrednosti 'Vreme od' i 'Vreme do' moraju biti brojevi između 0 i 24." };
        }
        setIsUpdating(true);
        // Konvertuj vreme_od i vreme_do u brojeve
        const dataToSend = {
            ...row,
            vreme_od: vremeOd,
            vreme_do: vremeDo
        };
        const res = await fetchAPI<{ success: boolean; error?: string; data: SubCampaign }>(
            `${CONTROLLER}/editRow`,
            { method: 'POST', data: dataToSend }
        );
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setSubCampaign((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
        return { success: true };
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchAPI(`${CONTROLLER}/deleteRow`, { method: 'POST', data: { id } });
        setIsDeleting(false);
        setSubCampaign((state) => state.filter((x) => x.id !== id));
    }, []);

    return {
        columns,
        subCampaign,
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

export default useSubCampaign;
