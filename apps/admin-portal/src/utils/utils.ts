import { Row } from '@tanstack/react-table';

const toLatin = (str: string) => {
  const map: Record<string, string> = {
    А: 'A',
    а: 'a',
    Б: 'B',
    б: 'b',
    В: 'V',
    в: 'v',
    Г: 'G',
    г: 'g',
    Д: 'D',
    д: 'd',
    Ђ: 'Dj',
    ђ: 'dj',
    Е: 'E',
    е: 'e',
    Ж: 'Zh',
    ж: 'zh',
    З: 'Z',
    з: 'z',
    И: 'I',
    и: 'i',
    Ј: 'J',
    ј: 'j',
    К: 'K',
    к: 'k',
    Л: 'L',
    л: 'l',
    Љ: 'Lj',
    љ: 'lj',
    М: 'M',
    м: 'm',
    Н: 'N',
    н: 'n',
    Њ: 'Nj',
    њ: 'nj',
    О: 'O',
    о: 'o',
    П: 'P',
    п: 'p',
    Р: 'R',
    р: 'r',
    С: 'S',
    с: 's',
    Т: 'T',
    т: 't',
    Ћ: 'C',
    ћ: 'c',
    У: 'U',
    у: 'u',
    Ф: 'F',
    ф: 'f',
    Х: 'H',
    х: 'h',
    Ц: 'C',
    ц: 'c',
    Ч: 'C',
    ч: 'c',
    Џ: 'Dz',
    џ: 'dz',
    Ш: 'S',
    ш: 's',
  };
  return str
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
    .toLowerCase();
};

export const cyrillicFilterFn = (row: Row<any>, columnId: any, filterValue: any) => {
  const rowValue = row.getValue<string>(columnId) ?? '';
  const rowNormalized = toLatin(rowValue);
  const filterNormalized = toLatin(filterValue);
  return rowNormalized.includes(filterNormalized);
};

export const latinOnlyRegex = /[^A-Za-zčćžšđČĆŽŠĐ0-9 .,!?:;"'()\-]/g;

export const saveAs = (blob: Blob, name: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
};
