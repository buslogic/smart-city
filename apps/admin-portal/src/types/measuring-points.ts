export type MeasuringPoints = {
  IDMM: number;
  IDU?: number;
  zoneId?: number;
  streetId?: number;
  houseNumber?: string;
  typeId?: number;
  status?: number;
  aktivan?: boolean;
  createdAt?: string;
  updatedAt?: string;
  tip?: string; // CONCAT(Id, ' | ', tip)
  kucniSavet?: string; // CONCAT(id, ' | ', address_name)
  mpsStatus?: string; // CONCAT(id, ' | ', status)
  IDV?: string; // idv iz vodovod_water_meter
  adresa?: string; // CONCAT(id, ' | ', address_name)
  naselje?: string; // CONCAT(id, ' | ', cities_name)
  brojClanovaKs?: number;
  brojPotrosacaKs?: number;
};
