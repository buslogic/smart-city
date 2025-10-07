import { Box, CircularProgress } from '@mui/material';

const LoadingFallback = () => {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" width="100%" bgcolor="white" height={80}>
      <CircularProgress />
    </Box>
  );
};

export default LoadingFallback;
