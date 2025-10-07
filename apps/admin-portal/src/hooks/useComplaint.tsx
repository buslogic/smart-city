import { Complaint } from '@/types/complaints';
import { fetchPostData } from '@/utils/fetchUtil';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

const CONTROLLER = '../ComplaintController';

export type PotrosacPDF = {
    naziv?: string;
    ulica_broj?: string;
    mesto?: string;
    jmbg?: string;
    sifra_potrosaca?: string;
    idmm?: string;
    broj_lk?: string;
    mesto_izdavanja_lk?: string;
    kontakt_telefon?: string;
    email?: string;
}

const useSubsidies = () => {
    const [complaints, setComplaint] = useState<Complaint[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [useComplaintID, SetComplaintID] = useState<PotrosacPDF | null>(null);

    const fetchActiveRows = async () => {
        try {
            setIsFetching(true);
            const data = await fetchPostData('../ComplaintController/getData', {});
            setIsFetching(false);
            setComplaint(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        }
    };

    const fetchInactiveRows = async () => {
        try {
            setIsFetching(true);
            const data = await fetchPostData('../ComplaintController/getInactiveData', {});
            setIsFetching(false);
            setComplaint(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        }
    };

    const createRow = useCallback(async (row: Complaint): Promise<void> => {
        setIsCreating(true);
        try {
            const res = await fetchPostData(CONTROLLER + '/addRow', row);

            if (!res.success) {
                throw new Error(res.error);
            }
            setComplaint((prev) => [res.data, ...prev]);
        } catch (error) {
            console.error('Error in createRow:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: Complaint) => {
        setIsUpdating(true);
        const res = await fetchPostData(CONTROLLER + '/editRow', row);
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        setComplaint((prev) => prev.map((x) => (x.id === row.id ? res.data : x)));
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        await fetchPostData(CONTROLLER + '/deleteRow', { id });
        setIsDeleting(false);
        setComplaint((state) => state.filter((x) => x.id !== id));
    }, []);

    const getPotrosacByID = async (complaintID: number | null): Promise<PotrosacPDF | null> => {
        try {
            if (!complaintID) return null;
            const data = await fetchPostData(CONTROLLER + '/getKorisnikByID', { id: complaintID });
            SetComplaintID(data)
            return data as PotrosacPDF;
        } catch (err) {
            console.error('Error fetching row by ID:', err);
            return null;
        }
    };

    const refreshRow = (row: Complaint) => {
        setComplaint((prev) => prev.map((x) => (x.id === row.id ? row : x)));
    };

    return {
        complaints,
        isCreating,
        isUpdating,
        isDeleting,
        isFetching,
        updateRow,
        createRow,
        deleteRow,
        fetchActiveRows,
        getPotrosacByID,
        useComplaintID,
        setComplaint,
        refreshRow,
        fetchInactiveRows
    };
};

export default useSubsidies;
