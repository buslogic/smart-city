import { MRT_TableInstance } from 'material-react-table';

export const getHideColumnProps = ({ table }: { table: MRT_TableInstance<any> }) => {
  const isCreating = table.getState().creatingRow;
  const isEditing = table.getState().editingRow;
  if (isCreating || isEditing) return { sx: { display: 'none' } };
  return {};
};
