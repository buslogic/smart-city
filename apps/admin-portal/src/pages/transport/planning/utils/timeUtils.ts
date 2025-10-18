/**
 * Helper funkcije za rad sa vremenima u planning modulu
 */

/**
 * Parsira vreme iz string format-a (HH:MM) u minute od ponoći
 * @param timeString - Vreme u formatu "HH:MM" (npr. "14:30")
 * @returns Broj minuta od ponoći (npr. 870 za 14:30)
 */
export function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formatira minute od ponoći u string format (HH:MM)
 * @param minutes - Broj minuta od ponoći
 * @returns Vreme u formatu "HH:MM"
 */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Proverava da li se dva vremenska opsega preklapaju
 * @param start1 - Početak prvog opsega (u minutama od ponoći)
 * @param end1 - Kraj prvog opsega (u minutama od ponoći)
 * @param start2 - Početak drugog opsega (u minutama od ponoći)
 * @param end2 - Kraj drugog opsega (u minutama od ponoći)
 * @returns true ako se opsezi preklapaju, false ako ne
 */
export function doTimeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  // Handle opseg koji prelazi preko ponoći (npr. 22:00 - 02:00)
  // Ako end < start, znači da prelazi preko ponoći, dodaj 24h
  const normalizedEnd1 = end1 < start1 ? end1 + 24 * 60 : end1;
  const normalizedEnd2 = end2 < start2 ? end2 + 24 * 60 : end2;

  // Ako prvi opseg prelazi preko ponoći
  if (normalizedEnd1 > 24 * 60) {
    // Proveri preklapanje sa opsegom [start1, 24:00]
    if (start2 < 24 * 60 && start2 < normalizedEnd1) {
      return true;
    }
    // Proveri preklapanje sa opsegom [00:00, end1-24h]
    if (end2 > 0 && end2 > (normalizedEnd1 - 24 * 60)) {
      return true;
    }
  }

  // Ako drugi opseg prelazi preko ponoći
  if (normalizedEnd2 > 24 * 60) {
    // Proveri preklapanje sa opsegom [start2, 24:00]
    if (start1 < 24 * 60 && start1 < normalizedEnd2) {
      return true;
    }
    // Proveri preklapanje sa opsegom [00:00, end2-24h]
    if (end1 > 0 && end1 > (normalizedEnd2 - 24 * 60)) {
      return true;
    }
  }

  // Standardna provera preklapanja (nijedan ne prelazi preko ponoći)
  return start1 < normalizedEnd2 && normalizedEnd1 > start2;
}

/**
 * Formatira trajanje iz minuta u string format (HH:MM)
 * @param minutes - Trajanje u minutama
 * @returns String u formatu "HH:MM" (npr. "7:30")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Izračunava trajanje između dva vremena u minutima
 * @param startTime - Početno vreme (HH:MM)
 * @param endTime - Krajnje vreme (HH:MM)
 * @returns Trajanje u minutama
 */
export function calculateDuration(startTime: string, endTime: string): number {
  let startMinutes = parseTime(startTime);
  let endMinutes = parseTime(endTime);

  // Ako je endTime manji od startTime, znači da smena prelazi preko ponoći
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Dodaj 24 sata
  }

  return endMinutes - startMinutes;
}
