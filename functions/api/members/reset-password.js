import {
  failure, initialPasswordForStudentId, parseBody, secureOrigin, success, validateUid,
} from '../../_lib/shared.js';
import {
  assertAccess, getFirestoreDocument, requireMutableTarget, updateAccount,
} from '../../_lib/google.js';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    const caller = await assertAccess(request, env, 'staff');
    const uid = validateUid((await parseBody(request))?.uid);
    const target = await getFirestoreDocument(env, uid);
    const data = requireMutableTarget(caller, target, uid, { protectSelf: true });
    // "Reset" always sets the password to the student's current 10-digit ID.
    const password = initialPasswordForStudentId(data.studentId);
    const response = await updateAccount(env, uid, { password });
    if (!response.ok) throw new Error('Firebase Auth password reset failed ' + response.status);
    return success({ success: true, message: '비밀번호를 현재 학번으로 초기화했습니다.' });
  } catch (error) { return failure(error); }
}
