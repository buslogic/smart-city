import { useEffect } from "react";
import { MaterialReactTable, MRT_Row, MRT_TableOptions, useMaterialReactTable } from "material-react-table";
import { Box, Button, Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { WMAvailability } from "@/types/water-meter";
import useWMAvailabilities from "@/hooks/useWMAvailabilities";
import { toast } from "react-toastify";
import { globalTableProps, muiTableBodyCellPropsRowEditStyles } from "@/utils/globalTableProps";
import Main from "@/components/ui/Main";

export const WaterMeterAvailabilityPage = ({ title }: { title: string }) => {
  const {
    availabilities,
    fetchWMAvailabilities,
    createRow,
    deleteRow,
    updateRow,
    isDeleting,
    isCreating,
    isFetching,
    isUpdating,
    columns,
  } = useWMAvailabilities();

  useEffect(() => {
    fetchWMAvailabilities();
  }, []);

  const handleCreate: MRT_TableOptions<WMAvailability>["onCreatingRowSave"] = async ({ values, table }) => {
    try {
      await createRow(values);
      toast.success("Uspešno unošenje podataka");
      table.setCreatingRow(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate: MRT_TableOptions<WMAvailability>["onEditingRowSave"] = async ({ values, row, table }) => {
    try {
      values["id"] = row.original.id;
      await updateRow(values);
      table.setEditingRow(null);
      toast.success("Uspešna izmena podataka");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (row: MRT_Row<WMAvailability>) => {
    if (window.confirm("Da li potvrdjujete brisanje?")) {
      try {
        await deleteRow(row.original.id);
        toast.success("Uspešno brisanje podataka");
      } catch (err) {
        console.log(err);
        toast.error("Došlo je do greške");
      }
    }
  };

  const table = useMaterialReactTable({
    ...globalTableProps,
    columns,
    data: availabilities,
    createDisplayMode: "row",
    editDisplayMode: "row",
    muiTableBodyCellProps: muiTableBodyCellPropsRowEditStyles,
    enableEditing: true,
    getRowId: (row) => String(row.id),
    onCreatingRowSave: handleCreate,
    onEditingRowSave: handleUpdate,
    onEditingRowCancel: ({ table }) => table.setEditingRow(null),
    renderRowActions: ({ row, table }) => {
      return (
        <Box sx={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Tooltip title="Izmena">
            <Button
              sx={{ padding: "4px 6px", minWidth: "auto", width: "auto" }}
              size="small"
              variant="contained"
              color="primary"
              onClick={() => table.setEditingRow(row)}
            >
              <EditIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Brisanje">
            <Button
              sx={{ padding: "4px 6px", minWidth: "auto", width: "auto" }}
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleDelete(row)}
            >
              <DeleteIcon />
            </Button>
          </Tooltip>
        </Box>
      );
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={() => {
          table.setCreatingRow(true);
        }}
      >
        Dodaj
      </Button>
    ),
    state: {
      isLoading: isFetching,
      isSaving: isCreating || isUpdating || isDeleting,
      showProgressBars: isFetching,
    },
  });

  return (
    <Main title={title}>
      <Box sx={{ maxWidth: "720px", margin: "auto" }}>
        <MaterialReactTable table={table} />
      </Box>
    </Main>
  );
};

export default WaterMeterAvailabilityPage;
