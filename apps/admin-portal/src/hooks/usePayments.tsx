import { Payments } from '@/types/cashRegister';
import { fetchAPI } from '@/utils/fetchUtil';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

const CONTROLLER = '/api/payments';

const useSubsidies = () => {
    const [payments, setPayments] = useState<Payments[]>([]);
    const [inactivePayments, setInactivePayments] = useState<Payments[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchRows = async (id: number) => {
        try {
            setIsFetching(true);
            const data = await fetchAPI('/api/payments/get-payment-data', {
                method: 'POST',
                data: {
                    payer_id: id,
                },
            });
            setIsFetching(false);
            setPayments(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        }
    };

    const fetchInactiveRows = async (id: number) => {
        try {
            setIsFetching(true);
            const data = await fetchAPI('/api/payments/get-inactive-payment-data', {
                method: 'POST',
                data: {
                    payer_id: id,
                },
            });
            setIsFetching(false);
            setInactivePayments(data);
        } catch (err) {
            toast.error('Došlo je do greške');
            console.log(err);
        }
    };

    const createRow = useCallback(async (row: Payments): Promise<void> => {
        setIsCreating(true);
        try {
            const res = await fetchAPI(CONTROLLER + '/add-row', {
                method: 'POST',
                data: row,
            });

            if (!res.success) {
                throw new Error(res.error);
            }

            const statusName = res.data.status.split(" | ")[0];

            if (statusName === '1') {
                setPayments((prev) => [res.data, ...prev]);
            } else {
                setInactivePayments((prev) => [res.data, ...prev]);
            }
        } catch (error) {
            console.error('Error in createRow:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, []);

    const updateRow = useCallback(async (row: Payments) => {
        setIsUpdating(true);
        const res = await fetchAPI(CONTROLLER + '/edit-row', {
            method: 'POST',
            data: row,
        });
        setIsUpdating(false);
        if (!res.success) {
            throw new Error(res.error);
        }
        const statusName = res.data.status.split(" | ")[0];

        if (statusName === '1') {
            setInactivePayments((prev) => prev.filter((x) => x.id !== row.id));
            setPayments((prev) => {
                const exists = prev.find((x) => x.id === row.id);
                if (exists) {
                    return prev.map((x) => (x.id === row.id ? res.data : x));
                }
                return [...prev, res.data];
            });
        } else if (statusName === '2') {
            setPayments((prev) => prev.filter((x) => x.id !== row.id));
            setInactivePayments((prev) => {
                const exists = prev.find((x) => x.id === row.id);
                if (exists) {
                    return prev.map((x) => (x.id === row.id ? res.data : x));
                }
                return [...prev, res.data];
            });
        }
    }, []);

    const deleteRow = useCallback(async (id: number) => {
        setIsDeleting(true);
        try {
            const res = await fetchAPI(CONTROLLER + '/delete-row', {
                method: 'POST',
                data: { id },
            });

            if (!res.success) {
                throw new Error(res.error || 'Greška pri brisanju');
            }

            const deletedPayment = payments.find((x) => x.id === id);
            if (!deletedPayment) {
                console.warn('Deleted payment not found in active payments', id);
                return;
            }

            deletedPayment.status = '2 | Neaktivan';

            setPayments((state) => state.filter((x) => x.id !== id));

            setInactivePayments((state) => [deletedPayment, ...state]);

        } catch (error) {
            console.error('Error deleting row:', error);
            toast.error('Došlo je do greške pri brisanju');
        } finally {
            setIsDeleting(false);
        }
    }, [payments]);


    return {
        payments,
        isCreating,
        isUpdating,
        isDeleting,
        isFetching,
        updateRow,
        createRow,
        deleteRow,
        fetchRows,
        fetchInactiveRows,
        inactivePayments
    };
};

export default useSubsidies;
