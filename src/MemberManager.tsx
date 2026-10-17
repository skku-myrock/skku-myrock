import {useToastSignals} from './useToastSignals';
import LoadingText from './LoadingText';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ArrowRight, Check, Download, FileSpreadsheet, KeyRound, Plus, RefreshCw, Search, Trash2, Upload, Users } from 'lucide-react';
import type { MemberRole, Session } from './firebase';
import type { Notify } from './app/siteNavigation';
import {
  callError, deleteMember, downloadExampleCsv, formatMemberValues, loadMembers,
  parseMembersCsv, previewMembers, registerMembers, resetMemberPassword,
  saveMemberDetails, saveMemberPermissions, saveMemberSessions, splitMemberValues,
} from './memberAdmin';
import type { ImportResult, MemberRecord, NewMember } from './memberAdmin';

const sessionList: Session[] = ['보컬', '기타', '베이스', '드럼', '키보드'];
const roleNames: Record<MemberRole, string> = {
  member: '일반부원', part_leader: '파트장', staff: '실무단', president: '회장단',
};
const blankMember: NewMember = { studentId: '', name: '', generation: '', sessions: ['보컬'], positions: [] };
type Tab = 'list' | 'add';
type EditMode = 'sessions' | 'details' | 'permissions';
type ManagementLevel = 'part_leader' | 'staff' | 'president';

export default function MemberManager({ currentUid, level, notify }: { currentUid: string; level: ManagementLevel; notify: Notify }) {
  const isPresident = level === 'president';
  const canEditDetails = level !== 'part_leader';
  const [tab, setTab] = useState<Tab>('list');
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingPageRef = useRef(false);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useToastSignals({error,message});
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<NewMember[]>([]);
  const [csvStep, setCsvStep] = useState<'choose' | 'review' | 'complete'>('choose');
  const [progressDone, setProgressDone] = useState(0);
  const [checkingPreview, setCheckingPreview] = useState(false);
  const [previewStatuses, setPreviewStatuses] = useState<Record<string, 'new' | 'existing'>>({});
  const previewRequest = useRef(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [individual, setIndividual] = useState<NewMember>(blankMember);
  const [individualPositionsText, setIndividualPositionsText] = useState('');
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('sessions');
  const [positionText, setPositionText] = useState('');

  async function refresh() {
    if (loadingPageRef.current) return;
    loadingPageRef.current = true;
    setLoading(true);
    setLoadError(false);
    setError('');
    try {
      const page = await loadMembers();
      setMembers(page.members);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(callError(err));
      setLoadError(true);
    } finally {
      loadingPageRef.current = false;
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function loadMore() {
    if (!cursor || loadingPageRef.current) return;
    loadingPageRef.current = true;
    setLoading(true);
    setError('');
    try {
      const page = await loadMembers(cursor);
      setMembers(previous => {
        const seen = new Set(previous.map(item => item.uid));
        return [...previous, ...page.members.filter(item => !seen.has(item.uid))];
      });
      setCursor(page.nextCursor);
      setLoadError(false);
    } catch (err) {
      setError('다음 부원 명단을 불러오지 못했습니다. 다시 시도해 주세요. ' + callError(err));
      setLoadError(true); // Avoid infinite retries when the sentinel stays visible.
    } finally {
      loadingPageRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== 'list' || !cursor || loading || loadError || busy) return;
    const target = loadSentinelRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '300px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [tab, cursor, loading, loadError, busy]);

  async function inspectPreview(membersToCheck: NewMember[], requestId: number) {
    setCheckingPreview(true);
    setPreviewStatuses({});
    try {
      const examined = await previewMembers(membersToCheck);
      if (requestId !== previewRequest.current) return;
      const statuses = Object.fromEntries(examined.map(entry => [entry.studentId, entry.status])) as Record<string, 'new' | 'existing'>;
      setPreviewStatuses(statuses);
      const newCount = examined.filter(entry => entry.status === 'new').length;
      setMessage(`CSV 전체 ${membersToCheck.length}명: 신규 등록 예상 ${newCount}명, 기존 계정 ${membersToCheck.length - newCount}명. 내용을 확인한 뒤 등록해 주세요.`);
    } catch (err) {
      if (requestId !== previewRequest.current) return;
      setError('기존 계정 확인에 실패했습니다. Cloudflare Pages API 설정을 확인하고 다시 시도해 주세요. ' + callError(err));
    } finally {
      if (requestId === previewRequest.current) setCheckingPreview(false);
    }
  }

  async function selectCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    const requestId = ++previewRequest.current;
    setResults([]); setPreview([]); setPreviewStatuses({}); setCsvStep('choose'); setProgressDone(0); setError(''); setMessage('');
    if (!file) return;
    if (file.size > 500_000) { setError('CSV 파일은 500KB 이하여야 합니다.'); return; }
    try {
      const parsed = parseMembersCsv(await file.text());
      if (requestId !== previewRequest.current) return;
      setFileName(file.name);
      setPreview(parsed);
      setCsvStep('review');
      await inspectPreview(parsed, requestId);
    } catch (err) {
      if (requestId !== previewRequest.current) return;
      setFileName(''); setCsvStep('choose');
      setError(err instanceof Error ? err.message : '파일을 읽지 못했습니다.');
    }
  }

  async function submit(membersToCreate: NewMember[], fromCsv = false) {
    if (busy) return;
    setBusy(true); setError(''); setMessage(''); setResults([]); setProgressDone(0);
    try {
      const incoming = await registerMembers(membersToCreate, done => setProgressDone(done));
      setResults(incoming);
      const created = incoming.filter(item => item.status === 'created').length;
      const skipped = incoming.filter(item => item.status === 'existing').length;
      const failed = incoming.filter(item => item.status === 'error').length;
      setMessage(`등록 결과: 신규 ${created}명, 기존 계정 ${skipped}명, 실패 ${failed}명.${created ? ' 신규 회원의 초기 비밀번호는 학번 10자리입니다.' : ''}${incoming.length < membersToCreate.length ? ' 요청이 중단되어 미처리 회원이 있습니다. 결과를 확인해 주세요.' : ''}`);
      if (fromCsv) setCsvStep('complete');
      await refresh();
    } catch (err) { setError(callError(err)); }
    finally { setBusy(false); }
  }

  function startEdit(member: MemberRecord, mode: EditMode) {
    if (member.protected || (mode === 'details' && !canEditDetails) || (mode === 'permissions' && !isPresident)) return;
    setEditing({ ...member });
    setEditMode(mode);
    setPositionText(formatMemberValues(member.positions));
    setError(''); setMessage('');
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = { ...editing, positions: splitMemberValues(positionText) };
      if (editMode === 'sessions') await saveMemberSessions(updated, updated.sessions);
      else if (editMode === 'details') await saveMemberDetails(updated);
      else if (isPresident) await saveMemberPermissions({ ...updated, handoverAccess: updated.role === 'member' && updated.handoverAccess });
      setMessage(`${editing.name} 부원의 정보를 저장했습니다.`);
      setEditing(null);
      await refresh();
    } catch (err) { setError(callError(err)); }
    finally { setBusy(false); }
  }

  async function resetPassword(member: MemberRecord) {
    if (!isPresident || busy || member.protected || member.uid === currentUid) return;
    if (!window.confirm(`${member.name} 부원의 비밀번호를 현재 학번(${member.studentId})으로 초기화할까요? 기존 비밀번호는 사용할 수 없게 됩니다.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await resetMemberPassword(member);
      setMessage(`${member.name} 부원의 비밀번호를 현재 학번 10자리로 초기화했습니다.`);
    } catch (err) { setError(callError(err)); }
    finally { setBusy(false); }
  }

  async function removeMember(member: MemberRecord) {
    if (!isPresident || busy) return;
    if (member.role !== 'member' || member.handoverAccess || member.protected) {
      notify('권한이 부여된 인원은 삭제할 수 없습니다. 먼저 권한을 해제해주세요.');
      return;
    }
    if (member.uid === currentUid) return;
    const typed = window.prompt(`${member.name} (${member.studentId}) 부원을 완전히 삭제하려면 학번 10자리를 입력해 주세요.\\nFirebase 로그인 계정과 부원 프로필이 삭제됩니다.`);
    if (typed !== member.studentId) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await deleteMember(member);
      setEditing(null);
      setMessage(`${member.name} 부원의 계정과 프로필을 삭제했습니다.`);
      await refresh();
    } catch (err) { setError(callError(err)); }
    finally { setBusy(false); }
  }

  const filtered = members.filter(member => [member.studentId, member.name, member.generation, ...member.sessions, ...member.positions]
    .some(value => String(value).toLowerCase().includes(query.trim().toLowerCase())));
  const progressPercent = preview.length > 0 ? Math.min(100, Math.round((progressDone / preview.length) * 100)) : 0;

  return <section className="container section-block" data-async-busy={busy||checkingPreview ? "true" : undefined}>
    <div className="member-layout">
      <nav className="member-tabs" aria-label="부원 관리 기능">
        <button type="button" className={tab === 'list' ? 'active' : ''} onClick={() => {setEditing(null);setTab('list');}}>부원 명단</button>
        {isPresident && <button type="button" className={tab === 'add' ? 'active' : ''} onClick={() => {setEditing(null);setTab('add');}}>신입부원 등록</button>}
      </nav>
      <div className="member-panel">


        {tab === 'list' && <>
          <div className="member-panel-top"><div><h2>부원 명단</h2><p>전체 가나다순을 유지하면서 스크롤 위치에 맞춰 30명씩 자동으로 불러옵니다. 권한에 따라 수정 가능한 항목이 다릅니다.</p></div>
            {isPresident && <button type="button" className="button button-primary" onClick={() => setTab('add')}><Plus size={16}/> 부원 등록</button>}</div>
          <div className="member-toolbar">
            <label className="input-search member-search"><Search size={16}/><input placeholder="학번, 이름, 기수, 세션 검색" aria-label="회원 검색" value={query} onChange={event => setQuery(event.target.value)}/></label>
            <button type="button" className="outline-action" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15}/> 새로고침</button>
          </div>
          <div className="member-live-list">
            <div className="member-live-head"><span>부원</span><span>기수 · 세션</span><span>직책 · 권한</span><span>관리</span></div>
            {filtered.map(member => <div className="member-entry" key={member.uid}>
              <div className="member-live-row">
                <div><strong>{member.name}</strong><small>{member.studentId}</small></div>
                <div><span>{member.generation}기</span><small>{formatMemberValues(member.sessions)}</small></div>
                <div><span>{formatMemberValues(member.positions) || '일반부원'}</span><small>{member.role === 'member' && member.handoverAccess ? 'OB 운영진' : roleNames[member.role]}{member.protected ? ' · 시스템 관리자' : ''}</small></div>
                <div className="member-actions">
                  <button type="button" className="outline-action" disabled={busy || member.protected} onClick={() => startEdit(member,'sessions')}>세션 수정</button>
                  {canEditDetails && <button type="button" className="outline-action" disabled={busy || member.protected} onClick={() => startEdit(member,'details')}>정보 수정</button>}
                  {isPresident && <>
                    <button type="button" className="outline-action" disabled={busy || member.protected || member.uid === currentUid} onClick={() => startEdit(member,'permissions')}>권한 수정</button>
                    <button type="button" className="outline-action" disabled={busy || member.protected || member.uid === currentUid} onClick={() => void resetPassword(member)}><KeyRound size={13}/> 비밀번호 초기화</button>
                    <button type="button" className={"outline-action member-danger"+(member.role !== 'member' || member.handoverAccess || member.protected ? " member-danger-restricted" : "")} aria-disabled={member.role !== 'member' || member.handoverAccess || member.protected || member.uid === currentUid} disabled={busy || (member.uid === currentUid && member.role === 'member' && !member.handoverAccess && !member.protected)} onClick={() => void removeMember(member)}><Trash2 size={13}/> 삭제</button>
                  </>}
                </div>
              </div>
              {editing?.uid === member.uid && <form onSubmit={event => void saveEdit(event)} className="member-permission-form member-inline-edit" aria-label={`${member.name} 부원 정보 수정`}>
                <div className="member-selected"><strong>{editing.name} · {editMode === 'sessions' ? '세션 수정' : editMode === 'details' ? '기본 정보 수정' : '권한 수정'}</strong><span>{editing.studentId} · {editing.generation}기</span></div>
                {editMode === 'sessions' && <div className="member-session-editor">
                  <strong>참여 세션 (1개 이상)</strong>
                  <div>{sessionList.map(session => <label key={session}><input type="checkbox" checked={editing.sessions.includes(session)} onChange={() => setEditing(prev => prev ? {...prev, sessions: prev.sessions.includes(session) ? prev.sessions.filter(value => value !== session) : [...prev.sessions,session]} : prev)}/>{session}</label>)}</div>
                </div>}
                {editMode === 'details' && canEditDetails && <>
                  <div className="form-grid">
                    <label>이름<input value={editing.name} maxLength={60} required onChange={event => setEditing(prev => prev ? {...prev,name:event.target.value} : prev)}/></label>
                    <label>학번<input value={editing.studentId} inputMode="numeric" maxLength={10} required onChange={event => setEditing(prev => prev ? {...prev,studentId:event.target.value.replace(/\D/g,'')} : prev)}/></label>
                    <label>기수<input value={editing.generation} maxLength={20} required onChange={event => setEditing(prev => prev ? {...prev,generation:event.target.value} : prev)}/></label>
                    <label>직책<input value={positionText} onChange={event => setPositionText(event.target.value)} placeholder="홍보부장,총무"/></label>
                  </div>
                  <p className="form-hint">학번을 바꾸면 로그인할 때 사용하는 학번도 함께 바뀝니다. 비밀번호는 변경되지 않습니다.</p>
                </>}
                {editMode === 'permissions' && isPresident && <>
                  <label>운영 권한
                    <select value={editing.role} onChange={event => setEditing(prev => prev ? {...prev,role:event.target.value as MemberRole,handoverAccess:event.target.value === 'member' && prev.handoverAccess} : prev)}>
                      {Object.entries(roleNames).map(([key,value]) => <option key={key} value={key}>{value}</option>)}
                    </select>
                  </label>
                  {editing.role === 'member' && <label className="member-handover-check"><input type="checkbox" checked={editing.handoverAccess} onChange={event => setEditing(prev => prev ? {...prev,handoverAccess:event.target.checked} : prev)}/>
                    <span><strong>인수인계 내용 접근 권한 설정</strong><small>체크하면 해당 부원의 권한에 'OB 운영진'이라고 표시됩니다. 인수인계 내용에 접근할 수 있지만 다른 운영진 권한은 부여되지 않습니다.</small></span>
                  </label>}
                  <p className="form-hint">본인과 시스템 관리자 계정의 권한은 변경할 수 없습니다.</p>
                </>}
                <div className="member-edit-actions">
                  <button type="submit" className="button button-primary" disabled={busy || (editMode === 'sessions' && editing.sessions.length === 0)}>{busy ? '저장 중...' : '변경 사항 저장'} <Check size={16}/></button>
                  <button type="button" className="outline-action" disabled={busy} onClick={() => setEditing(null)}>취소</button>
                </div>
              </form>}
            </div>)}
            {!loading && filtered.length === 0 && <div className="member-empty"><Users size={19}/> {members.length ? '현재 불러온 명단에서 검색 결과가 없습니다.' : '등록된 부원이 없습니다.'}</div>}
            {loading && members.length===0 && <LoadingText>부원 명단을 불러오는 중입니다.</LoadingText>}
          </div>
          {cursor && <>
            <div ref={loadSentinelRef} className="member-scroll-sentinel" aria-hidden="true" />
            {loading && <p className="member-scroll-status is-fetching" role="status">다음 부원 명단을 불러오는 중입니다...</p>}
            {loadError && <button type="button" className={loading?"outline-action member-loadmore is-fetching":"outline-action member-loadmore"} disabled={loading} onClick={() => void loadMore()}>불러오기 다시 시도 <RefreshCw size={15}/></button>}
            <p className="form-hint">스크롤을 내리면 다음 명단이 자동으로 표시됩니다. 검색은 현재 불러온 명단에 적용됩니다.</p>
          </>}
          <p className="form-hint">시스템 관리자 계정은 보호되며, 본인의 권한 변경·계정 삭제·비밀번호 초기화도 제한됩니다.</p>
        </>}

        {tab === 'add' && isPresident && <>
          <div className="member-panel-top"><div><h2>신입부원 등록</h2><p>새로 등록하는 부원은 모두 일반부원으로 생성됩니다. 권한은 부원 명단에서 변경할 수 있고, 초기 비밀번호는 학번 10자리와 같습니다.</p></div></div>
          <div className="member-registration">
            <div className="member-upload">
              <div className="member-upload-title"><FileSpreadsheet size={22}/><div><strong>CSV 일괄 등록</strong><p>UTF-8 CSV · 최대 60명 · 학번, 이름, 기수, 세션, 직책(선택)</p></div></div>
              <div className="member-steps" aria-label="CSV 등록 절차">
                {([['choose','1. CSV 추가'],['review','2. 명단 확인'],['complete','3. 등록 완료']] as const).map(([step,label]) =>
                  <span key={step} className={csvStep === step ? 'active' : ''} aria-current={csvStep === step ? 'step' : undefined}>{label}</span>)}
              </div>
              {csvStep === 'choose' && <>
                <p className="profile-help">부원 CSV를 선택하면 바로 계정을 만들지 않고 등록 예정 명단을 먼저 보여줍니다. 여러 세션·직책은 쉼표로 구분하고, CSV 셀은 "기타,베이스"처럼 큰따옴표로 감싸 주세요. 쉼표 뒤 공백은 자동으로 제거합니다.</p>
                <div className="member-upload-actions">
                  <label className="button button-primary member-file-picker"><Upload size={15}/> CSV 파일 선택<input type="file" accept=".csv,text/csv" onChange={event => void selectCsv(event)} /></label>
                  <button type="button" className="outline-action" onClick={downloadExampleCsv}><Download size={15}/> 양식 내려받기</button>
                </div>
              </>}
              {csvStep === 'review' && <>
                <div className="member-preview">
                  <h3>등록 전 명단 확인 · 총 {preview.length}명</h3>
                  {checkingPreview ? <p className="member-progress" role="status">Firebase에서 이미 등록된 학번을 확인 중입니다...</p> : Object.keys(previewStatuses).length === preview.length && <div className="member-result-counts">
                    <span>신규 등록 예상: {preview.filter(member => previewStatuses[member.studentId] === 'new').length}명</span>
                    <span>기존 계정: {preview.filter(member => previewStatuses[member.studentId] === 'existing').length}명</span>
                  </div>}
                  <p className="form-hint member-csv-preview-hint">파일: {fileName} · 아래 회원을 모두 확인해 주세요. 이미 가입한 학번은 덮어쓰지 않고 건너뜁니다.</p>
                  <div className="member-preview-scroll"><table><thead><tr><th>학번</th><th>이름</th><th>기수</th><th>세션</th><th>직책</th><th>등록 예상</th></tr></thead>
                    <tbody>{preview.map(member => <tr key={member.studentId}><td>{member.studentId}</td><td>{member.name}</td><td>{member.generation}</td><td>{formatMemberValues(member.sessions)}</td><td>{formatMemberValues(member.positions) || '—'}</td><td>{previewStatuses[member.studentId] === 'new' ? '신규 생성' : previewStatuses[member.studentId] === 'existing' ? '기존 계정' : '확인 중'}</td></tr>)}</tbody>
                  </table></div>
                  {busy && <div className="member-progress-area"><p className="member-progress" role="status">계정 등록 진행률: {progressPercent}%</p><progress className="member-progress-bar" max={100} value={progressPercent} aria-label="CSV 회원 등록 진행률" /></div>}
                  <div className="member-upload-actions">
                    <button type="button" className="outline-action" disabled={busy} onClick={() => {++previewRequest.current;setCsvStep('choose');setPreview([]);setPreviewStatuses({});setFileName('');setMessage('');}}>다른 파일 선택</button>
                    {!checkingPreview && Object.keys(previewStatuses).length !== preview.length && <button type="button" className="outline-action" onClick={() => {setError(''); void inspectPreview(preview,previewRequest.current);}}>기존 계정 다시 확인</button>}
                    <button type="button" className="button button-primary" disabled={busy || checkingPreview || preview.length === 0 || Object.keys(previewStatuses).length !== preview.length} onClick={() => void submit(preview,true)}>{busy ? '등록 처리 중...' : `확인한 ${preview.length}명 등록 실행`} <ArrowRight size={15}/></button>
                  </div>
                  <p className="form-hint">확인 버튼을 누른 뒤에만 계정이 생성됩니다. 신규 계정의 초기 비밀번호는 학번이고 기존 계정은 변경되지 않습니다.</p>
                </div>
              </>}
              {csvStep === 'complete' && <div className="member-result">
                <h3>CSV 등록 완료 · 총 {results.length}명 처리</h3>
                <div className="member-result-counts">
                  <span>신규 생성: {results.filter(entry => entry.status === 'created').length}명</span>
                  <span>기존 계정: {results.filter(entry => entry.status === 'existing').length}명</span>
                  <span>실패·확인 필요: {results.filter(entry => entry.status === 'error').length}명</span>
                </div>
                <p>새로 생성된 계정의 <strong>초기 비밀번호는 각자의 학번 10자리</strong>입니다. 기존 계정의 비밀번호는 변경하지 않았습니다. 로그인 문제가 생기면 운영진에게 문의하도록 안내해 주세요.</p>
                <div className="member-result-list">{results.map((entry, i) => <div key={i}><span>{entry.name} · {entry.studentId}{entry.message ? ' — ' + entry.message : ''}</span><strong>{entry.status === 'created' ? '신규 생성' : entry.status === 'existing' ? '기존 계정' : '확인 필요'}</strong></div>)}</div>
                <div className="member-upload-actions">
                  <button type="button" className="outline-action" onClick={() => {setCsvStep('choose');setPreview([]);setResults([]);setFileName('');setMessage('');}}>다른 명단 등록</button>
                </div>
              </div>}
            </div>
            {csvStep === 'choose' && <div className="member-single"><h3>한 명씩 등록</h3>
              <form onSubmit={event => { event.preventDefault(); void submit([{...individual, positions: splitMemberValues(individualPositionsText)}]); }} className="member-form">
                <div className="form-grid">
                  <label>학번<input inputMode="numeric" maxLength={10} value={individual.studentId} placeholder="학번 10자리" onChange={event => setIndividual(previous => ({...previous, studentId: event.target.value.replace(/\D/g, '')}))} required /></label>
                  <label>이름<input value={individual.name} placeholder="이름" onChange={event => setIndividual(previous => ({...previous, name: event.target.value}))} required /></label>
                  <label>기수<input value={individual.generation} placeholder="예: 29 또는 27.5" onChange={event => setIndividual(previous => ({...previous, generation: event.target.value}))} required /></label>
                  <label>직책 (선택)<input value={individualPositionsText} placeholder="여러 직책은 쉼표로 구분 (예: 홍보부장,총무)" onChange={event => setIndividualPositionsText(event.target.value)}/></label>
                </div>
                <div className="member-session-editor"><strong>세션</strong><div>{sessionList.map(session => <label key={session}><input type="checkbox" checked={individual.sessions.includes(session)} onChange={() => setIndividual(previous => ({...previous, sessions: previous.sessions.includes(session) ? previous.sessions.filter(item => item !== session) : [...previous.sessions, session]}))}/>{session}</label>)}</div></div>
                <button type="submit" className="button button-primary" disabled={busy || individual.studentId.length !== 10 || individual.sessions.length === 0}>{busy ? '등록 중...' : '회원 등록'} <ArrowRight size={15}/></button>
              </form>
              {results.length > 0 && <div className="member-result">
                <h3>개별 등록 결과</h3>
                {results.map((entry,i) => <p key={i}>{entry.name} · {entry.studentId}: {entry.status === 'created' ? '신규 생성' : entry.status === 'existing' ? '기존 계정' : '확인 필요'}{entry.message ? ' — ' + entry.message : ''}</p>)}
                {results.some(entry => entry.status === 'created') && <p>신규 회원의 초기 비밀번호는 학번 10자리입니다. 로그인 문제가 발생하면 운영진에게 문의하도록 안내해 주세요.</p>}
              </div>}
            </div>}
          </div>
        </>}


      </div>
    </div>
  </section>;
}
