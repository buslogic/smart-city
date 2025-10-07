import { Box } from '@mui/material';
import PageTitle from './PageTitle';
import { ReactNode } from 'react';

const Main = ({ title, children }: { title?: string; children?: ReactNode }) => {
  return (
    <Box bgcolor="white" padding={2} position="relative">
      {title && <PageTitle title={title} />}
      {children}
    </Box>
  );
};

export default Main;
