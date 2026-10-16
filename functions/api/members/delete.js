import {
  FIRESTORE_ROOT, failure, parseBody, reject, secureOrigin, success, validateUid, validateUpdateTime,
} from '../../_lib/shared.js';
import {
  assertAdmin, deleteAccount, getFirestoreDocument, googleRequest,
  requireFreshVersion, requireMutableTarget,
} from '../../_lib/google.js';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    const caller = await assertAdmin(request, env);
    const body = await parseBody(request);
    const uid = validateUid(body?.uid);
    const expectedUpdateTime = validateUpdateTime(body?.expectedUpdateTime);
    const document = await getFirestoreDocument(env, uid);
    requireMutableTarget(caller, document, uid, { protectSelf: true });
    // Only a plain member without OB handover privileges may be deleted.
    // Verify against Firestore, never a role supplied by the browser.
    if (document?.fields?.role?.stringValue !== 'member' ||
        document?.fields?.handoverAccess?.booleanValue === true) {
      reject('권한이 부여된 인원은 삭제할 수 없습니다. 먼저 권한을 해제해주세요.', 403);
    }
    requireFreshVersion(document, expectedUpdateTime);

    // Delete the profile with a version precondition, then the Auth account.
    // If Auth deletion fails, recreate the unchanged profile for safe recovery.
    const uri = new URL(FIRESTORE_ROOT + '/users/' + encodeURIComponent(uid));
    uri.searchParams.set('currentDocument.updateTime', expectedUpdateTime);
    const deleted = await googleRequest(env, uri.toString(), { method: 'DELETE' });
    if ([409, 412].includes(deleted.status)) reject('다른 관리자가 먼저 수정했습니다. 새로고침해 주세요.', 409);
    if (!deleted.ok) throw new Error('Firestore delete failed ' + deleted.status);
    try {
      await deleteAccount(env, uid);
    } catch (error) {
      const recreate = new URL(FIRESTORE_ROOT + '/users');
      recreate.searchParams.set('documentId', uid);
      const restore = await googleRequest(env, recreate.toString(), {
        method: 'POST', body: { fields: document.fields ?? {} },
      }).catch(() => ({ ok: false }));
      if (!restore.ok) console.error('URGENT: member profile restore failed', uid);
      throw error;
    }
    return success({ success: true });
  } catch (error) { return failure(error); }
}
