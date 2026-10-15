import { failure, secureOrigin, success } from '../../_lib/shared.js';
import { loadAnonymous, loadPublicDonationPage } from '../../_lib/donationStore.js';
import { publicDonation } from '../../_lib/donations.js';

export async function onRequestGet({request,env}) {
  try {
    secureOrigin(request);
    const [page, registry] = await Promise.all([loadPublicDonationPage(env,request),loadAnonymous(env)]);
    return success({ records:page.records.map(record => publicDonation(record,registry.people)),nextPageToken:page.nextPageToken });
  } catch(error) { return failure(error); }
}
