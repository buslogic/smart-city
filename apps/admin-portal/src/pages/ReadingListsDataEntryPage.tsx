import { useEffect } from 'react';
import useReadingListsDataEntry from '@/hooks/useReadingListsDataEntry';
import { MaterialReactTable } from 'material-react-table';
import Main from '@/components/ui/Main';

export const ReadingListsDataEntryPage = ({ title }: { title: string }) => {
  const { renderDateSelector, renderModals, renderActionButtons, selectedData, table } = useReadingListsDataEntry();

  useEffect(() => {
    renderDateSelector();
  }, [renderDateSelector]);

  return (
    <Main title={title}>
      {renderDateSelector()}
      {renderActionButtons()}
      {renderModals()}
      {selectedData.length > 0 && <MaterialReactTable table={table} />}
    </Main>
  );
};

export default ReadingListsDataEntryPage;
