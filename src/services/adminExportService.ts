import * as XLSX from 'xlsx';
import { UserProfile } from '../types';

const ALUMNI_SHEET_HEADERS = [
  'Student ID',
  'FullName',
  'Course',
  'G_name',
  'Home_No',
  'B_date',
  'Home_Add'
] as const;

function formatFullNameLastFirst(rawName?: string): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes(',')) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return trimmed;

  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
  const lastToken = parts[parts.length - 1].toLowerCase();
  if (parts.length >= 3 && suffixes.has(lastToken)) {
    const surname = parts[parts.length - 2];
    const rest = parts.slice(0, -2).join(' ');
    return `${surname}, ${rest} ${parts[parts.length - 1]}`.trim();
  }

  const surname = parts[parts.length - 1];
  const givenNames = parts.slice(0, -1).join(' ');
  return `${surname}, ${givenNames}`;
}

function formatBirthdateMMDDYYYY(rawDate?: string): string {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return '';

  // ISO YYYY-MM-DD -> MM/DD/YYYY
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${mm}/${dd}/${isoMatch[1]}`;
  }

  // Already MM/DD/YYYY -> zero-pad month/day
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0');
    const dd = slashMatch[2].padStart(2, '0');
    return `${mm}/${dd}/${slashMatch[3]}`;
  }

  return trimmed;
}

function mapUserToSevenColumnRow(u: UserProfile) {
  return {
    'Student ID': u.studentId || u.alumniId || '',
    FullName: formatFullNameLastFirst(u.name),
    Course: u.course || '',
    G_name: u.guardianName || '',
    Home_No: u.phone || u.contactPhone || '',
    B_date: formatBirthdateMMDDYYYY(u.birthday),
    Home_Add: u.homeAddress || u.location || ''
  };
}

/**
 * Exports alumni directory records as a formatted 7-column CSV spreadsheet file:
 * Student ID | FullName | Course | G_name | Home_No | B_date | Home_Add
 */
export function exportAlumniRosterCsv(users: UserProfile[], filenamePrefix: string = 'st_cecilia_alumni_roster') {
  if (!users || users.length === 0) return;

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = users.map((u) => {
    const mapped = mapUserToSevenColumnRow(u);
    return [
      escapeCsv(mapped['Student ID']),
      escapeCsv(mapped.FullName),
      escapeCsv(mapped.Course),
      escapeCsv(mapped.G_name),
      escapeCsv(mapped.Home_No),
      escapeCsv(mapped.B_date),
      escapeCsv(mapped.Home_Add)
    ];
  });

  const csvContent = '\uFEFF' + [ALUMNI_SHEET_HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  const dateStamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${filenamePrefix}_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports alumni directory records as a formatted 7-column Excel (.xlsx) workbook:
 * Student ID | FullName | Course | G_name | Home_No | B_date | Home_Add
 */
export function exportAlumniRosterExcel(users: UserProfile[], filenamePrefix: string = 'st_cecilia_alumni_roster') {
  if (!users || users.length === 0) return;

  const data = users.map(mapUserToSevenColumnRow);
  const worksheet = XLSX.utils.json_to_sheet(data, { header: [...ALUMNI_SHEET_HEADERS] });

  // Force Home_No (col E, index 4) and B_date (col F, index 5) to text strings so leading zeros and MM/DD/YYYY never auto-convert
  for (let r = 1; r <= data.length; r++) {
    const phoneRef = XLSX.utils.encode_cell({ r, c: 4 });
    if (worksheet[phoneRef]) {
      worksheet[phoneRef].t = 's';
      worksheet[phoneRef].z = '@';
    }
    const bdateRef = XLSX.utils.encode_cell({ r, c: 5 });
    if (worksheet[bdateRef]) {
      worksheet[bdateRef].t = 's';
      worksheet[bdateRef].z = '@';
    }
  }

  worksheet['!cols'] = [
    { wch: 18 }, // Student ID
    { wch: 30 }, // FullName
    { wch: 16 }, // Course
    { wch: 24 }, // G_name
    { wch: 16 }, // Home_No
    { wch: 13 }, // B_date
    { wch: 38 }  // Home_Add
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumni Directory');

  const dateStamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStamp}.xlsx`);
}
