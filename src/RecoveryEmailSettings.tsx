import { ArrowRight, Mail } from 'lucide-react';

export default function RecoveryEmailSettings() {
  return <div className="profile-panel recovery-email-panel">
    <div className="profile-title"><Mail size={20}/><h2>비밀번호 복구용 이메일</h2></div>
    <p className="profile-help">비밀번호를 잊었을 때 계정 복구에 사용하는 이메일입니다. 등록은 선택사항이며, 로그인은 계속 학번으로 진행됩니다.</p>
    <div className="recovery-email-status"><span>등록 상태</span><strong>등록 안 함</strong></div>
    <div className="recovery-email-form">
      <label htmlFor="recovery-email-input">복구 이메일</label>
      <input id="recovery-email-input" type="email" autoComplete="email" placeholder="이메일 주소 입력" disabled />
      <button className="button button-secondary" type="button" disabled>이메일 등록 <ArrowRight size={15}/></button>
    </div>
    <p className="form-hint">이메일 등록 및 인증 기능은 준비 중입니다.</p>
  </div>;
}
