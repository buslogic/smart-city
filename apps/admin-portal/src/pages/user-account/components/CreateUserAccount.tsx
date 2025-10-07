import { SearchList } from '@/components/ui/SearchList';
import { WaterService } from '@/types/finance';
import { fetchPostData } from '@/utils/fetchUtil';
import { Box, Button, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

const CreateUserAccount = () => {
  const [defaultServices, setDefaultServices] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const emptyFormData = {
    crm_account_id: '',
    crm_contact_id: '',
    delivery_address_id: '',
    pricelist_ids: [],
  };

  const [formData, setFormData] = useState<{
    crm_account_id: string;
    crm_contact_id: string;
    delivery_address_id: string;
    pricelist_ids: string[];
  }>(emptyFormData);

  async function fetchDefaultServices() {
    try {
      const data = await fetchPostData('../WaterServicesPricelistController/getDefaultServicesForAssignment');
      const services = data.map((x: WaterService) => `${x.id} | ${x.category} | ${x.service}`);
      setDefaultServices(services);
      setFormData((f) => ({ ...f, pricelist_ids: services }));
    } catch (err) {
      console.log(err);
    }
  }

  useEffect(() => {
    fetchDefaultServices();
  }, []);

  function isFormValid() {
    if (!formData) return;

    const { crm_account_id, crm_contact_id, delivery_address_id } = formData;
    if (crm_account_id && crm_contact_id) {
      toast.error('Došlo je do greške. Korisnik ne može biti pravno i fizičko lice!');
      return false;
    }

    const cond = delivery_address_id != '' && (crm_account_id != '' || crm_contact_id != '');
    if (!cond) {
      toast.error('Nisu uneta obavezna polja');
    }

    return cond;
  }

  async function handleFormSubmit(e: any) {
    try {
      e.preventDefault();

      setTouched(true);
      if (!isFormValid()) {
        return;
      }
      setTouched(false);

      const parsed = extractIDs();
      const { success, message } = await fetchPostData('../UserAccountController/addRow', parsed);
      setFormData(emptyFormData);

      if (success) {
        toast.success('Uspešno upisivanje podataka');
      } else {
        toast.error(message ?? 'Došlo je do greške');
      }
    } catch (err) {
      console.log(err);
      toast.error('Došlo je do greške');
    }
  }

  function extractIDs() {
    const result: Record<string, string | string[]> = {};

    for (const [k, v] of Object.entries(formData)) {
      if (typeof v === 'string' && v.includes('|')) {
        const parts = v.split('|');
        const idParts = parts[0].split(':');

        if (idParts.length > 1) {
          result[k] = idParts[1].trim();
        } else {
          result[k] = parts[0].trim();
        }
      } else if (Array.isArray(v)) {
        const ids = v
          .map((arrValue) => {
            const parts = arrValue.split('|');
            return parts[0].trim();
          })
          .filter(Boolean);

        if (ids.length > 0) {
          result[k] = ids;
        }
      }
    }
    return result;
  }

  return (
    <Box component="form" noValidate autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Box display="flex" gap={4}>
          <SearchList
            label="* Pravno lice"
            endpoint={`../UserAccountController/getUnusedCrmAccountsForSL`}
            multiple={false}
            value={formData.crm_account_id}
            onChange={(newValue) => {
              setFormData((form) => ({ ...form, crm_account_id: newValue, crm_contact_id: '' }));
            }}
          />
          <SearchList
            label="* Fizičko lice"
            endpoint={`../UserAccountController/getUnusedCrmContactsForSL`}
            multiple={false}
            value={formData.crm_contact_id}
            onChange={(newValue) => {
              setFormData((form) => ({ ...form, crm_contact_id: newValue, crm_account_id: '' }));
            }}
          />
        </Box>
        {touched && !formData.crm_contact_id && !formData.crm_account_id && (
          <Typography color="error" variant="body2">
            Morate uneti pravno ili fizičko lice.
          </Typography>
        )}
      </Box>

      <Box display="flex" gap={4} flexDirection="column">
        <Box>
          <SearchList
            label="* Adresa dostave računa"
            endpoint="../WaterSystemStreetsController/getAddressesForSL"
            multiple={false}
            onChange={(newValue) => {
              setFormData((f) => ({ ...f, delivery_address_id: newValue }));
            }}
          />
          {touched && !formData.delivery_address_id && (
            <Typography color="error" variant="body2">
              Morate uneti adresu dostave računa
            </Typography>
          )}
        </Box>
        <SearchList
          label="Usluga"
          endpoint="../WaterServicesPricelistController/getPricelistServicesForSL"
          value={defaultServices}
          multiple={true}
          onChange={(newValue) => {
            setFormData((f) => ({ ...f, pricelist_ids: newValue }));
          }}
        />
      </Box>
      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Button type="submit" variant="contained" onClick={handleFormSubmit}>
          Sačuvaj
        </Button>
      </Box>
    </Box>
  );
};

export default CreateUserAccount;
