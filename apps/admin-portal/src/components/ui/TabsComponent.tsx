import { Box, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

type TabPanelProps = {
  children?: React.ReactNode;
  index: number;
  value: number;
};

export type CustomTab = Array<{ Component: React.ElementType } & React.ComponentProps<typeof Tab>>;

type TabsProps = {
  tabs: CustomTab;
  boxProps?: React.ComponentProps<typeof Box>;
};

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

const TabsComponent = ({ tabs, boxProps }: TabsProps) => {
  const [value, setValue] = useState<number>(0);

  const handleChange = (_: any, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box {...boxProps}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="tabs component">
          {tabs.map(({ Component, ...tabProps }, id) => (
            <Tab key={id} {...tabProps} {...a11yProps(id)} sx={{ minHeight: 'unset !important' }} />
          ))}
        </Tabs>
      </Box>
      {tabs.map(({ Component }, id) => (
        <TabPanel key={id} value={value} index={id}>
          <Component />
        </TabPanel>
      ))}
    </Box>
  );
};

export default TabsComponent;
