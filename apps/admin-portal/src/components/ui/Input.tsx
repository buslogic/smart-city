import { latinOnlyRegex } from '@/utils/utils';
import { TextField, TextFieldProps } from '@mui/material';
import React, { useState } from 'react';

const Input = (props: TextFieldProps) => {
  const [value, setValue] = useState('');

  function handleOnChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    const input = e.target.value;
    const v = input.replace(latinOnlyRegex, '');
    setValue(v);
    if (props.onChange) {
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: v,
        },
      };
      props.onChange(newEvent as React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>);
    }
  }

  return <TextField {...props} value={value} onChange={handleOnChange} />;
};

export default Input;
