import Main from '@/components/ui/Main';
import { ROBOTO_BOLD, ROBOTO_REGULAR } from '@/constants/base64/fonts';
import { VODOVOD_LOGO_PNG } from '@/constants/base64/logo';
import { CashRegisterReport } from '@/types/cashRegister';
import { fetchPostData } from '@/utils/fetchUtil';
import { globalTableProps } from '@/utils/globalTableProps';
import { saveAs } from '@/utils/utils';
import { Box, Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export const CashRegisterReportPage = ({ title }: { title: string }) => {
    const [isFetching, setIsFetching] = useState(false);
    const [data, setData] = useState<CashRegisterReport[]>([]);
    const [isPDFGenerating, setIsPDFGenerating] = useState(false);
    const [startDate, setStartDate] = useState<Dayjs | null>(null);
    const [endDate, setEndDate] = useState<Dayjs | null>(null);

    const fetchCashRegisterReportRows = async (startDate: Dayjs | null, endDate: Dayjs | null) => {
        try {
            setIsFetching(true);
            const data = await fetchPostData('../CashRegisterReportController/getCashRegisterReport', {
                start_date: startDate ? startDate.format('YYYY-MM-DD') : null,
                end_date: endDate ? endDate.format('YYYY-MM-DD') : null,
            });
            setIsFetching(false);
            setData(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        }
    };

    const columns = useMemo<MRT_ColumnDef<CashRegisterReport>[]>(() => {
        return [
            {
                accessorKey: 'blagajna',
                header: 'Blagajna',
                size: 150,
            },
            {
                accessorKey: 'blagajnik_id',
                header: 'Blagajnik',
                size: 150,
            },
            {
                accessorKey: 'datum',
                header: 'Datum',
                size: 150,
                // enableEditing: true,
                // Edit: ({ row, cell }) => {
                //     const initialValue = cell.getValue() ? dayjs(cell.getValue() as string) : null;
                //     return (
                //         <DatePicker
                //             value={initialValue}
                //             label={'Poslednja sinhronizacija'}
                //             sx={{ width: '100%' }}
                //             format="DD.MM.YYYY"
                //             onChange={(newDate) => {
                //                 row._valuesCache['poslednja_sinhronizacija'] = newDate?.format('YYYY-MM-DD');
                //             }}
                //         />
                //     );
                // },
                // Cell: ({ cell }) => {
                //     const date = cell.getValue();
                //     return date ? dayjs(date as string).format('DD.MM.YYYY') : '';
                // },
            },
            {
                accessorKey: 'broj_transakcija',
                header: 'Broj transakcija',
                size: 150,
            },
            {
                accessorKey: 'ukupan_promet',
                header: 'Ukupan promet',
                size: 150,
            },
            {
                accessorKey: 'promet_gotovina',
                header: 'Promet gotovina',
                size: 150,
            },
            {
                accessorKey: 'promet_kartica',
                header: 'Promet kartica',
                size: 150,
            },
            {
                accessorKey: 'promet_cek',
                header: 'Promet ček',
                size: 150,
            },
            {
                accessorKey: 'promet_vaucer',
                header: 'Promet vaučer',
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
            doc.text('Dnevni promet po blagajni/blagajniku', pageWidth / 2, 18, { align: 'center' });

            doc.setFontSize(12);
            doc.text(`Generisano: ${currentDate} u ${currentTime}`, pageWidth / 2, 26, { align: 'center' });

            autoTable(doc, {
                startY: 40,
                head: [['Blagajna', 'Blagajnik', 'Datum', 'Broj transakcija', 'Ukupan promet', 'Promet gotovina', 'Promet kartica', 'Promet ček', 'Promet vaučer']],
                body: data.map((row) => [
                    row.blagajna || 'N/A',
                    row.blagajnik || 'N/A',
                    dayjs(row.datum).format('DD.MM.YYYY HH:mm'),
                    row.broj_transakcija || '0',
                    row.ukupan_promet || '0',
                    row.promet_gotovina || '0',
                    row.promet_kartica || '0',
                    row.promet_cek || '0',
                    row.promet_vaucer || '0',
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

            doc.save(`Dnevni_promet_po_blagajni/blagajniku.pdf`);
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

        worksheet.addRow(['Blagajna', 'Blagajnik', 'Datum', 'Broj transakcija', 'Ukupan promet', 'Promet gotovina', 'Promet kartica', 'Promet ček', 'Promet vaučer']);

        data.forEach((row) => {
            worksheet.addRow([
                row.blagajna || 'N/A',
                row.blagajnik || 'N/A',
                dayjs(row.datum).format('DD.MM.YYYY HH:mm'),
                row.broj_transakcija || '0',
                row.ukupan_promet || '0',
                row.promet_gotovina || '0',
                row.promet_kartica || '0',
                row.promet_cek || '0',
                row.promet_vaucer || '0',
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
        saveAs(blob, 'Dnevni_promet_po_blagajni/blagajniku.xlsx');
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
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <DatePicker
                        label="Datum od"
                        value={startDate}
                        format="DD/MM/YYYY"
                        onChange={(newValue) => {
                            setStartDate(newValue);
                            if (newValue !== undefined) {
                                fetchCashRegisterReportRows(newValue, endDate);
                            }
                        }}
                    />
                    <DatePicker
                        label="Datum do"
                        value={endDate}
                        format="DD/MM/YYYY"
                        onChange={(newValue) => {
                            setEndDate(newValue);
                            if (newValue !== undefined) {
                                fetchCashRegisterReportRows(startDate, newValue);
                            }
                        }}
                    />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        color="warning"
                        disabled={isPDFGenerating}
                        onClick={exportToPDF}
                        sx={{ backgroundColor: '#ed6c02', '&:hover': { backgroundColor: '#e65100' } }}
                    >
                        {isPDFGenerating ? 'Generisanje PDF-a...' : 'Izvezi u PDF'}
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={exportToExcel}
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

export default CashRegisterReportPage;
