import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import type {User} from 'firebase/auth';
import {EmailAuthProvider,reauthenticateWithCredential} from 'firebase/auth';
import {ArrowRight,Mail,X} from 'lucide-react';
import {showToast} from './toastBus';

type EmailPreviewStatus = 'unregistered'|'registered'|'pending';

export default function RecoveryEmailSettings({user}:{user:User}) {
  const [registeredEmail,setRegisteredEmail] = useState('');
  const [status,setStatus] = useState<EmailPreviewStatus>('unregistered');
  const [open,setOpen] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');

  function close() {
    if(busy)return;
    setOpen(false);setEmail('');setPassword('');setError('');
  }
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy){setOpen(false);setEmail('');setPassword('');setError('');}};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[open,busy]);

  async function register(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setError('');
    if(!user.email){setError('비밀번호 로그인을 사용하는 계정이 아닙니다.');return;}
    setBusy(true);
    try {
      const credential=EmailAuthProvider.credential(user.email,password);
      await reauthenticateWithCredential(user,credential);
      setRegisteredEmail(email.trim());
      setStatus('registered');
      setOpen(false);setEmail('');setPassword('');
      showToast('이메일로 링크가 발송되었습니다. 해당 이메일에서 인증을 완료해주세요','success');
    } catch(err) {
      const code=(err as {code?:string})?.code;
      if(code==='auth/wrong-password'||code==='auth/invalid-credential')setError('비밀번호가 올바르지 않습니다.');
      else if(code==='auth/too-many-requests')setError('확인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
      else if(code==='auth/network-request-failed')setError('네트워크 연결을 확인해 주세요.');
      else setError('비밀번호를 확인하지 못했습니다. 다시 시도해 주세요.');
    } finally {setBusy(false);}
  }

  return <>
    <div className="profile-panel recovery-email-panel">
      <div className="profile-title"><Mail size={20}/><h2>이메일 설정</h2></div>
      <p className="profile-help">비밀번호 복구용 이메일을 설정합니다.</p>
      <div className="recovery-email-status">
        <span className={registeredEmail?'recovery-email-address':''}>{registeredEmail||'등록 안 함'}</span>
        {status==='unregistered'
          ?<button className="text-link" type="button" onClick={()=>setOpen(true)}>등록하기</button>
          :<strong>{status==='pending'?'인증 대기중':'등록 완료'}</strong>}
      </div>
      <button className="button button-secondary recovery-reset-button" type="button" onClick={()=>setStatus('pending')}>비밀번호 재설정 <ArrowRight size={15}/></button>
    </div>
    {open&&<div className="modal-overlay" data-async-busy={busy?'true':undefined} onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
      <div className="login-dialog recovery-email-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-email-heading">
        <button type="button" className="dialog-close" onClick={close} disabled={busy} aria-label="닫기"><X size={20}/></button>
        <h2 id="recovery-email-heading">복구 이메일 등록</h2>
        <p>계정 비밀번호를 확인한 후 이메일을 등록합니다.</p>
        <form onSubmit={event=>void register(event)}>
          <label>이메일<input type="email" autoComplete="email" placeholder="이메일 주소" value={email} onChange={event=>setEmail(event.target.value)} required autoFocus disabled={busy}/></label>
          <label>현재 비밀번호<input type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={event=>setPassword(event.target.value)} required disabled={busy}/></label>
          {error&&<p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy||!email.trim()||!password}>{busy?'확인 중...':'등록하기'} <ArrowRight size={17}/></button>
        </form>
      </div>
    </div>}
  </>;
}
