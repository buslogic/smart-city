import Main from '@/components/ui/Main';
import { SearchList } from '@/components/ui/SearchList';
import { MeasuringPoints } from '@/types/measuring-points';
import { fetchPostData } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { Box, Button, TextField } from '@mui/material';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export default function MeasuringPointsByAddressPage({ title }: { title: string }) {
    const [isFetching, setIsFetching] = useState<boolean>(false);
    const [rows, setRows] = useState<MeasuringPoints[]>([]);
    const [staraAdresa, setStaraAdresa] = useState('');
    const [brojAdrese, setBrojAdrese] = useState('');
    const [ulaz, setUlaz] = useState('');

    const [idmm, setIDMM] = useState('');
    const [novaAdresa, setNovaAdresa] = useState('');
    const [noviBroj, setNoviBroj] = useState('');
    const [noviUlaz, setNoviUlaz] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setIsFetching(true);
                const data: MeasuringPoints[] = await fetchPostData('../MeasuringPointsByAddressController/getAddressHistory', {});
                setRows(data);
            } catch (err) {
                console.log(err);
                toast.error('Došlo je do greške pri učitavanju početnih podataka');
            } finally {
                setIsFetching(false);
            }
        };
        fetchInitialData();
    }, []);

    async function handleAddressChange(newValue: string) {
        try {
            setIsFetching(true);

            const parts = newValue.split('|');
            const idmm = parts[0].trim();

            const addressDetails: MeasuringPoints[] = await fetchPostData(
                '../MeasuringPointsByAddressController/getAddressByIDMM',
                { idmm: idmm }
            );
            if (addressDetails.length > 0) {
                const detail = addressDetails[0];
                setStaraAdresa(detail.adresa || '');
                setBrojAdrese(String(detail.broj2) || '');
                setUlaz(detail.ulaz || '');
            }
        } catch (err) {
            console.log(err);
            toast.error('Došlo je do greške pri učitavanju detalja adrese');
        } finally {
            setIsFetching(false);
        }
    }

    const handleSubmit = async () => {
        try {
            setIsFetching(true);
            const { data, success } = await fetchPostData(
                '../MeasuringPointsByAddressController/saveNewAddress',
                {
                    idmm,
                    staraAdresa,
                    brojAdrese,
                    ulaz,
                    novaAdresa,
                    noviBroj,
                    noviUlaz,
                }
            );
            if (!success) {
                throw new Error('Neuspešno čuvanje podataka');
            }
            toast.success('Podaci su uspešno sačuvani!');
            setRows((prev) => ([data, ...prev]))
        } catch (err) {
            console.log(err);
            toast.error('Došlo je do greške pri čuvanju podataka');
        } finally {
            setIsFetching(false);
        }
    };

    const columns = useMemo<MRT_ColumnDef<MeasuringPoints>[]>(() => {
        return [
            {
                accessorKey: 'id',
                header: 'ID',
                size: 100,
            },
            {
                accessorKey: 'idmm',
                header: 'ID mernog mesta',
                size: 100,
            },
            {
                accessorKey: 'stara_adresa',
                header: 'Stara adresa',
                size: 150,
            },
            {
                accessorKey: 'nova_adresa',
                header: 'Nova adresa',
                size: 150,
            },
            {
                accessorKey: 'stari_ulaz',
                header: 'Stari ulaz',
                size: 50,
            },
            {
                accessorKey: 'novi_ulaz',
                header: 'Novi ulaz',
                size: 50,
            },
            {
                accessorKey: 'stari_broj',
                header: 'Stari broj',
                size: 50,
            },
            {
                accessorKey: 'novi_broj',
                header: 'Novi broj',
                size: 50,
            },
        ];
    }, []);

    const table = useMaterialReactTable({
        ...globalTableProps,
        columns,
        data: rows,
        createDisplayMode: 'modal',
        editDisplayMode: 'modal',
        initialState: {
            columnVisibility: { id: false },
        },
        state: {
            showProgressBars: isFetching,
        },
    });

    return (
        <Main title={title}>
            <Box sx={{ width: '500px', marginBottom: '12px' }}>
                <SearchList
                    label="Merno mesto"
                    endpoint={`../WaterMeterController/getMeasuringPointsForSL`}
                    multiple={false}
                    textFieldProps={{
                        variant: 'standard',
                    }}
                    onChange={(newValue) => {
                        handleAddressChange(newValue);
                        setIDMM(newValue.split('|')[0].trim());
                    }}
                />
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <TextField
                        id="stara-adresa"
                        label="Stara adresa"
                        variant="standard"
                        fullWidth
                        placeholder="Unesite staru adresu"
                        value={staraAdresa}
                        autoComplete="off"
                        onChange={(e) => setStaraAdresa(e.target.value)}
                        disabled
                    />
                </Box>
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <TextField
                        id="broj-adrese"
                        label="Stari broj adrese"
                        variant="standard"
                        fullWidth
                        placeholder="Unesite broj adrese"
                        value={brojAdrese}
                        autoComplete="off"
                        onChange={(e) => setBrojAdrese(e.target.value)}
                        disabled
                    />
                </Box>
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <TextField
                        id="ulaz"
                        label="Stari ulaz"
                        variant="standard"
                        fullWidth
                        placeholder="Unesite ulaz"
                        value={ulaz}
                        autoComplete="off"
                        onChange={(e) => setUlaz(e.target.value)}
                        disabled
                    />
                </Box>
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <SearchList
                        label="Nova adresa"
                        endpoint={`../MeasuringPointsByAddressController/getAddresses`}
                        multiple={false}
                        textFieldProps={{
                            variant: 'standard',
                        }}
                        onChange={(newValue) => setNovaAdresa(newValue)}
                    />
                </Box>
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <TextField
                        id="novi-broj-adrese"
                        label="Novi broj adrese"
                        variant="standard"
                        fullWidth
                        placeholder="Unesite novi broj adrese"
                        autoComplete="off"
                        onChange={(e) => setNoviBroj(e.target.value)}
                    />
                </Box>
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <TextField
                        id="novi-ulaz"
                        label="Novi ulaz"
                        variant="standard"
                        fullWidth
                        placeholder="Unesite novi ulaz"
                        autoComplete="off"
                        onChange={(e) => setNoviUlaz(e.target.value)}
                    />
                </Box>
                <Box sx={{ flex: 1, marginTop: 2 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                    >
                        Sačuvaj
                    </Button>
                </Box>
            </Box>
            <MaterialReactTable table={table} />
        </Main>
    );
}
