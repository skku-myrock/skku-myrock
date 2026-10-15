import { failure, secureOrigin, success } from '../../_lib/shared.js';
import { loadAnonymous, loadLedger } from '../../_lib/donationStore.js';
import { publicDonation } from '../../_lib/donations.js';

export async function onRequestGet({request,env}) {
  try {
    secureOrigin(request);
    const [records, registry] = await Promise.all([loadLedger(env),loadAnonymous(env)]);
    return success({ records:records.map(record => publicDonation(record,registry.people)) });
  } catch(error) { return failure(error); }
}
