import { Box, Divider, Typography } from '@mui/material';

const PageTitle = ({ title, color }: { title: string; color?: string }) => {
  const highlightColor = color || 'Highlight';
  return (
    <Box>
      <Typography variant="h5" style={{ color: highlightColor }} gutterBottom>
        {title}
      </Typography>
      <Divider style={{ margin: '16px 0', borderBottom: '2px solid ' + highlightColor }} />
    </Box>
  );
};

export default PageTitle;
