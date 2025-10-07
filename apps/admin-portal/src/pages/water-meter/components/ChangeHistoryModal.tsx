import { GenericTable } from '@/components/ui/GenericTable';
import { HistoryRow } from '@/types/water-meter';
import { Box, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { MRT_ColumnDef } from 'material-react-table';
import CloseIcon from '@mui/icons-material/Close';

const ChangeHistoryModal = ({
  columns,
  rowID,
  open,
  close,
}: {
  columns: MRT_ColumnDef<HistoryRow, unknown>[];
  rowID: number;
  open: boolean;
  close: () => void;
}) => {
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="lg">
      <DialogTitle variant="h5" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Istorija promena na vodomeru
        <IconButton onClick={close} edge="end" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box>
          <GenericTable<HistoryRow> fetchUrl="../WaterMeterController/getWaterMeterHistoryByIDV" fetchParams={{ idv: rowID }} columns={columns} />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeHistoryModal;
