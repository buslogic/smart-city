export type CashRegister = {
    id: number;
    naziv: string;
    adresa_id: number;
    fiscal_device_id: number;
    aktivan: number;
}

export type FiscalDevice = {
    id: number;
    naziv: string;
    model: string;
    krajnja_tacka: string;
    poslednja_sinhronizacija: string;
    status: number;
};

export type CashRegisterReport = {
    blagajna: string;
    blagajnik: string;
    datum: string;
    broj_transakcija: number;
    ukupan_promet: number;
    promet_gotovina: number;
    promet_kartica: number;
    promet_cek: number;
    promet_vaucer: number;
}

export type PaymentsByPaymentMethod = {
    id: number;
    blagajna: string;
    blagajnik: string;
    naziv: string;
    tip_placanja: string;
    datum: string;
    ukupno: number;
};

export type Payments = {
    id: number;
    id_smene: number;
    id_kupca: number;
    id_potrošača: number;
    id_fakture: number;
    iznos_ukupno: number;
    iznos_gotovina: number;
    iznos_kartica: number;
    iznos_cek: number;
    iznos_vaucer: number;
    valuta: string;
    datum_kreiranja: string;
    status: string;
    broj_fiskalnog_racuna: string;
    pos_referenca: string;
    ip_adresa: string;
    kreirao_id: number;
    kasa_id: number;
    nacin_placanja_id: number;
};