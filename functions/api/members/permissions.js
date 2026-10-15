import { FIRESTORE_ROOT, failure, parseBody, reject, secureOrigin, success, toFields, validatePermissions } from '../../_lib/shared.js';
import { assertAdmin, getFirestoreDocument, googleRequest, requireFreshVersion, requireMutableTarget } from '../../_lib/google.js';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    const caller = await assertAdmin(request, env);
    const { uid, role, handoverAccess, expectedUpdateTime } = validatePermissions(await parseBody(request));
    const target = await getFirestoreDocument(env, uid);
    requireMutableTarget(caller, target, uid, { protectSelf: true });
    requireFreshVersion(target, expectedUpdateTime);
    const uri = new URL(FIRESTORE_ROOT + '/users/' + encodeURIComponent(uid));
    for (const name of ['role', 'handoverAccess', 'updatedAt']) {
      uri.searchParams.append('updateMask.fieldPaths', name);
    }
    uri.searchParams.set('currentDocument.updateTime', expectedUpdateTime);
    const fields = toFields({ role, handoverAccess: role === 'member' && handoverAccess });
    fields.updatedAt = { timestampValue: new Date().toISOString() };
    const result = await googleRequest(env, uri.toString(), { method: 'PATCH', body: { fields } });
    if (result.status === 409 || result.status === 412) reject('다른 관리자가 부원 정보를 수정했습니다. 새로고침 후 다시 시도해 주세요.', 409);
    if (!result.ok) throw new Error('Firestore role update failed ' + result.status);
    return success({ success: true });
  } catch (error) { return failure(error); }
}
