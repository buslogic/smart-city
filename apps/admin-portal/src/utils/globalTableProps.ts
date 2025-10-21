import { TableCellProps } from '@mui/material';
import { MRT_Cell, MRT_Column, MRT_Row, MRT_TableInstance } from 'material-react-table';
import { MRT_Localization_SR_LATN_RS } from 'material-react-table/locales/sr-Latn-RS';

export function muiTableBodyCellPropsRowEditStyles<TData extends Record<string, any>>({
  row,
  table,
}: {
  cell: MRT_Cell<TData, unknown>;
  column: MRT_Column<TData, unknown>;
  row: MRT_Row<TData>;
  table: MRT_TableInstance<TData>;
}): TableCellProps {
  const isEditing = table.getState().editingRow?.id === row.id;
  const isCreating = table.getState().creatingRow;
  return {
    align: 'center' as const,
    sx: {
      textAlign: 'center' as const,
      backgroundColor: isCreating || isEditing ? '#f0f8ff' : 'inherit',
      '& > div':
        isCreating || isEditing
          ? {
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
            }
          : undefined,
      '& input':
        isCreating || isEditing
          ? {
              outline: '1px solid red',
              fontSize: '0.875rem !important',
              textAlign: 'center',
            }
          : undefined,
    },
  };
}

export const globalTableProps = {
  localization: {
    ...MRT_Localization_SR_LATN_RS,
  },
  // density: 'compact' as const,
  initialState: {},
  enableColumnOrdering: false,
  muiTableContainerProps: {
    sx: {
      borderRadius: 3,
      boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(0,0,0,0.05)',
    },
  },
  muiTableHeadCellProps: {
    align: 'center' as const,
    sx: {
      textAlign: 'center',
      fontWeight: 700,
      backgroundColor: '#f8f8f8',
      color: '#2f2f2f',
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
      borderBottom: '2px solid rgba(224, 224, 224, 0.8)',
    },
  },
  muiTableBodyProps: {
    sx: {
      backgroundColor: '#ffffff',
    },
  },
  muiTableBodyCellProps: {
    align: 'center' as const,
    sx: {
      textAlign: 'center',
      padding: '14px 12px',
      transition: 'background-color 0.2s ease',
    },
  },
  muiTableBodyRowProps: {
    sx: {
      '&:hover': {
        cursor: 'pointer',
      },
    },
  },
  muiTableFooterCellProps: {
    sx: {
      color: '#444 !important',
      backgroundColor: '#f8f8f8 !important',
    },
  },
  positionActionsColumn: 'last' as const,
  autoResetPageIndex: false,

  // renderCreateRowDialogContent: ({ row, table, internalEditComponents }) => (
  //     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
  //       <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
  //         Upisivanje
  //       </DialogTitle>
  //       <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
  //       <DialogActions>
  //         <MRT_EditActionButtons variant="text" table={table} row={row} />
  //       </DialogActions>
  //     </Box>
  //   ),
  //   renderEditRowDialogContent: ({ table, internalEditComponents, row }) => (
  //     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
  //       <DialogTitle variant="h5" sx={{ textDecoration: 'underline' }}>
  //         Izmena (ID: {row.original.id})
  //       </DialogTitle>
  //       <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>{internalEditComponents}</DialogContent>
  //       <DialogActions>
  //         <MRT_EditActionButtons variant="text" table={table} row={row} />
  //       </DialogActions>
  //     </Box>
  //   ),

  // enableGlobalFilter: true,
  // globalFilterFn: 'cyrilic',
  // enableFilters: true,
  // filterFns: {
  //   cyrilic: cyrillicFilterFn,
  // },
  // muiTableBodyCellProps: ({ row, table }) => {
  //   const isEditing = table.getState().editingRow?.id === row.id;
  //   const isCreating = table.getState().creatingRow;
  //   return {
  //     align: 'center',
  //     sx: {
  //       textAlign: 'center',
  //       backgroundColor: isCreating || isEditing ? '#f0f8ff' : 'inherit',
  //     },
  //   };
  // },
  // muiTableBodyCellProps: ({ row, table }) => {
  //     const isEditing = table.getState().editingRow?.id === row.id;
  //     const isCreating = table.getState().creatingRow;
  //     return {
  //       align: 'center',
  //       sx: {
  //         textAlign: 'center',
  //         backgroundColor: isCreating || isEditing ? '#f0f8ff' : 'inherit',
  //         '& > div':
  //           isCreating || isEditing
  //             ? {
  //                 display: 'flex',
  //                 justifyContent: 'center',
  //                 alignItems: 'center',
  //                 width: '100%',
  //               }
  //             : undefined,
  //         '& input':
  //           isCreating || isEditing
  //             ? {
  //                 outline: '1px solid red',
  //                 fontSize: '0.875rem !important',
  //                 textAlign: 'center',
  //               }
  //             : undefined,
  //       },
  //     };
  //   },
  // muiTableBodyCellProps: ({ row, table }) => {
  //           const isEditing = table.getState().editingRow?.id === row.id;
  //           const isCreating = table.getState().creatingRow;
  //           return {
  //               align: 'center',
  //               sx: {
  //                   textAlign: 'center',
  //                   backgroundColor: isCreating || isEditing ? '#f0f8ff' : 'inherit',
  //                   '& > div':
  //                       isCreating || isEditing
  //                           ? {
  //                               display: 'flex',
  //                               justifyContent: 'center',
  //                               alignItems: 'center',
  //                               width: '100%',
  //                           }
  //                           : undefined,
  //                   '& input':
  //                       isCreating || isEditing
  //                           ? {
  //                               outline: '1px solid red',
  //                               fontSize: '0.875rem !important',
  //                               textAlign: 'center',
  //                           }
  //                           : undefined,
  //               },
  //           };
  //       },
};
