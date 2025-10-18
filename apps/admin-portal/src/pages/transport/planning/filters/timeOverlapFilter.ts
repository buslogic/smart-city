/**
 * Filter za proveru preklapanja vremena između smena vozača
 */

import { doTimeRangesOverlap, parseTime } from '../utils/timeUtils';

export interface TurnusDefault {
  hasDefault: boolean;
  usageCount: number;
  usagePercentage: number;
  confidenceScore: number;
  priority: number;
  note: string | null;
}

export interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  scheduledShifts: ScheduledShift[];
  turnusDefault?: TurnusDefault;
}

export interface ScheduledShift {
  turnusName: string;
  shiftNumber: number;
  lineNumber: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  duration: string;  // "HH:MM"
}

export interface RequestedShift {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  duration: string;  // "HH:MM"
  turnusName: string;
  shiftNumber: number;
  lineNumber: string;
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

/**
 * Proverava da li se vreme tražene smene preklapa sa već isplaniranim smenama vozača
 * @param driver - Vozač sa isplaniranim smenama
 * @param requestedShift - Tražena smena koja se planira
 * @returns FilterResult - Da li je prošao filter i razlog ako nije
 */
export function timeOverlapFilter(
  driver: Driver,
  requestedShift: RequestedShift
): FilterResult {
  const { scheduledShifts } = driver;
  const { startTime: reqStart, endTime: reqEnd } = requestedShift;

  // Konvertuj u minute od ponoći
  const reqStartMinutes = parseTime(reqStart);
  const reqEndMinutes = parseTime(reqEnd);

  // Proveri svaku već isplaniranu smenu
  for (const shift of scheduledShifts) {
    const shiftStartMinutes = parseTime(shift.startTime);
    const shiftEndMinutes = parseTime(shift.endTime);

    // Proveri preklapanje
    if (doTimeRangesOverlap(
      reqStartMinutes,
      reqEndMinutes,
      shiftStartMinutes,
      shiftEndMinutes
    )) {
      return {
        passed: false,
        reason: `Preklapa se sa: Linija ${shift.lineNumber}, ${shift.turnusName} Smena ${shift.shiftNumber} (${shift.startTime}-${shift.endTime})`,
      };
    }
  }

  // Nema preklapanja
  return { passed: true };
}
