export type Subsidy = {
  id: number;
  naziv: string;
  tip: string;
  procenat: number;
  iznos: number;
  datum_od?: string | null;
  datum_do?: string | null;
  limit: number;
  fiksni_deo: number;
  varijabilni_deo: number;
  status: string;
};

export type SubsidyAssignment = {
  id: number;
  naziv: string;
  limit: string;
  subvencija_id: number;
  korisnik_id: number;
  dodelio: string;
  datum_dodele: string;
  status: string;
};
