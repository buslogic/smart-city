import { SearchList } from '@/components/ui/SearchList';
import { WaterServicesPricelist } from '@/types/finance';
import { api } from '@/services/api';
import { getHideColumnProps } from '@/utils/props';
import { Button, Checkbox, FormControl, FormControlLabel, Typography } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import { useCallback, useMemo, useState } from 'react';
import { saveAs } from '@/utils/utils';
import { toast } from 'react-toastify';

const useWaterServicesPricelist = () => {
  const [service, setServices] = useState<WaterServicesPricelist[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const downloadDocument = async (filename: string) => {
    try {
      const { data } = await api.post('/api/water-service-prices/download',
        { filename },
        { responseType: 'blob' }
      );
      saveAs(data, filename);
    } catch (error) {
      toast.error('Došlo je do greške prilikom preuzimanja fajla.');
    }
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
              endpoint="/api/water-services/search"
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
      const { data } = await api.get<WaterServicesPricelist[]>(`/api/water-service-prices`, {
        params: { category_id }
      });
      setServices(data);
    } catch (err) {
      console.error(err);
      toast.error('Greška pri učitavanju cenovnika.');
    } finally {
      setIsFetching(false);
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
    try {
      setIsCreating(true);

      const payload = {
        service_id: parseInt(row.service_id as any) || undefined,
        category_id: parseInt(row.category_id as any) || undefined,
        fixed_charge: row.fixed_charge ? parseInt(String(row.fixed_charge)) : 0,
        price: parseFloat(String(row.price)),
        usage_fee_from: row.usage_fee_from ? parseFloat(String(row.usage_fee_from)) : 0,
        usage_fee_to: row.usage_fee_to ? parseFloat(String(row.usage_fee_to)) : 0,
        VAT_rate: row.VAT_rate ? parseFloat(String(row.VAT_rate)) : 0,
        assign_by_default: Boolean(row.assign_by_default),
        document_name: row.document_name || '',
      };

      const { data } = await api.post<WaterServicesPricelist>('/api/water-service-prices', payload);
      setServices((prev) => [data, ...prev]);
    } catch (error) {
      toast.error('Greška pri kreiranju stavke cenovnika.');
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateRow = useCallback(async (row: WaterServicesPricelist) => {
    try {
      setIsUpdating(true);

      const { id, service, category, ...rest } = row;

      const payload = {
        service_id: parseInt(row.service_id as any) || undefined,
        category_id: parseInt(row.category_id as any) || undefined,
        fixed_charge: row.fixed_charge ? parseInt(String(row.fixed_charge)) : 0,
        price: parseFloat(String(row.price)),
        usage_fee_from: row.usage_fee_from ? parseFloat(String(row.usage_fee_from)) : 0,
        usage_fee_to: row.usage_fee_to ? parseFloat(String(row.usage_fee_to)) : 0,
        VAT_rate: row.VAT_rate ? parseFloat(String(row.VAT_rate)) : 0,
        assign_by_default: Boolean(row.assign_by_default),
        document_name: row.document_name || '',
      };

      const { data } = await api.patch<WaterServicesPricelist>(`/api/water-service-prices/${id}`, payload);
      setServices((prev) => prev.map((x) => (x.id === id ? data : x)));
    } catch (error) {
      toast.error('Greška pri ažuriranju stavke cenovnika.');
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteRow = useCallback(async (id: number) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/water-service-prices/${id}`);
      setServices((state) => state.filter((x) => x.id !== id));
    } catch (error) {
      toast.error('Greška pri brisanju stavke cenovnika.');
      throw error;
    } finally {
      setIsDeleting(false);
    }
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
