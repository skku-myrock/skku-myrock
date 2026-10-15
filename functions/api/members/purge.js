import { AUTH_ROOT, FIRESTORE_ROOT, docFields, failure, parseBody, reject, secureOrigin, success } from '../../_lib/shared.js';
import { assertAccess, googleRequest, lookupAccountByUid } from '../../_lib/google.js';

// Developer-only maintenance action. This must never be authorized solely by
// Firestore.role === 'president' or by a client-side superadmin flag.
export const RESET_CONFIRMATION = 'CONFIRM_RESET_ALL_MEMBERS_EXCEPT_MYSELF';
const BATCH_SIZE = 5;

function uidFromDocument(document) {
  const name = document?.name;
  if (typeof name !== 'string' || !name.startsWith(FIRESTORE_ROOT.replace('https://firestore.googleapis.com/v1/', '') + '/users/')) {
    reject('부원 문서 경로가 올바르지 않습니다.', 500);
  }
  const uid = name.split('/').at(-1);
  if (!uid || !/^[A-Za-z0-9_-]{10,128}$/.test(uid)) reject('부원 문서 ID가 올바르지 않습니다.', 500);
  return uid;
}

async function restoreProfile(env, uid, document) {
  const uri = new URL(FIRESTORE_ROOT + '/users');
  uri.searchParams.set('documentId', uid);
  try {
    const restore = await googleRequest(env, uri.toString(), {
      method: 'POST', body: { fields: document.fields ?? {} },
    });
    if (!restore.ok) console.error('URGENT: roster-reset Firestore restore failed', uid, restore.status);
  } catch (error) {
    console.error('URGENT: roster-reset Firestore restore threw', uid, error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    const caller = await assertAccess(request, env, 'president');
    if (!caller.superadmin) reject('최고관리자만 개발용 명단 초기화를 할 수 있습니다.', 403);
    const body = await parseBody(request);
    if (body?.confirmation !== RESET_CONFIRMATION) reject('초기화 확인이 필요합니다.', 400);

    // Always start from the beginning: page tokens over a mutating collection
    // can skip records after deletions. Never delete by an untrusted client UID.
    const candidates = [];
    let cursor = null;
    const usedTokens = new Set();
    let scans = 0;
    do {
      const uri = new URL(FIRESTORE_ROOT + '/users');
      uri.searchParams.set('pageSize', '20');
      if (cursor) uri.searchParams.set('pageToken', cursor);
      const listing = await googleRequest(env, uri.toString());
      if (!listing.ok) throw new Error('Firestore roster reset list failed ' + listing.status);
      for (const document of listing.data.documents ?? []) {
        const uid = uidFromDocument(document);
        if (uid === caller.uid) continue; // The signed-in developer is never a target.
        if (docFields(document).superadmin === true) {
          reject('보호된 다른 최고관리자 문서를 발견했습니다. 초기화를 중단합니다.', 409);
        }
        if (!document.updateTime) reject('일부 부원 문서의 수정 시간을 확인할 수 없습니다.', 409);
        candidates.push({ uid, document });
        if (candidates.length > BATCH_SIZE) break;
      }
      if (candidates.length > BATCH_SIZE) break;
      cursor = listing.data.nextPageToken ?? null;
      if (cursor) {
        if (usedTokens.has(cursor)) reject('반복된 목록 페이지를 감지하여 중단했습니다.', 409);
        usedTokens.add(cursor);
      }
      scans++;
      if (scans >= 6 && cursor && candidates.length === 0) reject('부원 목록 조회를 완료하지 못했습니다. 다시 시도해 주세요.', 503);
    } while (cursor && candidates.length <= BATCH_SIZE && scans < 6);

    const targets = candidates.slice(0, BATCH_SIZE);
    if (!targets.length) {
      if (cursor) reject('전체 부원 목록을 확인하지 못했습니다. 다시 시도해 주세요.', 503);
      return success({ deleted: 0, done: true });
    }

    let deleted = 0;
    for (const { uid, document } of targets) {
      try {
        const account = await lookupAccountByUid(env, uid);
        const uri = new URL(FIRESTORE_ROOT + '/users/' + encodeURIComponent(uid));
        uri.searchParams.set('currentDocument.updateTime', document.updateTime);
        const removedProfile = await googleRequest(env, uri.toString(), { method: 'DELETE' });
        if (!removedProfile.ok) {
          if ([409, 412].includes(removedProfile.status)) {
            return success({ deleted, done: false, error: '다른 수정 작업이 감지되었습니다. 명단을 새로고침한 뒤 다시 시도해 주세요.' });
          }
          throw new Error('Firestore profile deletion failed ' + removedProfile.status);
        }
        if (account) {
          try {
            const removedAccount = await googleRequest(env, AUTH_ROOT + '/accounts:delete', {
              method: 'POST', body: { localId: uid },
            });
            const alreadyAbsent = removedAccount.status === 404 || /USER_NOT_FOUND/.test(removedAccount.detail ?? '');
            if (!removedAccount.ok && !alreadyAbsent) throw new Error('Firebase Auth account deletion failed ' + removedAccount.status);
          } catch (error) {
            // The two Google products are not transactional. Restore the profile
            // so the account remains visible for manual recovery if Auth fails.
            await restoreProfile(env, uid, document);
            throw error;
          }
        }
        deleted++;
      } catch (error) {
        console.error('Development roster reset stopped', uid, error);
        return success({ deleted, done: false, error: '일부 부원 삭제에 실패했습니다. Firebase 연결과 관리자 로그를 확인한 뒤 다시 시도해 주세요.' });
      }
    }
    // A final empty batch is harmless, and confirms all other profiles are gone.
    return success({ deleted, done: candidates.length <= BATCH_SIZE && !cursor });
  } catch (error) { return failure(error); }
}
