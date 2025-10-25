/**
 * Helper funkcije za formatiranje validnih dana u povezanim turnusima
 */

export interface ValidDays {
  validMonday: boolean;
  validTuesday: boolean;
  validWednesday: boolean;
  validThursday: boolean;
  validFriday: boolean;
  validSaturday: boolean;
  validSunday: boolean;
}

/**
 * Formatira validne dane u skraćeni string (npr. "Po,Ut,Sr,Če,Pe")
 */
export function formatValidDays(days: ValidDays): string {
  const dayLabels = [];

  if (days.validMonday) dayLabels.push('Po');
  if (days.validTuesday) dayLabels.push('Ut');
  if (days.validWednesday) dayLabels.push('Sr');
  if (days.validThursday) dayLabels.push('Če');
  if (days.validFriday) dayLabels.push('Pe');
  if (days.validSaturday) dayLabels.push('Su');
  if (days.validSunday) dayLabels.push('Ne');

  return dayLabels.length > 0 ? dayLabels.join(',') : '-';
}

/**
 * Formatira validne dane u brojeve (npr. "1,2,3,4,5")
 */
export function formatValidDaysAsNumbers(days: ValidDays): string {
  const dayNumbers = [];

  if (days.validMonday) dayNumbers.push('1');
  if (days.validTuesday) dayNumbers.push('2');
  if (days.validWednesday) dayNumbers.push('3');
  if (days.validThursday) dayNumbers.push('4');
  if (days.validFriday) dayNumbers.push('5');
  if (days.validSaturday) dayNumbers.push('6');
  if (days.validSunday) dayNumbers.push('7');

  return dayNumbers.length > 0 ? dayNumbers.join(',') : '-';
}

/**
 * Kreira default vrednosti za validne dane (radni dani)
 */
export function getDefaultValidDays(): ValidDays {
  return {
    validMonday: true,
    validTuesday: true,
    validWednesday: true,
    validThursday: true,
    validFriday: true,
    validSaturday: false,
    validSunday: false,
  };
}

/**
 * Proverava da li je barem jedan dan selektovan
 */
export function isAtLeastOneDaySelected(days: ValidDays): boolean {
  return (
    days.validMonday ||
    days.validTuesday ||
    days.validWednesday ||
    days.validThursday ||
    days.validFriday ||
    days.validSaturday ||
    days.validSunday
  );
}

/**
 * Nazivi dana za checkbox opcije
 */
export const DAY_OPTIONS = [
  { label: 'Ponedeljak', value: 'validMonday' as keyof ValidDays },
  { label: 'Utorak', value: 'validTuesday' as keyof ValidDays },
  { label: 'Sreda', value: 'validWednesday' as keyof ValidDays },
  { label: 'Četvrtak', value: 'validThursday' as keyof ValidDays },
  { label: 'Petak', value: 'validFriday' as keyof ValidDays },
  { label: 'Subota', value: 'validSaturday' as keyof ValidDays },
  { label: 'Nedelja', value: 'validSunday' as keyof ValidDays },
];
