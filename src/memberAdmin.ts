import { auth } from './firebase';
import type { MemberRole, Session } from './firebase';
import { exampleMemberCsvRows, serializeMembersCsv } from './memberCsv';
export { parseMembersCsv, splitMemberValues, formatMemberValues } from './memberCsv';

export type NewMember = {
  studentId: string;
  name: string;
  generation: string;
  sessions: Session[];
  positions: string[];
};
export type MemberRecord = NewMember & {
  uid: string;
  role: MemberRole;
  handoverAccess: boolean;
  protected: boolean;
  updateTime: string;
};
export type ImportResult = {
  studentId: string;
  name: string;
  status: 'created' | 'existing' | 'error';
  message?: string;
};
type MemberPage = { members: MemberRecord[]; nextCursor: string | null };

async function api<T>(path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다. 다시 로그인해 주세요.');
  const token = await user.getIdToken();
  const response = await fetch('/api/members/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: 'Bearer ' + token,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  let data: Record<string, unknown>;
  try { data = await response.json(); }
  catch { throw new Error('Cloudflare API에 연결할 수 없습니다. Pages Functions 배포와 비밀키 설정을 확인해 주세요.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'API 요청에 실패했습니다.');
  return data as T;
}
export async function loadMembers(cursor: string | null = null) {
  return api<MemberPage>('list' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
}

export type PreviewResult = { studentId: string; status: 'new' | 'existing' };
export async function previewMembers(members: NewMember[]): Promise<PreviewResult[]> {
  const found: PreviewResult[] = [];
  for (let index = 0; index < members.length; index += 5) {
    const chunk = members.slice(index, index + 5);
    const page = await api<{ results: PreviewResult[] }>('preview', { members: chunk });
    if (!Array.isArray(page.results) || page.results.length !== chunk.length) {
      throw new Error('미리보기 결과의 일부가 누락되었습니다.');
    }
    found.push(...page.results);
  }
  return found;
}
export async function registerMembers(
  members: NewMember[],
  onProgress?: (completed: number, results: ImportResult[]) => void,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (let index = 0; index < members.length; index += 5) {
    const chunk = members.slice(index, index + 5);
    try {
      const page = await api<{ results: ImportResult[] }>('register', { members: chunk });
      if (!Array.isArray(page.results) || page.results.length !== chunk.length) {
        throw new Error('서버 응답에 일부 회원의 등록 결과가 누락되었습니다.');
      }
      results.push(...page.results);
    } catch (error) {
      const message = error instanceof Error ? error.message : '연결 오류';
      // A previous request may have succeeded even if the browser lost the response.
      results.push(...chunk.map(member => ({
        studentId: member.studentId,
        name: member.name,
        status: 'error' as const,
        message: '결과를 확인할 수 없습니다. 자동 재시도하지 말고 계정 존재 여부를 확인해 주세요. ' + message,
      })));
      onProgress?.(results.length, [...results]);
      // Do not silently continue after a connection error.
      return results;
    }
    onProgress?.(results.length, [...results]);
  }
  return results;
}
export async function saveMemberPermissions(member: MemberRecord) {
  await api<{ success: boolean }>('permissions', {
    uid: member.uid,
    role: member.role,
    handoverAccess: member.handoverAccess,
    expectedUpdateTime: member.updateTime,
  });
}
export async function saveMemberSessions(member: MemberRecord, sessions: Session[]) {
  await api<{ success: boolean }>('sessions', {
    uid: member.uid, sessions, expectedUpdateTime: member.updateTime,
  });
}
export async function saveMemberDetails(member: MemberRecord) {
  await api<{ success: boolean }>('details', {
    uid: member.uid, name: member.name, studentId: member.studentId,
    generation: member.generation, positions: member.positions,
    expectedUpdateTime: member.updateTime,
  });
}
export async function resetMemberPassword(member: MemberRecord) {
  await api<{ success: boolean }>('reset-password', { uid: member.uid });
}
export async function deleteMember(member: MemberRecord) {
  await api<{ success: boolean }>('delete', {
    uid: member.uid, expectedUpdateTime: member.updateTime,
  });
}

const RESET_CONFIRMATION = 'CONFIRM_RESET_ALL_MEMBERS_EXCEPT_MYSELF';

/**
 * Only the designated developer superadmin can call the destructive endpoint.
 * The Cloudflare backend checks the Firebase signed claim AND Firestore flag.
 * Each call removes at most five accounts to stay within the free Workers budget.
 */
export async function purgeAllOtherMembers(onProgress: (deleted: number) => void): Promise<number> {
  let totalDeleted = 0;
  for (let requestNumber = 0; requestNumber < 300; requestNumber++) {
    const data = await api<{ deleted: number; done: boolean; error?: string }>('purge', {
      confirmation: RESET_CONFIRMATION,
    });
    if (!Number.isInteger(data.deleted) || data.deleted < 0 || data.deleted > 5 ||
        typeof data.done !== 'boolean') {
      throw new Error('명단 초기화 결과 형식이 올바르지 않습니다.');
    }
    totalDeleted += data.deleted;
    onProgress(totalDeleted);
    if (data.error) throw new Error(data.error + ' 현재까지 삭제 확인: ' + totalDeleted + '명');
    if (data.done) return totalDeleted;
    if (data.deleted === 0) throw new Error('진행되지 않는 초기화 요청을 감지해 중단했습니다. 관리자 로그를 확인해 주세요.');
  }
  throw new Error('명단이 많아 자동 초기화를 중단했습니다. 완료된 작업은 유지되므로 명단을 확인한 뒤 다시 실행해 주세요.');
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const contents = serializeMembersCsv(rows);
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const element = document.createElement('a');
  element.href = url;
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  element.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function downloadExampleCsv() {
  downloadCsv('myrock-members-template.csv', [
    ...exampleMemberCsvRows,
  ]);
}
export function callError(error: unknown): string {
  const message = (error as { message?: string })?.message;
  return message && message.length < 260 ? message : '요청을 처리하지 못했습니다. Cloudflare 설정과 연결을 확인해 주세요.';
}
