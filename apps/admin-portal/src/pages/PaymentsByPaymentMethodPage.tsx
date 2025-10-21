import Main from '@/components/ui/Main';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import { PaymentsByPaymentMethod } from '@/types/cashRegister';
import { fetchAPI } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { saveAs } from '@/utils/utils';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export const PaymentsByPaymentMethodPage = ({ title }: { title: string }) => {
    const [isFetching, setIsFetching] = useState(false);
    const [data, setData] = useState<PaymentsByPaymentMethod[]>([]);
    const [isPDFGenerating, setIsPDFGenerating] = useState(false);
    const [isShiftOpen, setIsShiftOpen] = useState<number>(0);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

    const paymentMethods = [
        { value: "1", label: "Keš" },
        { value: "2", label: "Kartica" },
        { value: "3", label: "Ček" },
        { value: "4", label: "Vaučer" },
    ];

    useEffect(() => {
        const getShiftStatus = async () => {
            const data = await fetchAPI('/api/cashiers-session/isSessionOpen', { method: 'POST' });
            if (data) {
                setIsShiftOpen(data);
            }
        };

        getShiftStatus();
    }, []);

    const fetchPaymentsByPaymentMethodRows = async (id: number) => {
        console.log('Fetching payments by payment method for ID:', id);
        try {
            setIsFetching(true);
            const data = await fetchAPI('/api/cash-register/getPaymentsByPaymentMethod', {
                method: 'POST',
                data: {
                    id: id || null,
                },
            });
            setIsFetching(false);
            setData(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        }
    };

    async function handleFilterChange(value: string) {
        console.log('Selected value:', value);
        try {
            const parts = value.split(' | ');
            if (parts.length > 0) {
                const id = Number(parts[0]);
                if (!isNaN(id)) {
                    fetchPaymentsByPaymentMethodRows(id);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    const columns = useMemo<MRT_ColumnDef<PaymentsByPaymentMethod>[]>(() => {
        return [
            {
                accessorKey: 'blagajna',
                header: 'Blagajna',
                size: 150,
            },
            {
                accessorKey: 'blagajnik',
                header: 'Blagajnik',
                size: 150,
            },
            {
                accessorKey: 'datum',
                header: 'Datum kreiranja',
                size: 150,
            },
            {
                accessorKey: 'ukupno',
                header: 'Ukupan promet',
                size: 150,
            },
        ];
    }, []);

    const exportToPDF = async () => {
        try {
            if (data.length === 0) {
                toast.error('Nema podataka za štampu!');
                return;
            }

            setIsPDFGenerating(true);

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [230, 297],
            });

            doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD);
            doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
            doc.setFont('Roboto');

            const pageWidth = doc.internal.pageSize.getWidth();
            const currentDate = dayjs().format('DD.MM.YYYY');
            const currentTime = dayjs().format('HH:mm');

            doc.addImage(VODOVOD_LOGO_PNG, 'PNG', 8, 8, 18, 18);

            doc.setFontSize(14);
            doc.text('Pregled uplata po metodi plaćanja - ' + selectedPaymentMethod.split(' | ')[1], pageWidth / 2, 18, { align: 'center' });

            doc.setFontSize(12);
            doc.text(`Generisano: ${currentDate} u ${currentTime}`, pageWidth / 2, 26, { align: 'center' });

            autoTable(doc, {
                startY: 40,
                head: [['Blagajna', 'Blagajnik', 'Datum kreiranja', 'Ukupan promet']],
                body: data.map((row) => [
                    row.blagajna || 'N/A',
                    row.blagajnik || 'N/A',
                    dayjs(row.datum).format('DD.MM.YYYY HH:mm'),
                    row.ukupno || '0',
                ]),
                styles: {
                    font: 'Roboto',
                    fontSize: 8,
                    cellPadding: 1,
                    overflow: 'linebreak',
                    halign: 'center',
                    valign: 'middle',
                },
                headStyles: {
                    font: 'Roboto',
                    fontSize: 8,
                    overflow: 'linebreak',
                    cellPadding: 1,
                    minCellHeight: 10,
                    halign: 'center',
                    valign: 'middle',
                    fontStyle: 'bold',
                },
            });

            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(10);
                doc.text(`Strana ${i} od ${pageCount}`, pageWidth - 14, doc.internal.pageSize.height - 10, { align: 'right' });
            }

            doc.save(`Pregled_uplata_po_metodi_plaćanja.pdf`);
        } catch (err) {
            console.log(err);
            toast.error('Došlo je do greške prilikom generisanja PDF-a!');
        } finally {
            setIsPDFGenerating(false);
        }
    };

    const exportToExcel = async () => {
        if (data.length === 0) {
            toast.error('Nema podataka za izvoz!');
            return;
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cenovnik');

        worksheet.addRow(['Blagajna', 'Blagajnik', 'Datum kreiranja', 'Ukupan promet']);

        data.forEach((row) => {
            worksheet.addRow([
                row.blagajna || 'N/A',
                row.blagajnik || 'N/A',
                dayjs(row.datum).format('DD.MM.YYYY HH:mm'),
                row.ukupno || '0',
            ]);
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D3D3D3' },
        };

        worksheet.columns.forEach((column) => {
            column.width = 20;
        });

        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'Pregled uplata po metodi plaćanja - ' + selectedPaymentMethod.split(' | ')[1] + '.xlsx');
    };

    const table = useMaterialReactTable({
        ...globalTableProps,
        columns,
        data,
        enableEditing: false,
        initialState: {
            columnVisibility: { id: false, code: false },
        },
        state: {
            showProgressBars: isFetching,
        },
    });

    return (
        <Main title={title}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    marginBottom: '12px',
                    justifyContent: 'space-between'
                }}>
                <Box sx={{ width: '400px' }}>
                    {!isShiftOpen && (
                        <Typography sx={{ color: 'red', marginBottom: '8px' }}>
                            SMENA NIJE OTVORENA!
                        </Typography>
                    )}
                    <TextField
                        select
                        disabled={!isShiftOpen}
                        fullWidth
                        label="Način plaćanja"
                        variant="outlined"
                        value={selectedPaymentMethod}
                        onChange={(e) => {
                            setSelectedPaymentMethod(e.target.value);
                            handleFilterChange(e.target.value);
                        }}
                    >
                        {paymentMethods.map((pm) => (
                            <MenuItem key={pm.value} value={`${pm.value} | ${pm.label}`}>
                                {pm.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        color="warning"
                        disabled={isPDFGenerating || !isShiftOpen || !selectedPaymentMethod}
                        onClick={exportToPDF}
                        sx={{ backgroundColor: '#ed6c02', '&:hover': { backgroundColor: '#e65100' } }}
                    >
                        {isPDFGenerating ? 'Generisanje PDF-a...' : 'Izvezi u PDF'}
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={exportToExcel}
                        disabled={!isShiftOpen || !selectedPaymentMethod}
                        sx={{ backgroundColor: '#2e7d32', '&:hover': { backgroundColor: '#1b5e20' } }}
                    >
                        Izvezi u Excel
                    </Button>
                </Box>
            </Box>
            <MaterialReactTable table={table} />
        </Main>
    );
};

export default PaymentsByPaymentMethodPage;
