import { fetchPostData } from '@/utils/fetchUtil';
import { Autocomplete, Box, CircularProgress, TextField, TextFieldProps } from '@mui/material';
import { useEffect, useState } from 'react';

type common = {
  endpoint: string;
  label: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | undefined>;
  onFocus?: () => void;
  onBlur?: () => void;
  textFieldProps?: TextFieldProps;
  filterValues?: string[];
  allOptionsFilteredComponent?: React.ReactElement;
  fetchOnRender?: boolean;
  onFetch?: (options: string[]) => void;
  stateLoading?: boolean;
};

type SearchListProps =
  | (common & {
      multiple: true;
      value?: string[];
      onChange?: (value: string[]) => void;
    })
  | (common & {
      multiple: false;
      value?: string;
      onChange?: (value: string) => void;
    });

export const SearchList = ({
  value,
  endpoint,
  label,
  onChange,
  onFocus,
  onBlur,
  disabled,
  inputRef,
  multiple = false,
  textFieldProps,
  filterValues,
  allOptionsFilteredComponent,
  fetchOnRender = false,
  onFetch,
  stateLoading = false,
}: SearchListProps) => {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(stateLoading);
  const [hasMore, setHasMore] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [, setPage] = useState(0);

  const [inputValue, setInputValue] = useState('');
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);
  const [allOptionsFiltered, setAllOptionsFiltered] = useState<boolean>(false);

  useEffect(() => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      setSelectedValue(value);
      return;
    }
    if (multiple) setMultiSelectValues(value);
  }, [value]);

  const fetchData = async (searchQuery: string, pageNumber: number): Promise<{ data: string[]; hasMore: boolean } | null> => {
    try {
      setLoading(true);
      const body = { query: searchQuery, pageNumber: pageNumber };
      const res = await fetchPostData(endpoint, body);
      return res;
    } catch (error) {
      console.error('Error fetching data:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!loading && hasMore) {
      setLoading(true);
      setPage((prevPage) => {
        const nextPage = prevPage + 1;

        fetchData(inputValue, nextPage).then((res) => {
          if (!res) return;
          const { data, hasMore } = res;
          setHasMore(hasMore);
          setOptions((prevOptions) => [...prevOptions, ...data]);
          setLoading(false);
        });

        return nextPage;
      });
    }
  };

  useEffect(() => {
    if (onFetch) onFetch(options);
  }, [options]);

  useEffect(() => {
    if (disabled || (!isFocused && !fetchOnRender)) return;

    const loadInitialData = async () => {
      setPage(0);
      const res = await fetchData(inputValue, 0);
      if (!res) return;
      let { data, hasMore } = res;

      if (filterValues && filterValues.length > 0) {
        const filtered = data.filter((x) => !filterValues.some((val) => x.startsWith(val)));
        if (filtered.length === 0) {
          setAllOptionsFiltered(true);
        }
        data = filtered;
      }

      setOptions(data);
      setHasMore(hasMore);
    };

    const timeoutId = setTimeout(() => {
      loadInitialData();
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [fetchOnRender, inputValue, disabled, isFocused, filterValues]);

  const handleScroll = (event: any) => {
    const listbox = event.target;
    if (listbox.scrollHeight - listbox.scrollTop <= listbox.clientHeight + 50 && !loading) {
      loadMore();
    }
  };

  const safeUpdateValue = (newValue: string | string[] | null) => {
    if (!newValue) return;

    if (typeof newValue === 'string') {
      setSelectedValue(newValue);
    } else {
      setMultiSelectValues(newValue);
      setSelectedValue('');
    }

    if (onChange) {
      onChange(newValue as string & string[]);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Autocomplete
        fullWidth={true}
        onFocus={() => {
          setIsFocused(true);
          if (onFocus) onFocus();
        }}
        onBlur={() => {
          setIsFocused(false);
          if (onBlur) onBlur();
        }}
        options={options}
        getOptionLabel={(option) => option || ''}
        loading={loading}
        disabled={disabled}
        filterOptions={(options) => options}
        inputValue={inputValue}
        onInputChange={(_, newValue, reason) => {
          setInputValue(newValue);
          if (reason === 'clear') {
            setIsFocused(true);
          }
        }}
        onChange={(_, newValue) => {
          safeUpdateValue(newValue);
        }}
        value={multiple ? multiSelectValues : selectedValue}
        multiple={multiple}
        open={isFocused}
        onOpen={() => setIsFocused(true)}
        onClose={() => setIsFocused(false)}
        slotProps={{
          listbox: {
            onScroll: handleScroll,
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            sx={{
              '& .MuiInputBase-root': {
                height: multiple ? '100%' : 46,
              },
              '& .MuiInputLabel-root': {
                top: 0,
              },
            }}
            {...textFieldProps}
            inputRef={inputRef}
            label={label}
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading && <CircularProgress color="inherit" size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {allOptionsFiltered && allOptionsFilteredComponent}
    </Box>
  );
};
