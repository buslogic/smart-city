export const LEGACY_DATABASE_SUBTYPES = {
  MAIN_TICKETING: 'main_ticketing_database',
  GPS_TICKETING: 'gps_ticketing_database', 
  GLOBAL_TICKETING: 'global_ticketing_database',
  CITY_TICKETING: 'city_ticketing_database',
} as const;

export const SUBTYPE_LABELS = {
  [LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING]: 'Glavna Ticketing Baza',
  [LEGACY_DATABASE_SUBTYPES.GPS_TICKETING]: 'GPS Ticketing Baza',
  [LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING]: 'Globalna Ticketing Baza', 
  [LEGACY_DATABASE_SUBTYPES.CITY_TICKETING]: 'Gradska Ticketing Baza',
};

export const SUBTYPE_DESCRIPTIONS = {
  [LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING]: 'Osnovna baza za ticketing sistem sa glavnim podacima',
  [LEGACY_DATABASE_SUBTYPES.GPS_TICKETING]: 'Baza sa GPS podacima vozila i ruta',
  [LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING]: 'Globalna baza sa ukupnim ticketing podacima',
  [LEGACY_DATABASE_SUBTYPES.CITY_TICKETING]: 'Gradska baza sa lokalnim ticketing informacijama',
};

export type LegacyDatabaseSubtype = typeof LEGACY_DATABASE_SUBTYPES[keyof typeof LEGACY_DATABASE_SUBTYPES];