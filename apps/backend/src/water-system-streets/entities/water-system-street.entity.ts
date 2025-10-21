export class WaterSystemStreet {
  id: number;
  city_id: number;
  address_name: string;
  address_number: string | null;
  official_address_code: string | null;
  region_id: number | null;
  active: number;
  edit_user_id: number | null;
  edit_datetime: Date | null;
  cities_name?: string;
  region_name?: string;
}
