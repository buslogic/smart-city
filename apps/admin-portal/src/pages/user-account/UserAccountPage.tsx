import Main from '@/components/ui/Main';
import TabsComponent, { CustomTab } from '@/components/ui/TabsComponent';
import AddIcon from '@mui/icons-material/Add';
import CreateUserAccount from './components/CreateUserAccount';
import Codebook from './components/Codebook';

// @ts-expect-error not used
export default function UserAccountPage({ title }: { title: string }) {
  const tabs: CustomTab = [
    { label: 'Šifarnik', Component: Codebook },
    { label: 'Novi korisnik', iconPosition: 'start', icon: <AddIcon />, Component: CreateUserAccount },
  ];

  return (
    <Main>
      <TabsComponent boxProps={{ sx: { width: '100%' } }} tabs={tabs} />
    </Main>
  );
}
