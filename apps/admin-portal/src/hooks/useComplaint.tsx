import { Complaint } from '@/types/complaints';
import { fetchAPI } from '@/utils/fetchUtil';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

const API_ENDPOINT = '/api/complaints';

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

const useComplaint = () => {
    const [complaints, setComplaint] = useState<Complaint[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [useComplaintID, SetComplaintID] = useState<PotrosacPDF | null>(null);

    const fetchActiveRows = async () => {
        try {
            setIsFetching(true);
            const data = await fetchAPI<Complaint[]>(API_ENDPOINT, {
                method: 'GET',
            });
            setComplaint(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        } finally {
            setIsFetching(false);
        }
    };

    const fetchInactiveRows = async () => {
        try {
            setIsFetching(true);
            const data = await fetchAPI<Complaint[]>(`${API_ENDPOINT}/inactive`, {
                method: 'GET',
            });
            setComplaint(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        } finally {
            setIsFetching(false);
        }
    };

    const createRow = useCallback(async (row: Complaint): Promise<void> => {
        setIsCreating(true);
        try {
            const newRow = await fetchAPI<Complaint>(API_ENDPOINT, {
                method: 'POST',
                data: row,
            });
            setComplaint((prev) => [newRow, ...prev]);
        } catch (error) {
            console.error('Error in createRow:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: Complaint) => {
        setIsUpdating(true);
        try {
            const { id, ...updateData } = row;
            const updatedRow = await fetchAPI<Complaint>(`${API_ENDPOINT}/${id}`, {
                method: 'PATCH',
                data: updateData,
            });
            setComplaint((prev) => prev.map((x) => (x.id === id ? updatedRow : x)));
        } catch (error) {
            console.error('Error in updateRow:', error);
            throw error;
        } finally {
            setIsUpdating(false);
        }
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        try {
            await fetchAPI(`${API_ENDPOINT}/${id}`, {
                method: 'DELETE',
            });
            setComplaint((state) => state.filter((x) => x.id !== id));
        } catch (error) {
            console.error('Error in deleteRow:', error);
            throw error;
        } finally {
            setIsDeleting(false);
        }
    }, []);

    const getPotrosacByID = async (complaintID: number | null): Promise<PotrosacPDF | null> => {
        try {
            if (!complaintID) return null;
            const data = await fetchAPI<PotrosacPDF>(`${API_ENDPOINT}/${complaintID}/korisnik`, {
                method: 'GET',
            });
            SetComplaintID(data);
            return data;
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

export default useComplaint;
