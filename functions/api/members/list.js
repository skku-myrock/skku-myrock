import { FIRESTORE_ROOT, success, failure, reject, memberView, secureOrigin } from '../../_lib/shared.js';
import { assertAccess, googleRequest } from '../../_lib/google.js';

export async function onRequestGet({ request, env }) {
  try {
    secureOrigin(request);
    await assertAccess(request, env, 'part_leader');
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    if (cursor && (cursor.length > 4000 || /[\u0000-\u001F\u007F]/.test(cursor))) reject('페이지 조회 기준이 올바르지 않습니다.');
    const target = new URL(FIRESTORE_ROOT + '/users');
    target.searchParams.set('pageSize', '30');
    // Firestore indexes names; each page is ordered without fetching the entire roster.
    // __name__ provides stable ordering when multiple members share a name.
    target.searchParams.set('orderBy', 'name asc, __name__ asc');
    if (cursor) target.searchParams.set('pageToken', cursor);
    const response = await googleRequest(env, target.toString());
    if (!response.ok) throw new Error('Firestore list failed ' + response.status);
    return success({
      members: (response.data.documents ?? []).map(memberView),
      nextCursor: response.data.nextPageToken ?? null,
    });
  } catch (error) {
    return failure(error);
  }
}
