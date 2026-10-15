import { reject } from './shared.js';

export const DONATION_HEADERS = ['후원일', '후원자명', '학번', '후원금액', '익명여부'];

export function normalizeDonation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('후원 기록 형식을 확인해 주세요.');
  const date = String(input.date ?? '').trim();
  const donorName = String(input.donorName ?? '').trim();
  const studentId = String(input.studentId ?? '').trim();
  const amount = String(input.amount ?? '').replaceAll(',', '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z')) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date) reject('후원일은 YYYY-MM-DD 형식이어야 합니다.');
  if (donorName.length > 80 || (studentId !== '' && !/^\d{10}$/.test(studentId))) reject('후원자명 또는 학번 형식을 확인해 주세요.');
  if (!/^\d{1,12}$/.test(amount) || BigInt(amount) < 1n || BigInt(amount) > 1000000000000n) reject('후원금액은 양의 정수여야 합니다.');
  return { date, donorName, studentId, amount: String(BigInt(amount)),
    anonymous: String(input.anonymous ?? '').trim() === 'o' ? 'o' : 'x' };
}
export function normalizeAnonymousPeople(input) {
  if (!Array.isArray(input) || input.length > 500) reject('익명자 명단은 최대 500명입니다.');
  const entries = input.map(row => {
    const donorName = String(row?.donorName ?? '').trim();
    const studentId = String(row?.studentId ?? '').trim();
    if (!donorName || donorName.length > 80 || !/^\d{10}$/.test(studentId)) {
      reject('익명자 명단은 이름과 숫자 10자리 학번을 모두 입력해 주세요.');
    }
    return { donorName, studentId };
  });
  const seen = new Set();
  for (const entry of entries) {
    const key = entry.studentId;
    if (seen.has(key)) reject('익명자 명단에 중복된 사람이 있습니다.');
    seen.add(key);
  }
  return entries;
}
export function donorIsAnonymous(record, people) {
  if (!record.donorName || !record.studentId || record.anonymous === 'o') return true;
  return people.some(person => typeof person?.donorName === 'string' &&
    person.donorName.trim().length > 0 && typeof person.studentId === 'string' &&
    /^\d{10}$/.test(person.studentId) && person.studentId === record.studentId);
}
export function publicDonation(record, people) {
  return { id: record.id, date: record.date, amount: record.amount,
    donorName: donorIsAnonymous(record, people) ? '익명' : record.donorName };
}
export function donationFields(record) {
  return { date: record.date, donorName: record.donorName, studentId: record.studentId,
    amount: record.amount, anonymous: record.anonymous };
}
