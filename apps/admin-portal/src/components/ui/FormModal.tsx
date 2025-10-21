import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { MRT_ColumnDef } from 'material-react-table';
import { fetchAPI } from '@/utils/fetchUtil';
import Input from './Input';

type FormModalProps<T extends Record<string, any>> = {
  columns?: MRT_ColumnDef<T, unknown>[];
  url?: string;
  dataBody?: Record<string, unknown>;
  handleClose: () => void;
  handleAction?: (row: T) => void;
  readOnly?: boolean;
  title?: string;
  navigateURL?: string;
  navigatePageTitle?: string;
  initialData?: T;
};

type CustomEditProps<T extends Record<string, any>> = {
  row: {
    original: T;
    _valuesCache: Record<string, any>;
  };
  cell: {
    getValue: () => any;
  };
  table: {
    getState: () => {
      creatingRow: boolean;
      editingRow: boolean;
    };
  };
  column: MRT_ColumnDef<T, unknown> & { id: string };
  onChange: (value: any) => void;
  disabled?: boolean;
};

export const FormModal = <T extends Record<string, any>>({
  columns = [],
  url,
  dataBody,
  handleClose,
  handleAction,
  readOnly = false,
  title = 'Form',
  navigateURL,
  // navigatePageTitle,
  initialData,
}: FormModalProps<T>) => {
  const [row, setRow] = useState<T | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!!url && !initialData);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = await fetchAPI(url, {
        method: 'POST',
        data: dataBody,
      });

      if (data && typeof data === 'object') {
        setRow(data as T);
      } else {
        setError('Invalid data format received');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [url, dataBody]);

  useEffect(() => {
    if (url && !initialData) {
      fetchData();
    }
  }, [url, initialData, fetchData]);

  const handleValueChange = useCallback((accessorKey: string, value: any) => {
    setRow((prev) => {
      if (!prev) return prev;
      return { ...prev, [accessorKey]: value };
    });
  }, []);

  const valuesCache = useMemo(() => {
    if (!row) return {};
    return new Proxy({ ...row } as Record<string, any>, {
      set: (target, prop, value) => {
        handleValueChange(String(prop), value);
        target[String(prop)] = value;
        return true;
      },
    });
  }, [row, handleValueChange]);

  const renderEditComponent = useCallback(
    (column: MRT_ColumnDef<T, unknown>, rowData: T) => {
      if (!column.Edit) return null;
      const accessorKey = column.accessorKey as string;
      const EditWithReadOnly = (props: any) => {
        const originalElement = column.Edit!(props);
        if (!originalElement) return null;
        if (readOnly) {
          if (React.isValidElement(originalElement)) {
            // @ts-expect-error disabled
            return React.cloneElement(originalElement, { disabled: true });
          }
        }
        return originalElement;
      };

      const editProps: CustomEditProps<T> = {
        row: {
          original: rowData,
          _valuesCache: valuesCache,
        },
        cell: {
          getValue: () => rowData[accessorKey as keyof T],
        },
        table: {
          getState: () => ({
            creatingRow: false,
            editingRow: !readOnly,
          }),
        },
        column: {
          ...column,
          id: accessorKey,
        },
        onChange: (e: any) => {
          const newValue = e && e.target ? e.target.value : e;
          handleValueChange(accessorKey, newValue);
        },
        disabled: readOnly,
      };

      return <EditWithReadOnly {...editProps} />;
    },
    [valuesCache, readOnly, handleValueChange]
  );

  const renderSelectField = useCallback(
    (column: MRT_ColumnDef<T, unknown>, rowData: T) => {
      const accessorKey = column.accessorKey as string;
      const currentValue = rowData[accessorKey as keyof T] ?? '';

      const options =
        typeof column.editSelectOptions === 'function'
          ? column.editSelectOptions({
              cell: { getValue: () => rowData[accessorKey as keyof T] } as any,
              column: column as any,
              row: { original: rowData } as any,
              table: {} as any,
            })
          : column.editSelectOptions || [];

      return (
        <FormControl variant="standard" fullWidth disabled={readOnly}>
          <InputLabel id={`select-label-${accessorKey}`}>{column.header}</InputLabel>
          <Select
            labelId={`select-label-${accessorKey}`}
            value={currentValue}
            onChange={(e) => handleValueChange(accessorKey, e.target.value)}
            label={column.header}
            disabled={readOnly}
          >
            {options.map((option: any, index: number) => (
              <MenuItem key={index} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    },
    [readOnly, handleValueChange]
  );

  const handleNavigate = useCallback(() => {
    if (navigateURL) {
      window.open(navigateURL, '_blank');
    }
  }, [navigateURL]);

  const handleSubmit = useCallback(() => {
    if (handleAction && row) {
      handleAction(row);
    }
  }, [handleAction, row]);

  return (
    <Dialog open={true} onClose={handleClose} fullWidth>
      <DialogTitle variant="h5" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title}
        <IconButton onClick={handleClose} edge="end" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ padding: '24px', minHeight: '530px' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              color: 'error.main',
            }}
          >
            {error}
          </Box>
        ) : row ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem',
            }}
          >
            {columns.map((column, index) => (
              <Box key={`${column.accessorKey || index}`}>
                {column.Edit ? (
                  renderEditComponent(column, row)
                ) : column.editVariant === 'select' ? (
                  renderSelectField(column, row)
                ) : (
                  <Input
                    label={column.header}
                    value={row[column.accessorKey as keyof T] ?? ''}
                    variant="standard"
                    disabled={readOnly}
                    fullWidth
                    onChange={(e) => handleValueChange(column.accessorKey as string, e.target.value)}
                  />
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>No data available</Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="outlined" color="error">
          {readOnly ? 'Zatvori' : 'Odustani'}
        </Button>
        {navigateURL && (
          <Button endIcon={<ArrowForward />} onClick={handleNavigate} variant="contained" color="primary">
            Navigacija
          </Button>
        )}
        {!readOnly && row && (
          <Button variant="contained" color="primary" onClick={handleSubmit} disabled={isLoading}>
            Potvrdi
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
