import { SearchList } from '@/components/ui/SearchList';
import { WaterServicesPricelist } from '@/types/finance';
import { fetchPostData } from '@/utils/fetchUtil';
import { getHideColumnProps } from '@/utils/props';
import { Button, Checkbox, FormControl, FormControlLabel, Typography } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { saveAs } from '@/utils/utils';
import { toast } from 'react-toastify';

const CONTROLLER = '../WaterServicesPricelistController';

const useWaterServicesPricelist = () => {
  const [service, setServices] = useState<WaterServicesPricelist[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const downloadDocument = async (filename: string) => {
    const res = await fetchPostData(CONTROLLER + '/downloadDocument', { filename }, 'blob', { Accept: 'application/octet-stream' });
    if (!res) {
      toast.error('Došlo je do greške prilikom preuzimanja fajla.');
      return;
    }
    saveAs(res, filename);
  };

  const columns = useMemo<MRT_ColumnDef<WaterServicesPricelist>[]>(() => {
    return [
      {
        accessorKey: 'id',
        header: 'ID cenovnika',
        size: 100,
        enableEditing: false,
        muiEditTextFieldProps: getHideColumnProps,
      },
      {
        accessorKey: 'service',
        header: 'Usluga',
        size: 200,
        enableEditing: true,
        Edit: ({ cell, table, column, row }) => {
          const { creatingRow: isCreating, editingRow: isEditing } = table.getState();
          const value = cell.getValue() as string;
          return (
            <SearchList
              label="Usluga"
              value={value}
              disabled={!isCreating && !isEditing}
              endpoint="../WaterServicesController/getServicesForSL"
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
        accessorKey: 'usage_fee_from',
        header: 'Potrošnja od',
        size: 250,
      },
      {
        accessorKey: 'usage_fee_to',
        header: 'Potrošnja do',
        size: 250,
      },
      {
        accessorKey: 'price',
        header: 'Cena',
        size: 100,
      },
      {
        accessorKey: 'VAT_rate',
        header: 'Stopa PDV-a u %',
        size: 100,
        Cell: ({ cell }) => `${cell.getValue<number>()} %`,
      },
      {
        accessorKey: 'fixed_charge',
        header: 'Fiksna naplata',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue() as number | undefined;
          const checked = value !== undefined && value > 0;
          return <Checkbox disabled checked={checked} id={`fixed_charge_cell_${cell.row.id}`} />;
        },
        enableEditing: true,
        Edit: ({ cell, row, column }) => {
          const value = Number(cell.getValue());
          const initial = value !== undefined && value > 0;
          const [checked, setChecked] = useState(initial);
          return (
            <FormControlLabel
              label="Fiksna naplata"
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
        accessorKey: 'assign_by_default',
        header: 'Obavezna pri dodeli',
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue() as number | undefined;
          const checked = value !== undefined && value > 0;
          return <Checkbox disabled checked={checked} />;
        },
        enableEditing: true,
        Edit: ({ cell, row, column }) => {
          const value = Number(cell.getValue());
          const initial = value !== undefined && value > 0;
          const [checked, setChecked] = useState(initial);
          return (
            <FormControlLabel
              label="Obavezna pri dodeli"
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
        accessorKey: 'document_name',
        header: 'Dokument',
        size: 450,
        enableEditing: true,
        Cell: ({ cell }) => {
          const filename = cell.getValue<string>();
          return (
            <Typography
              color="primary"
              sx={{ cursor: 'pointer', textDecoration: 'underline' }}
              component="span"
              onClick={() => downloadDocument(filename)}
            >
              {filename || '-'}
            </Typography>
          );
        },
        Edit: ({ row, column }) => {
          const [documentName, setDocumentName] = useState<string>('');
          const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
              setDocumentFile(file);
              setDocumentName(file.name);
              row._valuesCache[column.id] = file.name;
            }
          };
          return (
            <FormControl fullWidth>
              <Button variant="contained" component="label">
                Dokument
                <input type="file" hidden onChange={handleFileChange} />
              </Button>
              {documentName && (
                <Typography variant="caption" sx={{ mt: 1 }}>
                  Dokument: {documentName}
                </Typography>
              )}
            </FormControl>
          );
        },
      },
    ];
  }, []);

  const fetchData = useCallback(async (category_id: string) => {
    try {
      setIsFetching(true);
      const data = await fetchPostData(CONTROLLER + '/getRows', { category_id });
      setIsFetching(false);
      setServices(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  const buildFormData = (row: WaterServicesPricelist) => {
    const formData = new FormData();
    (Object.keys(row) as (keyof WaterServicesPricelist)[]).forEach((key) => {
      const value = row[key];
      if (value instanceof File) {
        formData.append(key as string, value);
      } else if (value !== undefined && value !== null) {
        formData.append(key as string, String(value));
      }
    });
    return formData;
  };

  const createRow = useCallback(async (row: WaterServicesPricelist): Promise<void> => {
    const formData = buildFormData(row);
    setIsCreating(true);
    const { success, data } = await fetchPostData(CONTROLLER + '/addRow', formData, 'json');
    setIsCreating(false);
    if (!success) throw new Error(data);
    setServices((prev) => [data, ...prev]);
  }, []);

  const updateRow = useCallback(async (row: WaterServicesPricelist) => {
    const formData = buildFormData(row);
    setIsUpdating(true);
    const res = await fetchPostData(CONTROLLER + '/editRow', formData, 'json');
    if (!res.success) throw new Error(res.error);
    setServices((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    setIsUpdating(false);
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    setIsDeleting(true);
    await fetchPostData(CONTROLLER + '/deleteRow', { id });
    setIsDeleting(false);
    setServices((state) => state.filter((x) => x.id !== id));
  }, []);

  return {
    columns,
    documentFile,
    service,
    fetchData,
    isFetching,
    isCreating,
    isUpdating,
    isDeleting,
    updateRow,
    createRow,
    deleteRow,
  };
};

export default useWaterServicesPricelist;
