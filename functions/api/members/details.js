import {
  FIRESTORE_ROOT, failure, parseBody, reject, secureOrigin, success,
  toFields, validateDetails,
} from '../../_lib/shared.js';
import {
  assertAccess, getFirestoreDocument, googleRequest, lookupAccount,
  lookupAccountByUid, requireFreshVersion, requireMutableTarget, updateAccount,
} from '../../_lib/google.js';

const accountEmail = studentId => studentId + '@members.skku-myrock.firebaseapp.com';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    const caller = await assertAccess(request, env, 'staff');
    const { uid, name, studentId, generation, positions, expectedUpdateTime } =
      validateDetails(await parseBody(request));
    const target = await getFirestoreDocument(env, uid);
    const old = requireMutableTarget(caller, target, uid);
    requireFreshVersion(target, expectedUpdateTime);
    // The student ID is also the Firebase Auth login email. Both must change together.
    const oldEmail = accountEmail(old.studentId);
    const newEmail = accountEmail(studentId);
    const auth = await lookupAccountByUid(env, uid);
    if (!auth || auth.email !== oldEmail) {
      reject('인증 계정과 학번이 일치하지 않습니다. 개발 관리자에게 문의해 주세요.', 409);
    }
    if (newEmail !== oldEmail) {
      const taken = await lookupAccount(env, newEmail);
      if (taken && taken.localId !== uid) reject('이미 등록된 학번입니다.', 409);
    }
    const changedAuth = {};
    if (newEmail !== oldEmail) changedAuth.email = newEmail;
    if (name !== auth.displayName) changedAuth.displayName = name;
    if (Object.keys(changedAuth).length) {
      const updated = await updateAccount(env, uid, changedAuth);
      if (!updated.ok) {
        if (updated.detail?.includes('EMAIL_EXISTS')) reject('이미 등록된 학번입니다.', 409);
        throw new Error('Firebase Auth profile update failed ' + updated.status);
      }
    }
    const url = new URL(FIRESTORE_ROOT + '/users/' + encodeURIComponent(uid));
    for (const key of ['name', 'studentId', 'generation', 'positions', 'updatedAt']) {
      url.searchParams.append('updateMask.fieldPaths', key);
    }
    url.searchParams.set('currentDocument.updateTime', expectedUpdateTime);
    const fields = toFields({ name, studentId, generation, positions });
    fields.updatedAt = { timestampValue: new Date().toISOString() };
    let outcome;
    try {
      outcome = await googleRequest(env, url.toString(), { method: 'PATCH', body: { fields } });
    } catch (error) {
      // Never leave a changed sign-in email paired with an old Firestore student ID.
      if (Object.keys(changedAuth).length) {
        const rollback = await updateAccount(env, uid, {
          ...(changedAuth.email ? { email: oldEmail } : {}),
          ...(changedAuth.displayName !== undefined ? { displayName: auth.displayName ?? '' } : {}),
        }).catch(() => ({ ok: false }));
        if (!rollback.ok) console.error('URGENT: Firebase Auth profile rollback failed', uid);
      }
      throw error;
    }
    if (!outcome.ok) {
      if (Object.keys(changedAuth).length) {
        const rollback = await updateAccount(env, uid, {
          ...(changedAuth.email ? { email: oldEmail } : {}),
          ...(changedAuth.displayName !== undefined ? { displayName: auth.displayName ?? '' } : {}),
        }).catch(() => ({ ok: false }));
        if (!rollback.ok) console.error('URGENT: Firebase Auth profile rollback failed', uid);
      }
      if ([409, 412].includes(outcome.status)) reject('다른 관리자가 먼저 수정했습니다. 새로고침해 주세요.', 409);
      throw new Error('Firestore details update failed ' + outcome.status);
    }
    return success({ success: true });
  } catch (error) { return failure(error); }
}
