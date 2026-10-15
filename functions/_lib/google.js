import { ApiError, AUTH_ROOT, FIRESTORE_ROOT, PROJECT_ID, canPerform, docFields, reject } from './shared.js';

const encoder = new TextEncoder();
let keysCache = null;
let keysExpiry = 0;
let authCache = null;
let serviceKeyCache = null;
let oauthCache = null;
let oauthExpiry = 0;

function urlEncode64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function bytesFrom64(value) {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function jwtPart(data) { return urlEncode64(encoder.encode(JSON.stringify(data))); }

async function firebasePublicKeys() {
  if (keysCache && Date.now() < keysExpiry) return keysCache;
  const result = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!result.ok) throw new Error('Firebase public keys unavailable');
  const response = await result.json();
  if (!Array.isArray(response.keys)) throw new Error('Firebase public keys malformed');
  keysCache = response.keys;
  const age = /max-age=(\d+)/.exec(result.headers.get('cache-control') ?? '');
  keysExpiry = Date.now() + Math.min(Number(age?.[1] ?? 1200), 3600) * 1000;
  return keysCache;
}
export async function verifyFirebaseToken(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) reject('로그인이 필요합니다.', 401);
  const token = authorization.slice(7);
  if (token.length > 9000 || token.split('.').length !== 3) reject('로그인 토큰 형식이 올바르지 않습니다.', 401);
  try {
    const [headerPart, bodyPart, signaturePart] = token.split('.');
    const header = JSON.parse(new TextDecoder().decode(bytesFrom64(headerPart)));
    const payload = JSON.parse(new TextDecoder().decode(bytesFrom64(bodyPart)));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || !header.kid ||
        payload.aud !== PROJECT_ID ||
        payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID ||
        typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 128 ||
        typeof payload.iat !== 'number' || payload.iat > now ||
        typeof payload.exp !== 'number' || payload.exp <= now ||
        typeof payload.auth_time !== 'number' || payload.auth_time > now) {
      reject('로그인 토큰이 유효하지 않습니다.', 401);
    }
    const jwk = (await firebasePublicKeys()).find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) reject('로그인 토큰 서명 키를 찾지 못했습니다.', 401);
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, bytesFrom64(signaturePart), encoder.encode(headerPart + '.' + bodyPart));
    if (!valid) reject('로그인 토큰 서명이 유효하지 않습니다.', 401);
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    reject('로그인이 만료되었거나 인증에 실패했습니다.', 401);
  }
}
function serviceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Cloudflare FIREBASE_SERVICE_ACCOUNT secret이 설정되지 않았습니다.');
  if (!authCache || authCache.raw !== env.FIREBASE_SERVICE_ACCOUNT) {
    const json = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    if (json.project_id !== PROJECT_ID ||
        !json.client_email?.endsWith('.gserviceaccount.com') ||
        !json.private_key?.includes('BEGIN PRIVATE KEY')) {
      throw new Error('Firebase 서비스 계정 설정이 올바르지 않습니다.');
    }
    authCache = { raw: env.FIREBASE_SERVICE_ACCOUNT, json };
    serviceKeyCache = null;
    oauthCache = null;
  }
  return authCache.json;
}
async function signingKey(env) {
  if (serviceKeyCache) return serviceKeyCache;
  const pem = serviceAccount(env).private_key;
  const pkcs8 = bytesFrom64(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''));
  serviceKeyCache = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  return serviceKeyCache;
}
async function googleAccessToken(env) {
  serviceAccount(env);
  if (oauthCache && Date.now() < oauthExpiry) return oauthCache;
  const account = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const header = jwtPart({ alg: 'RS256', typ: 'JWT' });
  const payload = jwtPart({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = header + '.' + payload;
  const signed = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(env), encoder.encode(unsigned));
  const assertion = unsigned + '.' + urlEncode64(new Uint8Array(signed));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error('Google 서비스 계정 액세스 토큰을 발급받지 못했습니다.');
  const result = await response.json();
  if (!result.access_token) throw new Error('OAuth response missing access_token');
  oauthCache = result.access_token;
  oauthExpiry = Date.now() + Math.max(60, Number(result.expires_in ?? 3600) - 180) * 1000;
  return oauthCache;
}
export async function googleRequest(env, url, options = {}) {
  const token = await googleAccessToken(env);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let json = {};
  if (raw) {
    try { json = JSON.parse(raw); } catch { throw new Error('Google API 응답 형식 오류'); }
  }
  if (!response.ok) {
    const code = json.error?.status ?? '';
    const detail = json.error?.message ?? '';
    // Do not surface IAM details or PII in client errors.
    return { ok: false, status: response.status, code, detail };
  }
  return { ok: true, data: json };
}
export async function getFirestoreDocument(env, uid) {
  const result = await googleRequest(env, FIRESTORE_ROOT + '/users/' + encodeURIComponent(uid));
  if (result.status === 404) return null;
  if (!result.ok) throw new Error('Firestore get failed ' + result.status);
  return result.data;
}
export async function assertAccess(request, env, requiredRole = 'part_leader') {
  const claims = await verifyFirebaseToken(request);
  const profile = await getFirestoreDocument(env, claims.sub);
  if (!profile) reject('등록된 부원 프로필이 없습니다.', 403);
  const data = docFields(profile);
  const superadmin = claims.superadmin === true && data.superadmin === true;
  const caller = { uid: claims.sub, superadmin, role: data.role ?? 'member', profile };
  // An OB handover flag grants no member-directory access by itself.
  if (!canPerform(caller, requiredRole)) reject('이 작업을 수행할 운영진 권한이 없습니다.', 403);
  return caller;
}
export async function assertAdmin(request, env) {
  return assertAccess(request, env, 'president');
}
export function requireMutableTarget(caller, target, uid, { protectSelf = false } = {}) {
  if (protectSelf && caller.uid === uid) reject('본인 계정에 이 작업을 수행할 수 없습니다.', 403);
  if (!target) reject('해당 부원을 찾지 못했습니다.', 404);
  if (docFields(target).superadmin === true) reject('시스템 관리자 계정은 이 화면에서 변경할 수 없습니다.', 403);
  return docFields(target);
}
export function requireFreshVersion(target, expectedUpdateTime) {
  if (!target.updateTime || target.updateTime !== expectedUpdateTime) {
    reject('다른 관리자가 부원 정보를 수정했습니다. 명단을 새로고침한 뒤 다시 시도해 주세요.', 409);
  }
}
export async function lookupAccount(env, email) {
  const result = await googleRequest(env, AUTH_ROOT + '/accounts:lookup', {
    method: 'POST', body: { email: [email] },
  });
  if (!result.ok) throw new Error('Firebase Auth lookup failed ' + result.status);
  return result.data.users?.[0] ?? null;
}
export async function createAccount(env, email, name, password) {
  // Firebase Identity Toolkit admin endpoint; requires the project Firebase API key
  // in addition to the service-account OAuth bearer token.
  const url = AUTH_ROOT + '/accounts?key=' + encodeURIComponent(env.FIREBASE_API_KEY ?? 'AIzaSyC-2H282ITWdqBTYVJBsoC0gnA9Y-xl4LM');
  const result = await googleRequest(env, url, {
    method: 'POST', body: { email, displayName: name, password, emailVerified: false },
  });
  if (!result.ok) {
    if (result.status === 409 || result.detail.includes('EMAIL_EXISTS')) return { exists: true };
    throw new Error('Firebase Auth create failed ' + result.status);
  }
  const uid = result.data.localId;
  if (!uid) throw new Error('Firebase Auth did not return localId');
  return { uid };
}
export async function deleteAccount(env, uid) {
  const result = await googleRequest(env, AUTH_ROOT + '/accounts:delete', { method: 'POST', body: { localId: uid } });
  if (!result.ok) throw new Error('Firebase Auth cleanup failed ' + result.status);
}

// Server-side administration: do not accept user-supplied OAuth access tokens.
export async function lookupAccountByUid(env, uid) {
  const result = await googleRequest(env, AUTH_ROOT + '/accounts:lookup', {
    method: 'POST', body: { localId: [uid] },
  });
  if (!result.ok) throw new Error('Firebase Auth user lookup failed ' + result.status);
  return result.data.users?.[0] ?? null;
}
export async function updateAccount(env, uid, properties) {
  const result = await googleRequest(env, AUTH_ROOT + '/accounts:update', {
    method: 'POST', body: { localId: uid, ...properties },
  });
  return result;
}
