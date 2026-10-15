import { success } from '../_lib/shared.js';

export function onRequestGet({ env }) {
  return success({
    service: 'myrock-pages-api',
    deployed: true,
    firebaseSecretConfigured: Boolean(env.FIREBASE_SERVICE_ACCOUNT),
  });
}
