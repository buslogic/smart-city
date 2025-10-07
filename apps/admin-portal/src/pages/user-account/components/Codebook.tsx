import Box from '@mui/material/Box';
import { SearchList } from '@/components/ui/SearchList';
import { Button, Checkbox, Divider, FormControl, FormControlLabel, FormGroup, Paper, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import useUserAccount from '@/hooks/useUserAccount';
import Collapse from '@mui/material/Collapse';
import { TransitionProps } from '@mui/material/transitions';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { useSpring, animated } from '@react-spring/web';

type customTreeViewBaseItem = TreeViewBaseItem & {
  Component?: React.ComponentType<any>;
};

const TREE_LIST: customTreeViewBaseItem[] = [
  { id: 'basic-data', label: 'Osnovni podaci', Component: BasicData },
  {
    id: 'customer',
    label: 'Kupac',
    children: [
      { id: 'finance-data', label: 'Finansijski podaci' },
      { id: 'contract-pricelist', label: 'Ugovoreni cenovnik' },
    ],
  },
  { id: 'bank', label: 'Banka' },
  { id: 'municipality', label: 'Opština' },
  { id: 'werehouse', label: 'Skladište' },
  { id: 'departmant', label: 'Odeljenje' },
  { id: 'notes', label: 'Napomena' },
];

export default function Codebook() {
  // const [selectedItems, setselectedItems] = useState<string[]>([]);
  const { getUserAccountByID } = useUserAccount();
  const [userData, setUserData] = useState<any | null>(null);
  const [lastClickedItem, setLastClickedItem] = useState<customTreeViewBaseItem>(TREE_LIST[0]);

  async function handleOnChange(newValue: string) {
    const parts = newValue.split('|');
    const id = parts[0].trim().split(':')[1].trim();
    const data = await getUserAccountByID(id);
    setUserData(data);
  }

  const handleItemClick = (_event: MouseEvent, itemId: string) => {
    const item = TREE_LIST.find((item) => item.id === itemId);
    if (item) setLastClickedItem(item);
  };

  return (
    <>
      <Box sx={{ width: '500px' }}>
        <SearchList
          label="Korisnik"
          endpoint={`../UserAccountController/getUserAccountsForSL`}
          multiple={false}
          onChange={handleOnChange}
          textFieldProps={{ variant: 'standard' }}
        />
      </Box>
      {userData && (
        <Paper elevation={2} sx={{ marginTop: '50px', height: '100%' }}>
          <Box display="flex">
            <RichTreeView
              // @ts-expect-error TODO: srediti tip
              onItemClick={handleItemClick}
              sx={{ minWidth: '250px' }}
              items={TREE_LIST}
              slotProps={{
                item: {
                  sx: {
                    '& > .MuiTreeItem-content': {
                      paddingY: '12px',
                      height: '100%',
                      borderBottom: '1px solid #E8E8E8',
                    },
                  },
                  slots: {
                    groupTransition: (props: TransitionProps) => {
                      const style = useSpring({
                        to: {
                          opacity: props.in ? 1 : 0,
                          transform: `translate3d(${props.in ? 0 : 20}px,0,0)`,
                        },
                      });
                      return (
                        <animated.div style={style}>
                          <Collapse {...props} />
                        </animated.div>
                      );
                    },
                  },
                },
              }}
            />
            {lastClickedItem && (
              <Box
                sx={{
                  padding: '12px',
                  width: '100%',
                  borderLeft: '1px solid #E8E8E8',
                }}
              >
                <Typography variant="h5">{lastClickedItem.label}</Typography>
                <Divider sx={{ my: '12px' }} />
                {lastClickedItem.Component && <lastClickedItem.Component userData={userData} />}
              </Box>
            )}
          </Box>
        </Paper>
      )}
    </>
  );
}

type CodebookChildrenProps = {
  userData: any;
};

type FormData = {
  name: string;
  delivery_address_name: string;
  pib: string;
  sajt: string;
  idmm: string;
  address_name: string;
  broj: string;
  ulaz: string;
  stan: string;
  longtitude: string;
  latitude: string;
  personal_number: string;
  crm_contacts_mobile_phone: string;
  active: boolean;
};

function BasicData({ userData }: CodebookChildrenProps) {
  useEffect(() => {
    setFormData(computeForm(userData));
  }, [userData]);

  function computeForm(userData: any): FormData {
    // @ts-ignore dkasodsa
    const { crm_contact, crm_account, delivery_address_id, delivery_address_name } = userData;
    const form = {
      name: crm_contact?.crm_contacts_first_name + ' ' + crm_contact?.crm_contacts_last_name,
      delivery_address_name: [delivery_address_id, delivery_address_name].filter(Boolean).join(' | '),
      pib: crm_contact?.consumer?.pib ?? '',
      sajt: crm_contact?.consumer?.sajt ?? '',
      idmm: crm_contact?.consumer?.idmm ?? '',
      address_name: crm_contact?.consumer?.mp_address_name ?? '',
      broj: crm_contact?.consumer?.mp_broj ?? '',
      ulaz: crm_contact?.consumer?.mp_ulaz ?? '',
      stan: crm_contact?.consumer?.mp_broj2 ?? '',
      longtitude: crm_contact?.consumer?.mp_longtitude ?? '',
      latitude: crm_contact?.consumer?.mp_latitude ?? '',
      personal_number: crm_contact?.personal_number ?? '',
      crm_contacts_mobile_phone: crm_contact?.crm_contacts_mobile_phone ?? '',
      active: crm_contact?.active ?? false,
    };
    return form;
  }

  const [formData, setFormData] = useState<FormData | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
    });
  };

  const inputProps = {
    variant: 'standard' as const,
    margin: 'normal' as const,
    onChange: handleChange,
    // slotProps: {
    //   input: { sx: { paddingLeft: '12px' } },
    // },
  };

  const handleSubmit = () => {};

  if (!formData) return <div></div>;

  return (
    <Box sx={{ width: '100%', py: '12px' }}>
      <FormControl component="fieldset" fullWidth>
        <FormGroup>
          <TextField {...inputProps} label="Ime" name="name" value={formData.name} />
          <TextField {...inputProps} label="Adresa dostave računa" name="delivery_address_name" value={formData.delivery_address_name} />
          <Box display="flex" gap={2}>
            <TextField {...inputProps} label="Telefon" name="crm_contacts_mobile_phone" value={formData.crm_contacts_mobile_phone} fullWidth={true} />
            <TextField {...inputProps} label="Pib" name="pib" value={formData.pib} fullWidth={true} />
            <TextField {...inputProps} label="URL" name="sajt" value={formData.sajt} fullWidth={true} />
          </Box>
          <TextField {...inputProps} label="Adresa" name="address_name" value={formData.address_name} />

          <Box display="flex" gap={2} width={200}>
            <TextField
              {...inputProps}
              type="number"
              label="Broj"
              name="broj"
              value={formData.broj}
              slotProps={{ input: { sx: { textAlign: 'center' } } }}
            />
            <TextField
              {...inputProps}
              type="number"
              label="Ulaz"
              name="ulaz"
              value={formData.ulaz}
              slotProps={{ input: { sx: { textAlign: 'center' } } }}
            />
            <TextField
              {...inputProps}
              type="number"
              label="Stan"
              name="stan"
              value={formData.stan}
              slotProps={{ input: { sx: { textAlign: 'center' } } }}
            />
          </Box>

          <TextField {...inputProps} label="Maticni broj" name="personal_number" value={formData.personal_number} />
          <TextField {...inputProps} label="Merno mesto" name="idmm" value={formData.idmm} />

          <Box display="flex" gap={2}>
            <TextField {...inputProps} label="Geografska širina" name="idmm" value={formData.latitude} fullWidth={true} />
            <TextField {...inputProps} label="Geografska dužinа" name="idmm" value={formData.longtitude} fullWidth={true} />
          </Box>

          <Box display="flex" gap={2} justifyContent="flex-end">
            <FormControlLabel control={<Checkbox name="active" checked={formData.active} />} label="Aktivan" disabled />
            <FormControlLabel control={<Checkbox name="active" checked={true} />} label="Fizicka osoba" disabled />
          </Box>

          <Button variant="contained" color="primary" onClick={handleSubmit} sx={{ mt: 2 }}>
            Sačuvaj
          </Button>
        </FormGroup>
      </FormControl>
    </Box>
  );
}
