// Cloudflare Pages Functions: shared input validation and Firestore REST conversion.
// All member management writes must pass through the authenticated API.
export const PROJECT_ID = 'skku-myrock';
export const FIRESTORE_ROOT = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
export const AUTH_ROOT = 'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT_ID;
const ROLES = new Set(['member', 'part_leader', 'staff', 'president']);
const ROLE_LEVEL = { member: 0, part_leader: 1, staff: 2, president: 3 };
export function canPerform(caller, requiredRole) {
  const level = caller?.superadmin === true ? 3 : (ROLE_LEVEL[caller?.role] ?? 0);
  return level >= ROLE_LEVEL[requiredRole];
}
export function validateUid(uid) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(uid)) {
    reject('부원 식별자가 올바르지 않습니다.');
  }
  return uid;
}
export function validateStudentId(studentId) {
  if (typeof studentId !== 'string' || !/^\d{10}$/.test(studentId)) {
    reject('학번은 숫자 10자리여야 합니다.');
  }
  return studentId;
}
export function validateDetails(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('부원 정보가 올바르지 않습니다.');
  return {
    uid: validateUid(input.uid),
    name: textField(input.name, '이름', 60),
    studentId: validateStudentId(input.studentId),
    generation: textField(input.generation, '기수', 20),
    positions: positionsField(input.positions),
    expectedUpdateTime: validateUpdateTime(input.expectedUpdateTime),
  };
}
export function validateSessionsChange(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('세션 변경 정보가 올바르지 않습니다.');
  return {
    uid: validateUid(input.uid),
    sessions: sessionsField(input.sessions),
    expectedUpdateTime: validateUpdateTime(input.expectedUpdateTime),
  };
}
export function validateUpdateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)) reject('정보가 오래되었습니다. 명단을 다시 조회해 주세요.', 409);
  return value;
}
const SESSIONS = new Set(['보컬', '기타', '베이스', '드럼', '키보드']);

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const reject = (message, status = 400) => { throw new ApiError(status, message); };

// Newly created accounts use the 10-digit student ID as their initial password.
// Never apply this to an existing account; users may change it later.
export function initialPasswordForStudentId(studentId) {
  validateStudentId(studentId);
  return studentId;
}
export function textField(value, name, max = 80) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    reject(name + ' 형식이 올바르지 않습니다.');
  }
  return value.trim();
}
export function positionsField(input) {
  if (!Array.isArray(input) || input.length > 8 ||
      input.some(item => typeof item !== 'string' || !item.trim() || item.trim().length > 40)) {
    reject('직책은 8개까지, 각각 1~40자로 입력해 주세요.');
  }
  return input.map(item => item.trim());
}
export function sessionsField(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 5 ||
      input.some(item => !SESSIONS.has(item)) || new Set(input).size !== input.length) {
    reject('세션은 보컬, 기타, 베이스, 드럼, 키보드 중 하나 이상 선택해야 합니다.');
  }
  return input;
}
export function validateMembers(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 5) {
    reject('서버는 요청당 최대 5명까지 등록합니다.');
  }
  const ids = new Set();
  return input.map((row, i) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) reject((i + 1) + '번째 회원 형식 오류');
    if (typeof row.studentId !== 'string' || !/^\d{10}$/.test(row.studentId)) reject((i + 1) + '번째 학번은 숫자 10자리여야 합니다.');
    if (ids.has(row.studentId)) reject('같은 요청에 중복 학번이 있습니다.');
    ids.add(row.studentId);
    return {
      studentId: row.studentId,
      name: textField(row.name, '이름', 60),
      generation: textField(row.generation, '기수', 20),
      sessions: sessionsField(row.sessions),
      positions: positionsField(row.positions ?? []),
    };
  });
}
export function validatePermissions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('권한 변경 입력값이 올바르지 않습니다.');
  validateUid(input.uid);
  if (!ROLES.has(input.role)) reject('회원 권한을 선택해 주세요.');
  if (typeof input.handoverAccess !== 'boolean') reject('인수인계 접근 권한을 확인해 주세요.');
  return {
    uid: input.uid, role: input.role, handoverAccess: input.handoverAccess,
    expectedUpdateTime: validateUpdateTime(input.expectedUpdateTime),
  };
}
export function fieldToJs(value) {
  if (value?.stringValue !== undefined) return value.stringValue;
  if (value?.booleanValue !== undefined) return value.booleanValue;
  if (value?.integerValue !== undefined) return Number(value.integerValue);
  if (value?.arrayValue !== undefined) return (value.arrayValue.values ?? []).map(fieldToJs);
  if (value?.timestampValue !== undefined) return value.timestampValue;
  if (value?.mapValue !== undefined) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, fieldToJs(item)]));
  return null;
}
export function docFields(doc) {
  return Object.fromEntries(Object.entries(doc?.fields ?? {}).map(([key, value]) => [key, fieldToJs(value)]));
}
export function toField(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toField) } };
  if (value && typeof value === 'object') return { mapValue: { fields: toFields(value) } };
  throw new Error('지원하지 않는 Firestore 필드');
}
export function toFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toField(value)]));
}
export function memberView(doc) {
  const data = docFields(doc);
  return {
    uid: String(doc.name).split('/').pop(),
    studentId: String(data.studentId ?? ''),
    name: String(data.name ?? ''),
    generation: String(data.generation ?? ''),
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    positions: Array.isArray(data.positions) ? data.positions : [],
    role: ROLES.has(data.role) ? data.role : 'member',
    handoverAccess: data.handoverAccess === true,
    protected: data.superadmin === true,
    updateTime: doc.updateTime ?? '',
  };
}
export function success(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
export function failure(error) {
  if (error instanceof ApiError) return success({ error: error.message }, error.status);
  console.error('Cloudflare 관리자 API 실패', error);
  return success({ error: '서버 요청을 처리하지 못했습니다. 설정 및 로그를 확인해 주세요.' }, 500);
}
export async function parseBody(request, maxBytes = 16000) {
  if (!request.headers.get('content-type')?.includes('application/json')) reject('JSON 요청만 지원합니다.', 415);
  if (Number(request.headers.get('content-length') ?? '0') > maxBytes) reject('요청이 너무 큽니다.', 413);
  const content = await request.text();
  if (content.length > maxBytes) reject('요청이 너무 큽니다.', 413);
  try { return JSON.parse(content); }
  catch { reject('요청 JSON을 읽지 못했습니다.'); }
}
export function secureOrigin(request) {
  // These API endpoints live on the same Cloudflare Pages origin.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) reject('허용되지 않은 출처입니다.', 403);
}
