import {useToastSignals} from './useToastSignals';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { ArrowRight, KeyRound } from 'lucide-react';

function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return '현재 비밀번호가 올바르지 않습니다.';
  if (code === 'auth/weak-password') return 'Firebase에서 허용하지 않는 비밀번호입니다. Firebase 기본 제한은 최소 6자이며 다른 형식 제한은 이 사이트에서 적용하지 않습니다.';
  if (code === 'auth/too-many-requests') return '비밀번호 확인 시도가 많습니다. 잠시 후 다시 시도해 주세요.';
  if (code === 'auth/requires-recent-login') return '보안을 위해 다시 로그인한 뒤 변경해 주세요.';
  if (code === 'auth/network-request-failed') return '네트워크 연결을 확인해 주세요.';
  return '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function PasswordChange({ user }: { user: User }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useToastSignals({error,message:success});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setSuccess('');
    if (!user.email) { setError('이 계정은 비밀번호 로그인 계정이 아닙니다.'); return; }
    if (next !== confirm) { setError('새 비밀번호와 확인 값이 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setCurrent(''); setNext(''); setConfirm('');
      setSuccess('비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.');
    } catch (err) { setError(authError(err)); }
    finally { setBusy(false); }
  }

  return <div className="profile-panel password-panel" data-async-busy={busy ? "true" : undefined}>
    <div className="profile-title"><KeyRound size={20}/><h2>비밀번호 변경</h2></div>
    <p className="profile-help">최소 6자 이상의 비밀번호를 사용해주세요.</p>
    <form onSubmit={event => void submit(event)} className="password-form">
      <label>현재 비밀번호<input type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} required/></label>
      <label>새 비밀번호<input type="password" autoComplete="new-password" value={next} onChange={event => setNext(event.target.value)} required/></label>
      <label>새 비밀번호 확인<input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required/></label>

}
      <button type="submit" className="button button-primary" disabled={busy || !current || !next || !confirm}>{busy ? '변경 중...' : '비밀번호 변경'} <ArrowRight size={16}/></button>
    </form>
    <p className="form-hint">현재 비밀번호를 잊었거나 로그인에 문제가 생기면 운영진에게 문의해 주세요.</p>
  </div>;
}
