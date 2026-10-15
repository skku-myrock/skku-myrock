import type { NewMember } from './memberAdmin';
import type { Session } from './firebase';

const allowedSessions: Session[] = ['보컬', '기타', '베이스', '드럼', '키보드'];
const aliases: Record<string, string[]> = {
  studentId: ['studentId', '학번'],
  name: ['name', '이름'],
  generation: ['generation', '기수'],
  sessions: ['sessions', '세션'],
  positions: ['positions', '직책'],
};

// Commas inside multi-value CSV cells must be quoted, unlike column separators.
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  const input = text.replace(/^\uFEFF/, '');
  function cell() { row.push(field); field = ''; closedQuote = false; }
  function line() { cell(); if (row.some(value => value.trim())) rows.push(row); row = []; }
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else field += c;
    } else if (c === '"' && field === '' && !closedQuote) {
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      if (c === ',') cell();
      else { if (c === '\r' && input[i + 1] === '\n') i++; line(); }
    } else if (closedQuote && (c === ' ' || c === '\t')) {
      // Ignore whitespace after the closing CSV quote.
    } else if (c === '"' || closedQuote) {
      throw new Error('CSV 큰따옴표 형식을 확인해 주세요. (' + (rows.length + 1) + '행)');
    } else field += c;
  }
  if (quoted) throw new Error('CSV의 큰따옴표가 닫히지 않았습니다.');
  if (field || row.length || closedQuote) line();
  return rows;
}

// Canonical internal representation has no padding next to delimiters.
// Preserve intentional spaces inside a job title, e.g. "홍보 부장".
export function splitMemberValues(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}
export function formatMemberValues(items: string[]): string {
  return items.join(',');
}

export function parseMembersCsv(text: string): NewMember[] {
  const rows = readCsv(text);
  if (rows.length < 2) throw new Error('헤더와 회원 데이터가 있는 CSV 파일을 선택해 주세요.');
  const headers = rows.shift()!.map(value => value.trim().toLowerCase());
  const indices = Object.fromEntries(Object.entries(aliases).map(([name, names]) => [
    name, headers.findIndex(header => names.some(item => item.toLowerCase() === header)),
  ])) as Record<keyof NewMember, number>;
  if (['studentId', 'name', 'generation', 'sessions'].some(key => indices[key as keyof NewMember] < 0)) {
    throw new Error('CSV에 학번, 이름, 기수, 세션 열이 필요합니다. (영문 헤더도 지원)');
  }
  if (rows.length > 60) throw new Error('한 번에 최대 60명까지 등록할 수 있습니다.');
  const used = new Set<string>();
  return rows.map((row, index) => {
    const location = index + 2;
    if (row.length !== headers.length) {
      throw new Error(location + '행: CSV 열 개수가 맞지 않습니다. 세션·직책에 쉼표가 있다면 "기타,베이스"처럼 셀 전체를 큰따옴표로 감싸 주세요.');
    }
    const value = (field: keyof NewMember) => indices[field] < 0 ? '' : (row[indices[field]] ?? '').trim();
    const studentId = value('studentId');
    const name = value('name');
    const generation = value('generation');
    const selected = splitMemberValues(value('sessions'));
    const positions = splitMemberValues(value('positions'));
    if (!/^\d{10}$/.test(studentId)) throw new Error(location + '행: 학번은 10자리 숫자여야 합니다.');
    if (used.has(studentId)) throw new Error(location + '행: 파일 안에 학번이 중복되었습니다.');
    used.add(studentId);
    if (!name || name.length > 60 || !generation || generation.length > 20) throw new Error(location + '행: 이름 또는 기수를 확인해 주세요.');
    if (!selected.length || selected.some(s => !allowedSessions.includes(s as Session)) || new Set(selected).size !== selected.length) {
      throw new Error(location + '행: 세션을 확인해 주세요. 여러 세션은 쉼표로 구분합니다. (예: "기타,베이스")');
    }
    if (positions.length > 8 || positions.some(p => p.length > 40)) {
      throw new Error(location + '행: 직책은 최대 8개, 각각 40자 이하여야 합니다.');
    }
    return { studentId, name, generation, sessions: selected as Session[], positions };
  });
}

export const exampleMemberCsvRows: string[][] = [
  ['학번', '이름', '기수', '세션', '직책'],
  ['2026300001', '홍길동', '29', '기타,베이스', ''],
];

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  // Prevent formula execution when exported CSV is opened in spreadsheet software.
  const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function serializeMembersCsv(rows: readonly (readonly unknown[])[]): string {
  return '\uFEFF' + rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
}
