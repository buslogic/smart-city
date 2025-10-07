// import { fetchPostData } from '@/utils/fetchUtil';
// import { MRT_ColumnDef } from 'material-react-table';
// import { useCallback, useMemo, useState } from 'react';

// const CONTROLLER = '../ConsumersController';

// export type Consumer = {
//   naziv_potrosaca: string;
//   sifra_potrosaca: number;
//   napomena: string;
//   telefon: string;
//   zaposlen_kod: string;
//   pib: string;
//   pib_izvor: string;
//   jmbg: string;
//   jmbg_izvor: string;
//   ime_roditelja: string;
//   sms_obavestenja: boolean;
//   datum_rodjenja: string;
//   mesto_rodjenja: string;
//   adresa_boravista_p: string;
//   email: string;
//   sajt: string;
//   mobilni: string;
//   faks: string;
//   subvencija_metod_id: string;
// };

// const useConsumers = () => {
//   const [data, setData] = useState<Consumer[]>([]);
//   const [isFetching, setIsFetching] = useState(true);
//   const [isCreating, setIsCreating] = useState(false);
//   const [isUpdating, setIsUpdating] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);

//   const fetchData = useCallback(async () => {
//     try {
//       setIsFetching(true);
//       const data = await fetchPostData(CONTROLLER + '/getRows');
//       console.log(data);
//       setIsFetching(false);
//       setData(data);
//     } catch (err) {
//       console.log(err);
//     }
//   }, []);

//   const createRow = useCallback(async (row: Consumer): Promise<void> => {
//     setIsCreating(true);
//     const res = await fetchPostData(CONTROLLER + '/addRow', row);
//     setIsCreating(false);
//     if (!res.success) {
//       throw new Error('Neuspešan unos podataka');
//     }
//     setData((prev) => [res.data, ...prev]);
//   }, []);

//   const updateRow = useCallback(async (row: Consumer) => {
//     setIsUpdating(true);
//     const res = await fetchPostData(CONTROLLER + '/editRow', row);
//     setIsUpdating(false);
//     if (!res.success) {
//       throw new Error(res.error);
//     }
//     setData((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
//   }, []);

//   const deleteRow = useCallback(async (id: number) => {
//     setIsDeleting(true);
//     await fetchPostData(CONTROLLER + '/deleteRow', { id });
//     setIsDeleting(false);
//     setData((state) => state.filter((x) => x.id !== id));
//   }, []);

//   const columns = useMemo<MRT_ColumnDef<Consumer>[]>(
//     () => [
//       {
//         accessorKey: 'sifra_potrosaca',
//         header: 'Šifra potrosača',
//         size: 100,
//         // enableEditing: false,
//         // Edit: () => {
//         //   return <></>;
//         // },
//       },
//       {
//         accessorKey: 'naziv_potrosaca',
//         header: 'Naziv potrosača',
//         size: 100,
//       },
//       {
//         accessorKey: 'ulica_naselje',
//         header: 'Ulica - Naselje',
//         size: 100,
//       },
//       {
//         accessorKey: 'kupac',
//         header: 'Kupac',
//         size: 250,
//       },
//     ],
//     []
//   );

//   return {
//     data,
//     fetchData,
//     isFetching,
//     isCreating,
//     isUpdating,
//     isDeleting,
//     updateRow,
//     createRow,
//     deleteRow,
//     columns,
//   };
// };

// export default useConsumers;
