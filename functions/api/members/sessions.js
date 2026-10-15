import { FIRESTORE_ROOT, failure, parseBody, reject, secureOrigin, success, toFields, validateSessionsChange } from '../../_lib/shared.js';
import { assertAccess, getFirestoreDocument, googleRequest, requireFreshVersion, requireMutableTarget } from '../../_lib/google.js';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    const caller = await assertAccess(request, env, 'part_leader');
    const { uid, sessions, expectedUpdateTime } = validateSessionsChange(await parseBody(request));
    const target = await getFirestoreDocument(env, uid);
    requireMutableTarget(caller, target, uid);
    requireFreshVersion(target, expectedUpdateTime);
    const uri = new URL(FIRESTORE_ROOT + '/users/' + encodeURIComponent(uid));
    for (const name of ['sessions', 'updatedAt']) uri.searchParams.append('updateMask.fieldPaths', name);
    uri.searchParams.set('currentDocument.updateTime', expectedUpdateTime);
    const fields = toFields({ sessions });
    fields.updatedAt = { timestampValue: new Date().toISOString() };
    const result = await googleRequest(env, uri.toString(), { method: 'PATCH', body: { fields } });
    if (result.status === 409 || result.status === 412) reject('변경 중 다른 수정이 발생했습니다. 명단을 새로고침해 주세요.', 409);
    if (!result.ok) throw new Error('Firestore sessions update failed ' + result.status);
    return success({ success: true });
  } catch (error) { return failure(error); }
}
