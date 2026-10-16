import {useCallback,useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,CalendarDays,Mail,Plus,Users,X} from 'lucide-react';
import {listInvitations,listSchedules,respondInvitation} from './scheduleApi';
import type {Invitation,ScheduleSummary} from './scheduleApi';

export function ScheduleLanding({canCreateTeam,loggedIn,authPending,onLogin,onCreate,onCreateTeam,onOpen}:{
 canCreateTeam:boolean;loggedIn:boolean;authPending:boolean;onLogin:()=>void;
 onCreate:()=>void;onCreateTeam:()=>void;onOpen:(id:string)=>void;
}){
 const [invitationsOpen,setInvitationsOpen]=useState(false);
 const [schedules,setSchedules]=useState<ScheduleSummary[]>([]);
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState<string|null>(null);
 const refresh=useCallback(async()=>{
  if(!loggedIn){setSchedules([]);setInvitations([]);setLoading(false);return;}
  setLoading(true);
  try{
   const [items,invites]=await Promise.all([listSchedules(),listInvitations()]);
   setSchedules(items);setInvitations(invites);setError('');
  }catch(e){setError(e instanceof Error?e.message:'시간표를 가져오지 못했습니다.');}
  finally{setLoading(false);}
 },[loggedIn]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!loggedIn)return;
  const onFocus=()=>{void refresh();};
  window.addEventListener('focus',onFocus);
  return()=>window.removeEventListener('focus',onFocus);
 },[loggedIn,refresh]);
 useEffect(()=>{
  if(!invitationsOpen)return;
  const old=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setInvitationsOpen(false);};
  window.addEventListener('keydown',escape);
  return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',escape);};
 },[invitationsOpen,busy]);
 async function act(id:string,action:'accept'|'decline'){
  if(busy)return;
  setBusy(id);
  try{
   await respondInvitation(id,action);
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'초대 처리에 실패했습니다.');}
  finally{setBusy(null);}
 }
 return <>
  <div className="page-heading container"><span className="eyebrow">WHEN2MEET</span>
   <h1>합주 시간 조율</h1><p>새 시간표를 만들거나, 내가 참여한 합주 시간표를 확인하세요.</p>
  </div>
  <aside className="container schedule-usage-guide" aria-label="시간표 사용 안내">
   <div className="schedule-usage-heading"><strong>시간표 사용 안내</strong></div>
   <ol className="schedule-usage-list">
    <li><span aria-hidden="true">01</span><p>학번으로 다른 부원에게 초대를 보내고, 수락하면 함께 시간을 조율할 수 있습니다.</p></li>
    <li><span aria-hidden="true">02</span><p>30분 단위로 가능한 시간을 선택하고 저장하기를 눌러 반영합니다.</p></li>
    <li><span aria-hidden="true">03</span><p>합주 시간 확정 및 구성팀 시간표는 추후 연결할 예정입니다.</p></li>
   </ol>
  </aside>
  <section className="container section-block schedule-landing">
   <div className="schedule-action-grid">
    <button type="button" className="schedule-create-card" onClick={loggedIn?onCreate:onLogin}>
     <span className="schedule-action-icon"><Plus size={25} aria-hidden="true"/></span>
     <span className="schedule-action-text"><strong>시간표 만들기</strong><small>함께 합주할 사람들과 가능한 시간을 조율해 보세요.</small></span>
     <ArrowUpRight size={19} aria-hidden="true"/>
    </button>
    {canCreateTeam&&<button type="button" className="schedule-create-card schedule-create-card-team" onClick={onCreateTeam}>
     <span className="schedule-action-icon"><Users size={25} aria-hidden="true"/></span>
     <span className="schedule-action-text"><strong>구성팀 시간표 만들기</strong><small>공연 구성팀의 합주 시간을 조율하는 시간표입니다.</small></span>
     <ArrowUpRight size={19} aria-hidden="true"/>
    </button>}
   </div>
  </section>
  <section className="container section-block schedule-list-section">
   <div className="section-heading"><div><h2>내가 참여한 시간표</h2>
    <p>직접 만들었거나 초대를 수락한 시간표만 표시됩니다.</p></div>
    <button type="button" className="schedule-list-count schedule-invitation-trigger" disabled={!loggedIn||authPending}
     onClick={()=>{setInvitationsOpen(true);void refresh();}} aria-haspopup="dialog">
     <Mail size={15} aria-hidden="true"/> 초대 {invitations.length}건
    </button>
   </div>
   {error&&<p className="schedule-side-warning" role="alert">{error}</p>}
   {loading?<p>시간표를 불러오는 중입니다.</p>:!loggedIn?<p>로그인하면 시간표와 받은 초대를 확인할 수 있습니다.</p>:
   schedules.length===0?<p className="schedule-draft-empty-roster">참여한 시간표가 없습니다.</p>:
   <div className="schedule-list" role="list">{schedules.map(schedule=><div className="schedule-list-item" role="listitem" key={schedule.id}>
    <div className="schedule-list-icon"><CalendarDays size={21} aria-hidden="true"/></div>
    <div className="schedule-list-content"><div className="schedule-list-meta"><span>{schedule.participantCount}명 참여 · {schedule.dates.length}개 후보 날짜</span></div>
     <h3>{schedule.title}</h3></div>
    <button type="button" className="outline-action schedule-open-button" onClick={()=>onOpen(schedule.id)}>시간표 열기 <ArrowRight size={16} aria-hidden="true"/></button>
   </div>)}</div>}
  </section>
  {invitationsOpen&&<div className="schedule-roster-backdrop" role="presentation"
   onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setInvitationsOpen(false);}}>
   <div className="schedule-roster-dialog schedule-invitations-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-invitations-title">
    <div className="schedule-roster-dialog-header"><div><h2 id="schedule-invitations-title">받은 시간표 초대</h2>
     <p>초대를 수락하면 내 시간표 목록에 추가됩니다.</p></div>
     <button type="button" aria-label="받은 초대 창 닫기" onClick={()=>setInvitationsOpen(false)} disabled={Boolean(busy)}><X size={21}/></button></div>
    {invitations.length===0?<p className="schedule-invitations-empty">수락 대기중인 시간표가 없습니다</p>:
    <div className="schedule-invitations-list">{invitations.map(inv=><article key={inv.id} className="schedule-invitations-item">
     <div className="schedule-invitations-details"><span>초대한 사람 · {inv.inviterName}</span><h3>{inv.title}</h3></div>
     <div className="schedule-invitations-actions">
      <button type="button" className="button button-primary" disabled={Boolean(busy)} onClick={()=>void act(inv.id,'accept')}>수락</button>
      <button type="button" className="outline-action" disabled={Boolean(busy)} onClick={()=>void act(inv.id,'decline')}>거절</button>
     </div>
    </article>)}</div>}
    <div className="schedule-invitations-footer"><button type="button" className="outline-action" onClick={()=>setInvitationsOpen(false)} disabled={Boolean(busy)}>닫기</button></div>
   </div>
  </div>}
 </>;
}
