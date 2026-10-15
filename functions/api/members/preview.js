import { failure, parseBody, secureOrigin, success, validateMembers } from '../../_lib/shared.js';
import { assertAdmin, lookupAccount } from '../../_lib/google.js';

export async function onRequestPost({ request, env }) {
  try {
    secureOrigin(request);
    await assertAdmin(request, env);
    const members = validateMembers((await parseBody(request))?.members);
    const results = [];
    for (const member of members) {
      const email = member.studentId + '@members.skku-myrock.firebaseapp.com';
      const exists = await lookupAccount(env, email);
      results.push({ studentId: member.studentId, status: exists ? 'existing' : 'new' });
    }
    // Read-only preview; no Firebase Auth or Firestore documents are created.
    return success({ results });
  } catch (error) { return failure(error); }
}
