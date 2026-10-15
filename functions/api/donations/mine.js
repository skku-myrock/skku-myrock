import { failure, secureOrigin, success, docFields, reject } from '../../_lib/shared.js';
import { verifyFirebaseToken, getFirestoreDocument } from '../../_lib/google.js';
import { loadDonationsByStudentId } from '../../_lib/donationStore.js';

export async function onRequestGet({request,env}) {
  try {
    secureOrigin(request);
    const token = await verifyFirebaseToken(request);
    const profile = await getFirestoreDocument(env,token.sub);
    if (!profile) reject('등록된 부원 계정이 없습니다.',403);
    const studentId = String(docFields(profile).studentId ?? '');
    if (!/^\d{10}$/.test(studentId)) reject('본인 학번을 확인할 수 없습니다.',403);
    const records = await loadDonationsByStudentId(env,studentId);
    return success({ records });
  } catch(error) { return failure(error); }
}
