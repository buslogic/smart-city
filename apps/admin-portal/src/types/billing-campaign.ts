export type BillingCampaign = {
    id: number;
    id_popis: string;
    idmm: number;
    idv: string;
    pocetno_stanje: number;
    zavrsno_stanje: number;
    izmereno: number;
    z_pocetno_stanje: number;
    z_zavrsno_stanje: number;
    z_izmereno: number;
    z_vodomer: number;
    stanje_vodomera: number;
    stanje_vod_nap: number;
    procenat: string;
    napomena: string;
    nacin_upisa: string;
};

export type SubCampaign = {
    id: number;
    kampanja_id: number;
    kampanja?: string; // Format: "ID | YYYY-MM"
    dan: string;
    vreme_od: number;
    vreme_do: number;
    region_id: string; // Format: "ID | Name"
    citac_id: string; // Format: "ID | FirstName LastName"
    status_id: string; // Format: "ID | Name"
}

export type Campaign = {
    id: number;
    godina: number;
    mesec: number;
    sifra: string;
    status: number;
    datum_kreiranja: string;
    datum_zatvaranja: string;
}

export type ReadingLists = {
    id: number;
    pod_kampanja_id: number;
    ulica: number;
    status: number;
}

export type Readings = {
    id: number;
    pod_kampanja_id: number;
    idmm: number;
    idv: number;
    stavka_za_citanje_id: number;
    vreme: string;
    iznos: number;
    izvor_citanja: number
    geo_lat: number;
    geo_lon: number;
    napomena: string;
    status_id: number;
}