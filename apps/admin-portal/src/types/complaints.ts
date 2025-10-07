export type Complaint = {
    id: number;
    tip_id: number | null;
    kategorija_id: number | null;
    prioritet_id: number | null;
    status_id: string;
    opis: string | null;
    napomena: string | null;
    korisnik_id: number | null;
    idmm: number | null;
    faktura_id: number | null;
    obracun_id: number | null;
    odgovorno_lice_id: string | null;
    kreirano: string | null;
    kreirao_id: number | null;
    zatvoreno: string | null;
    izvrsilac_id: number | null;
};

export type StatusHistory = {
    id: number;
    reklamacija_id: number;
    status_id: string;
    napomena: string;
    datum_promene: string;
    user_id: number;
};