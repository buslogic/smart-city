export type WaterService = {
  id: number;
  category: string;
  service: string;
  note: string;
  code: string;
};

export type WaterServicesPricelist = {
  id: number;
  service_id: number;
  price: number;
  usage_fee_from: number;
  usage_fee_to: number;
  VAT_rate: number;
  fixed_charge: boolean;
  date_from: string | null;
  date_to: string | null;
  document_name: string | null;
  document_file: File | null;
};

export type WaterServicesPricelistHistory = {
  id: number;
  category_name: string;
  service_name: string;
  price: number;
  usage_fee_from: number;
  usage_fee_to: number;
  VAT_rate: number;
  fixed_charge: boolean;
  date_from: string | null;
  date_to: string | null;
  assign_by_default: boolean;
  created_at: string;
};

export type ReadingListsDataEntry = {
  id: number;
  city_id: number;
  address_id: number;
  service_name: string;
  fixed_charge: boolean;
  price: number;
  usage_fee_from: number;
  usage_fee_to: number;
  VAT_rate: number;
};

export type ReadingListsDataEntryShow = {
  id: number;
  idmm: number;
  broj_ulaz_stan: string;
  KS: number;
  broj_clanova_ks: number;
  broj_potrosaca_ks: number;
  sifra_potrosaca: string;
  potrosac: string;
  primarno_mm: string;
  idmm_idv: string;
  pocetno_stanje: number;
  zavrsno_stanje: number;
  napomena: string;
  idv: string;
};
