import { AUTH_ROOT, FIRESTORE_ROOT, failure, initialPasswordForStudentId, parseBody, secureOrigin, success, toFields, validateMembers } from '../../_lib/shared.js';
import { assertAdmin, createAccount, deleteAccount, getFirestoreDocument, googleRequest, lookupAccount } from '../../_lib/google.js';

const emailFor = studentId => studentId + '@members.skku-myrock.firebaseapp.com';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    await assertAdmin(request, env);
    const members = validateMembers((await parseBody(request))?.members);
    const results = [];
    for (const member of members) {
      const email = emailFor(member.studentId);
      try {
        const existing = await lookupAccount(env, email);
        if (existing) {
          const profile = await getFirestoreDocument(env, existing.localId);
          results.push({
            studentId: member.studentId, name: member.name,
            status: profile ? 'existing' : 'error',
            message: profile ? '이미 등록된 학번입니다. 기존 정보와 비밀번호는 유지합니다.' : '인증 계정만 존재합니다. 개발 관리자에게 문의해 주세요.',
          });
          continue;
        }
        const password = initialPasswordForStudentId(member.studentId);
        const created = await createAccount(env, email, member.name, password);
        if (created.exists) {
          results.push({ studentId: member.studentId, name: member.name, status: 'existing', message: '이미 등록된 학번입니다.' });
          continue;
        }
        const fields = toFields({
          studentId: member.studentId,
          name: member.name,
          generation: member.generation,
          sessions: member.sessions,
          positions: member.positions,
          role: 'member',
          handoverAccess: false,
        });
        fields.createdAt = { timestampValue: new Date().toISOString() };
        fields.updatedAt = { timestampValue: new Date().toISOString() };
        const uri = new URL(FIRESTORE_ROOT + '/users');
        uri.searchParams.set('documentId', created.uid);
        const result = await googleRequest(env, uri.toString(), { method: 'POST', body: { fields } });
        if (!result.ok) {
          try { await deleteAccount(env, created.uid); }
          catch (error) { console.error('회원 계정 롤백 실패. UID: ' + created.uid, error); }
          throw new Error('Firestore profile creation failed ' + result.status);
        }
        results.push({
          studentId: member.studentId, name: member.name,
          status: 'created',
        });
      } catch (error) {
        console.error('회원 등록 중 서버 오류', member.studentId, error);
        results.push({
          studentId: member.studentId, name: member.name,
          status: 'error', message: '등록 실패: 관리자에게 계정 상태 확인을 요청해 주세요.',
        });
      }
    }
    return success({ results });
  } catch (error) { return failure(error); }
}
