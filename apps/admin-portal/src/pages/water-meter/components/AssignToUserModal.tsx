import { useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-toastify';
import { SearchList } from '@/components/ui/SearchList';
import { fetchAPI } from '@/utils/fetchUtil';

const AssignWaterMeterToUserModal = ({ rowID, open, close }: { rowID: number; open: boolean; close: () => void }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userID, setUserID] = useState<number | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');

  async function fetchUserID() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3010';
    const response = await fetchAPI<{ success: boolean; data: any }>(`${apiUrl}/api/water-meters/assigned-user`, {
      method: 'POST',
      data: { id: rowID },
    });
    setUserID(response?.data?.id ?? 0);
  }

  useEffect(() => {
    if (rowID > 0 && userID === null) {
      fetchUserID();
    }
  }, [rowID, userID]);

  const handleSubmit = async () => {
    try {
      if (!selectedValue) {
        toast.error('Nije izabran korisnik');
        return;
      }

      const parts = selectedValue.split('|');
      if (parts.length === 0) {
        toast.error('Došlo je do greške');
        return;
      }

      let sifra_potrosaca = '';
      let sifra_kupca = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const kvParts = part.split(':');
        if (kvParts.length > 1) {
          const key = kvParts[0].trim();
          const value = kvParts[1].trim();

          if (key.toLowerCase().startsWith('potrošač')) {
            sifra_potrosaca = value.trim();
          }
          if (key.toLowerCase().startsWith('kupac')) {
            sifra_kupca = value.trim();
          }
        }
      }

      if (!sifra_potrosaca && !sifra_kupca) {
        toast.error('Došlo je do greške');
        return;
      }

      setIsSubmitting(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3010';
      const res = await fetchAPI<{ success: boolean }>(`${apiUrl}/api/water-meters/assign-to-user`, {
        method: 'POST',
        data: { id: rowID, sifra_potrosaca, sifra_kupca },
      });
      res.success ? toast.success('Uspešno dodeljivanje') : toast.error('Neuspešno dodeljivanje');
      setIsSubmitting(false);
      close();
    } catch (err) {
      toast.error('Došlo je do greške');
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth>
      <DialogTitle variant="h5" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Dodeljivanje vodomera korisniku
        <IconButton onClick={close} edge="end" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <SearchList
            label="Korisnik"
            value={selectedValue}
            endpoint={'/api/user-accounts/search/for-sl'}
            multiple={false}
            onChange={(newValue) => setSelectedValue(newValue)}
            fetchOnRender={typeof userID === 'number' && userID > 0}
            onFetch={(options) => {
              if (selectedValue === '') {
                const foundOption = options.find((x) => x.startsWith(`ID: ${userID}`));
                setSelectedValue(foundOption ?? '');
              }
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="primary" onClick={handleSubmit} disabled={isSubmitting} loading={isSubmitting}>
          Potvrdi
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignWaterMeterToUserModal;
