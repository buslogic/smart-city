import { latinOnlyRegex } from '@/utils/utils';
import { TextField, TextFieldProps } from '@mui/material';
import React from 'react';

const Input = (props: TextFieldProps) => {
  function handleOnChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    const input = e.target.value;
    const v = input.replace(latinOnlyRegex, '');
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

  return <TextField {...props} onChange={handleOnChange} />;
};

export default Input;
