import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import type {User} from 'firebase/auth';
import {EmailAuthProvider,reauthenticateWithCredential} from 'firebase/auth';
import {ArrowRight,Mail,X} from 'lucide-react';

type EmailPreviewStatus = 'unregistered'|'registered'|'pending';
type FeedbackType = 'error'|'success';

export default function RecoveryEmailSettings({user}:{user:User}) {
  const [registeredEmail,setRegisteredEmail] = useState('');
  const [resetNotice,setResetNotice] = useState(false);
  const [status,setStatus] = useState<EmailPreviewStatus>('unregistered');
  const [open,setOpen] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [cooldown,setCooldown] = useState(false);
  const [feedback,setFeedback] = useState('');
  const [feedbackType,setFeedbackType] = useState<FeedbackType>('error');
  const editing = status !== 'unregistered';
  const canSubmit = !busy && !cooldown && !!password && !!email.trim()
    && (sent || !editing || email.trim() !== registeredEmail);

  function clearFeedback(){setFeedback('');setFeedbackType('error');}
  function openDialog(){
    setEmail(registeredEmail);
    setPassword('');
    setSent(false);
    setCooldown(false);
    clearFeedback();
    setOpen(true);
  }
  function close() {
    if(busy)return;
    setOpen(false);setEmail('');setPassword('');setSent(false);setCooldown(false);clearFeedback();
  }

  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)close();};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[open,busy]);

  useEffect(()=>{
    if(!cooldown)return;
    const timer=window.setTimeout(()=>setCooldown(false),1000);
    return ()=>window.clearTimeout(timer);
  },[cooldown]);

  async function register(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!canSubmit)return;
    clearFeedback();
    const address=email.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){setFeedback('이메일 형식이 올바르지 않습니다');return;}
    if(!user.email){setFeedback('비밀번호 로그인을 사용하는 계정이 아닙니다.');return;}
    setBusy(true);
    try {
      const credential=EmailAuthProvider.credential(user.email,password);
      await reauthenticateWithCredential(user,credential);
      setRegisteredEmail(address);
      setResetNotice(false);
      // Preview only: no verification email is sent and Firebase Auth remains unchanged.
      setStatus(editing?'pending':'registered');
      setSent(true);
      setCooldown(true);
      setFeedbackType('success');
      setFeedback('해당 이메일로 인증 링크가 발송되었습니다.');
    } catch(err) {
      const code=(err as {code?:string})?.code;
      if(code==='auth/wrong-password'||code==='auth/invalid-credential')setFeedback('비밀번호가 올바르지 않습니다.');
      else if(code==='auth/too-many-requests')setFeedback('확인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
      else if(code==='auth/network-request-failed')setFeedback('네트워크 연결을 확인해 주세요.');
      else setFeedback('비밀번호를 확인하지 못했습니다. 다시 시도해 주세요.');
    } finally {setBusy(false);}
  }

  return <>
    <div className="profile-panel recovery-email-panel">
      <div className="profile-title"><Mail size={20}/><h2>이메일 설정</h2></div>
      <p className="profile-help">비밀번호 복구용 이메일을 설정합니다.</p>
      <div className="recovery-email-status">
        <span className={registeredEmail?'recovery-email-address':''}>{registeredEmail||'등록 안 함'}</span>
        {status==='unregistered'
          ?<button className="text-link recovery-email-register-link" type="button" onClick={openDialog}>등록하기</button>
          :<button className="recovery-email-status-button" type="button" onClick={openDialog}>{status==='pending'?'인증 대기중':'등록 완료'}</button>}
      </div>
      <div className="recovery-email-footer">
        <p className="recovery-email-notice" role="status" aria-live="polite">{resetNotice?'인증 메일을 발송했습니다':''}</p>
        <div className="recovery-email-actions"><button className="button button-primary recovery-reset-button" type="button" disabled={status!=='registered'} onClick={()=>setResetNotice(true)}>비밀번호 재설정 <ArrowRight size={16}/></button></div>
      </div>
    </div>
    {open&&<div className="modal-overlay" data-async-busy={busy?'true':undefined} onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
      <div className="login-dialog recovery-email-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-email-heading">
        <button type="button" className="dialog-close" onClick={close} disabled={busy} aria-label="닫기"><X size={20}/></button>
        <h2 id="recovery-email-heading">이메일 설정</h2>
        <p>{editing?'비밀번호 복구용 이메일을 재설정합니다.':'비밀번호 복구용 이메일을 설정합니다.'}</p>
        <form noValidate onSubmit={event=>void register(event)}>
          <label>현재 비밀번호<input type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={event=>{setPassword(event.target.value);clearFeedback();}} required autoFocus disabled={busy}/></label>
          <label>이메일<input type="email" inputMode="email" name="recovery-contact-address" autoComplete="off" placeholder="이메일 주소" value={email} onChange={event=>{setEmail(event.target.value);setSent(false);clearFeedback();}} required disabled={busy}/></label>
          {feedback&&<p className={feedbackType==='success'?'recovery-email-success':'form-error'} role={feedbackType==='error'?'alert':'status'}>{feedback}</p>}
          <button className="button button-primary" type="submit" disabled={!canSubmit}>{busy?'확인 중...':sent?'재발송':editing?'재설정하기':'등록하기'} <ArrowRight size={17}/></button>
        </form>
      </div>
    </div>}
  </>;
}
