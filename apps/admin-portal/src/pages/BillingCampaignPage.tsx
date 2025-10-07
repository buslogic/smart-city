import { Alert } from '@mui/material';
import { FormModal } from '@/components/ui/FormModal';
import useBillingCampaign from '@/hooks/useBillingCampaign';
import Main from '@/components/ui/Main';

export const BillingCampaignPage = ({ title }: { title: string }) => {
  const { renderDataTable, columns, renderAddModal, renderDateSelector, formModalIDV, setformModalIDV, warningMessage } = useBillingCampaign();

  return (
    <Main title={title}>
      {renderDateSelector()}
      {warningMessage && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {warningMessage}
        </Alert>
      )}
      {renderDataTable()}
      {!!formModalIDV && (
        <FormModal
          url="../MeasuringPointsController/getWaterMeterByID"
          dataBody={{ idv: formModalIDV }}
          title="Čitačke liste"
          columns={columns}
          handleAction={(row) => {
            console.log('FINLAL ROW: ', row);
          }}
          handleClose={() => {
            setformModalIDV('');
          }}
          navigateURL={`/MeasuringPointsController/?edit=${formModalIDV}`}
          readOnly
        />
      )}
      {renderAddModal()}
    </Main>
  );
};

export default BillingCampaignPage;
