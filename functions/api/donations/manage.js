import { failure, parseBody, secureOrigin, success, reject } from '../../_lib/shared.js';
import { assertAccess } from '../../_lib/google.js';
import { loadLedger, loadAnonymous, writeLedgerEntry, appendLedgerBatch, saveAnonymous } from '../../_lib/donationStore.js';
import { normalizeAnonymousPeople } from '../../_lib/donations.js';

export async function onRequestGet({request,env}) {
  try {
    secureOrigin(request);
    await assertAccess(request,env,'staff');
    const [records, registry]=await Promise.all([loadLedger(env),loadAnonymous(env)]);
    return success({ records, people:registry.people, registryUpdateTime:registry.updateTime });
  } catch(error) { return failure(error); }
}
export async function onRequestPost({request,env}) {
  try {
    secureOrigin(request);
    await assertAccess(request,env,'staff');
    const body=await parseBody(request);
    if (body?.action==='save') {
      const record=await writeLedgerEntry(env,body.record,body.id,body.expectedUpdateTime);
      return success({record});
    }
    if (body?.action==='import') return success({added:await appendLedgerBatch(env,body.rows)});
    if (body?.action==='people') {
      const people=normalizeAnonymousPeople(body.people);
      const updateTime=await saveAnonymous(env,people,body.expectedUpdateTime);
      return success({people,registryUpdateTime:updateTime});
    }
    reject('후원 관리 작업을 확인해 주세요.');
  } catch(error) { return failure(error); }
}
