/**
 * Custom hook za upravljanje filterima vozača
 */

import { useState, useMemo } from 'react';
import { timeOverlapFilter, type Driver, type RequestedShift, type FilterResult } from '../filters/timeOverlapFilter';

export interface Filter {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  checkFn: (driver: Driver, requestedShift: RequestedShift) => FilterResult;
}

export interface FailedFilter {
  filterName: string;
  reason: string;
}

export interface DriverWithStatus extends Driver {
  status: 'free' | 'busy';
  failedFilters?: FailedFilter[];
}

export interface FilteredDrivers {
  free: DriverWithStatus[];
  busy: DriverWithStatus[];
}

/**
 * Custom hook za upravljanje filterima vozača
 * @param drivers - Lista vozača sa isplaniranim smenama
 * @param requestedShift - Tražena smena koja se planira
 * @returns Filteri, funkcija za toggle, i filtrirani vozači
 */
export function useDriverFilters(
  drivers: Driver[],
  requestedShift: RequestedShift | null
) {
  // Inicijalni filteri - prvo samo timeOverlap filter
  const [filters, setFilters] = useState<Filter[]>([
    {
      id: 'time-overlap',
      name: 'Preklapanje vremena',
      description:
        'Proverava da li se vreme turnusa preklapa sa već isplaniranim smenama vozača za taj dan',
      enabled: true, // Automatski uključen
      checkFn: timeOverlapFilter,
    },
    // Ovde će se dodavati novi filteri u budućnosti
  ]);

  /**
   * Toggle filter (uključi/isključi)
   */
  const toggleFilter = (filterId: string) => {
    setFilters((prevFilters) =>
      prevFilters.map((filter) =>
        filter.id === filterId
          ? { ...filter, enabled: !filter.enabled }
          : filter
      )
    );
  };

  /**
   * Primeni filtere na listu vozača i podeli ih na slobodne/zauzete
   */
  const filteredDrivers: FilteredDrivers = useMemo(() => {
    // Ako nema requestedShift podataka, vrati sve kao slobodne
    if (!requestedShift) {
      return {
        free: drivers.map((d) => ({ ...d, status: 'free' as const })),
        busy: [],
      };
    }

    const free: DriverWithStatus[] = [];
    const busy: DriverWithStatus[] = [];

    // Filtriraj samo filtere koji su uključeni
    const enabledFilters = filters.filter((f) => f.enabled);

    drivers.forEach((driver) => {
      const failedFilters: FailedFilter[] = [];

      // Primeni svaki uključeni filter
      for (const filter of enabledFilters) {
        const result = filter.checkFn(driver, requestedShift);

        if (!result.passed) {
          failedFilters.push({
            filterName: filter.name,
            reason: result.reason || 'Nije prošao proveru',
          });
        }
      }

      // Ako je prošao SVE filtere, dodaj u slobodne, inače u zauzete
      if (failedFilters.length === 0) {
        free.push({ ...driver, status: 'free' });
      } else {
        busy.push({ ...driver, status: 'busy', failedFilters });
      }
    });

    // Sortiraj slobodne vozače po confidence score DESC (vozači sa default-om prvi)
    free.sort((a, b) => {
      const scoreA = a.turnusDefault?.confidenceScore || 0;
      const scoreB = b.turnusDefault?.confidenceScore || 0;

      // Vozači sa default-om prvo (scoreA > 0 i scoreB > 0)
      if (scoreA > 0 && scoreB === 0) return -1;
      if (scoreA === 0 && scoreB > 0) return 1;
      if (scoreA !== scoreB) return scoreB - scoreA;

      // Ako je isti confidence score, sortiraj abecedno
      return a.fullName.localeCompare(b.fullName, 'sr-RS');
    });

    return { free, busy };
  }, [drivers, requestedShift, filters]);

  return {
    filters,
    toggleFilter,
    filteredDrivers,
  };
}
