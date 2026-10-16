import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {ArrowLeft,Check,Trash2,Users,X} from 'lucide-react';
import {decodeBits,encodeBits,rectangleTimeSelection,blockKey} from './scheduleGrid';
import {getSchedule,inviteMember,removeScheduleMember,saveAvailability} from './scheduleApi';
import type {ScheduleDetailData} from './scheduleApi';

type Cell={day:number;slot:number};
type Stroke={pointerId:number;start:Cell;baseline:Set<string>;select:boolean;lastKey:string};
const weekdays=['일','월','화','수','목','금','토'];
const formatTime=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function shortDate(day:string){
 const [year,month,date]=day.split('-').map(Number);
 return month+'/'+date+' ('+weekdays[new Date(Date.UTC(year,month-1,date)).getUTCDay()]+')';
}
const LEAVE_MESSAGE='페이지를 나가겠습니까? 진행상황은 저장되지 않습니다';
export default function ScheduleRoom({id,onBack,registerLeaveGuard}:{
 id:string;onBack:()=>void;registerLeaveGuard:(guard:(()=>boolean)|null)=>void;
}){
 const [data,setData]=useState<ScheduleDetailData|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const [savedBits,setSavedBits]=useState('');
 const [version,setVersion]=useState('');
 const [chosen,setChosen]=useState<string[]>([]);
 const [mode,setMode]=useState<'all'|'everyone'>('all');
 const [saving,setSaving]=useState(false),[rosterOpen,setRosterOpen]=useState(false);
 const [studentId,setStudentId]=useState(''),[inviteBusy,setInviteBusy]=useState(false);
 const [notice,setNotice]=useState(''),[selectedCell,setSelectedCell]=useState<Cell|null>(null);
 const stroke=useRef<Stroke|null>(null);
 async function refresh(){
  setLoading(true);setError('');
  try{
   const result=await getSchedule(id),self=result.people.find(p=>p.uid===result.viewerUid);
   if(!self||!self.availability||!self.updateTime)throw new Error('본인의 시간표 데이터가 없습니다.');
   setData(result);
   setChosen(result.people.map(p=>p.uid));
   setSelected(decodeBits(self.availability,result.schedule.dates,result.schedule.startHour,result.schedule.endHour));
   setSavedBits(self.availability);setVersion(self.updateTime);
  }catch(e){setError(e instanceof Error?e.message:'시간표를 열 수 없습니다.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[id]);
 const schedule=data?.schedule;
 const dates=schedule?.dates??[];
 const slots=useMemo(()=>schedule?Array.from({length:(schedule.endHour-schedule.startHour)*2},(_,i)=>schedule.startHour*60+i*30):[],[schedule]);
 const bits=schedule?encodeBits(selected,dates,schedule.startHour,schedule.endHour):'';
 const dirty=Boolean(data)&&bits!==savedBits;
 const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
 useEffect(()=>{
  registerLeaveGuard(()=>!dirtyRef.current||window.confirm(LEAVE_MESSAGE));
  return()=>registerLeaveGuard(null);
 },[registerLeaveGuard]);
 useEffect(()=>{
  if(!dirty)return;
  const onBeforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',onBeforeUnload);
  return()=>window.removeEventListener('beforeunload',onBeforeUnload);
 },[dirty]);
 useEffect(()=>{
  if(!rosterOpen)return;
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!inviteBusy)setRosterOpen(false);};
  window.addEventListener('keydown',esc);
  return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',esc);};
 },[rosterOpen,inviteBusy]);
 useEffect(()=>{
  if(!notice)return;
  const timeout=window.setTimeout(()=>setNotice(''),3500);
  return()=>window.clearTimeout(timeout);
 },[notice]);
 function paint(start:Cell,end:Cell,baseline:ReadonlySet<string>,select:boolean){
  setSelected(rectangleTimeSelection(baseline,dates,slots,start,end,select));
 }
 function startStroke(e:ReactPointerEvent<HTMLDivElement>){
  if(saving||(!e.isPrimary)||(e.pointerType==='mouse'&&e.button!==0))return;
  const target=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-draft-block]');
  if(!target)return;
  const day=Number(target.dataset.day),slot=Number(target.dataset.slot),key=blockKey(dates[day],slots[slot]);
  if(!dates[day]||slots[slot]===undefined)return;
  e.preventDefault();
  const baseline=new Set(selected),select=!baseline.has(key);
  stroke.current={pointerId:e.pointerId,start:{day,slot},baseline,select,lastKey:key};
  paint({day,slot},{day,slot},baseline,select);
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function moveStroke(e:ReactPointerEvent<HTMLDivElement>){
  const active=stroke.current;
  if(!active||active.pointerId!==e.pointerId)return;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLButtonElement>('[data-draft-block]');
  if(!target)return;
  const day=Number(target.dataset.day),slot=Number(target.dataset.slot),key=blockKey(dates[day],slots[slot]);
  if(!dates[day]||slots[slot]===undefined||key===active.lastKey)return;
  active.lastKey=key;paint(active.start,{day,slot},active.baseline,active.select);
 }
 function endStroke(e:ReactPointerEvent<HTMLDivElement>){
  if(stroke.current?.pointerId!==e.pointerId)return;
  stroke.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }
 function cancelStroke(e:ReactPointerEvent<HTMLDivElement>){
  if(stroke.current?.pointerId!==e.pointerId)return;
  setSelected(stroke.current.baseline);endStroke(e);
 }
 function keyboardToggle(day:number,slot:number){
  if(saving)return;
  const key=blockKey(dates[day],slots[slot]);
  paint({day,slot},{day,slot},selected,!selected.has(key));
 }
 async function save(){
  if(!schedule||!dirty||saving)return;
  setSaving(true);setError('');
  try{
   const result=await saveAvailability(id,bits,version);
   setVersion(result.updateTime);setSavedBits(bits);setNotice('변경 사항을 저장했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'저장에 실패했습니다.');}
  finally{setSaving(false);}
 }
 async function invite(){
  if(!schedule||inviteBusy||!/^[0-9]{10}$/.test(studentId))return;
  setInviteBusy(true);setError('');
  try{
   const result=await inviteMember(id,studentId);
   setNotice(result.message);setStudentId('');
  }catch(e){setError(e instanceof Error?e.message:'초대 요청에 실패했습니다.');}
  finally{setInviteBusy(false);}
 }
 async function remove(uid:string,name:string){
  if(!window.confirm(name+'을 명단에서 제외하시겠습니까?'))return;
  setInviteBusy(true);
  try{
   await removeScheduleMember(id,uid);
   // Keep unsaved local availability when the roster changes.
   const updated=await getSchedule(id);
   setData(updated);
   setChosen(current=>current.filter(item=>item!==uid));
   setNotice('명단에서 제외했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'제외에 실패했습니다.');}
  finally{setInviteBusy(false);}
 }
 const people=data?.people??[];
 const active=people.filter(p=>chosen.includes(p.uid));
 const ownUid=data?.viewerUid??'';
 const decodedOthers=useMemo(()=>{
  const map=new Map<string,Set<string>>();
  if(!schedule||!data)return map;
  for(const p of data.people)if(p.uid!==data.viewerUid&&p.availability){
   try{map.set(p.uid,decodeBits(p.availability,schedule.dates,schedule.startHour,schedule.endHour));}catch{}
  }
  return map;
 },[data,schedule]);
 function visibleCount(key:string){return active.filter(p=>p.uid===ownUid?selected.has(key):decodedOthers.get(p.uid)?.has(key)).length;}
 const ticks=schedule?Array.from({length:slots.length+1},(_,i)=>schedule.startHour*60+i*30)
  .filter((time,i)=>time%60===0||i===0||i===slots.length):[];
 return <>
  <div className="page-heading container"><span className="eyebrow">SCHEDULE</span><h1>{schedule?.title??'합주 시간표'}</h1></div>
  <section className="container section-block schedule-detail schedule-draft-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 내가 참여한 시간표 목록</button>
   {loading?<p>시간표를 불러오는 중입니다.</p>:!schedule?<p role="alert">{error||'시간표를 찾을 수 없습니다.'}</p>:<>
    <div className="schedule-detail-heading"><div><h2>시간 조율 현황</h2></div>
     {schedule.createdBy===ownUid&&<button type="button" className="outline-action schedule-roster-edit-trigger"
      onClick={()=>setRosterOpen(true)}><Users size={16}/> 명단 수정</button>}
    </div>
    <div className="schedule-detail-layout">
     <div className="schedule-timetable-panel">
      <p className="schedule-draft-help">30분 칸을 누르거나 드래그하여 본인의 가능한 시간을 선택하세요.</p>
      <div className="schedule-timetable-scroll" role="region" aria-label="합주 시간표 (가로 스크롤 가능)" tabIndex={0}>
       <div className="schedule-timetable-inner" style={{width:64+dates.length*70}}>
        <div className="schedule-date-header" style={{gridTemplateColumns:'64px repeat('+dates.length+', 70px)'}}>
         <span className="schedule-date-corner">시간</span>
         {dates.map(date=><span key={date} className="schedule-date-label">{shortDate(date)}</span>)}
        </div>
        <div className="schedule-time-body" style={{gridTemplateColumns:'64px repeat('+dates.length+', 70px)'}}
         onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={endStroke}
         onPointerCancel={cancelStroke} onLostPointerCapture={()=>{stroke.current=null;}}>
         <div className="schedule-time-axis" style={{height:slots.length*20}}>
          {ticks.map(time=><span key={time} className="schedule-time-tick" style={{top:(time-schedule.startHour*60)/30*20}}>{formatTime(time)}</span>)}
         </div>
         {dates.map((date,day)=><div key={date} className="schedule-day-slots">{slots.map((time,slot)=>{
          const key=blockKey(date,time),total=active.length,available=visibleCount(key);
          const isSelected=total>0&&(mode==='all'?available>0:available===total);
          const shade=total?Math.round(35+50*available/total):0;
          return <button type="button" key={key} data-draft-block={key} data-day={day} data-slot={slot}
           className={'schedule-time-slot schedule-draft-block'+(time%60===0?' starts-hour':'')+(isSelected?' is-selected':'')}
           style={{backgroundColor:isSelected?`color-mix(in srgb,var(--accent) ${shade}%,white)`:'#fff'}}
           aria-pressed={selected.has(key)}
           aria-label={shortDate(date)+' '+formatTime(time)+'–'+formatTime(time+30)+(selected.has(key)?' 내 가능 시간 선택됨':' 내 가능 시간 미선택')}
           onClick={event=>{if(event.detail===0)keyboardToggle(day,slot);}}
           onMouseEnter={()=>setSelectedCell({day,slot})}
           onMouseLeave={()=>setSelectedCell(null)} onFocus={()=>setSelectedCell({day,slot})}/>;
         })}</div>)}
        </div>
       </div>
      </div>
      <p className="schedule-detail-footnote">한 칸은 30분입니다.</p>
     </div>
     <aside className="schedule-people-panel schedule-draft-people-panel" aria-label="시간표 필터 및 현재 명단">
      <span className="schedule-side-eyebrow">시간표 표시</span>
      <div className="schedule-filter-options" role="group" aria-label="가능 시간 표시 방법">
       <button type="button" className={mode==='all'?'selected':''} aria-pressed={mode==='all'} onClick={()=>setMode('all')}>모임 전체</button>
       <button type="button" className={mode==='everyone'?'selected':''} aria-pressed={mode==='everyone'} onClick={()=>setMode('everyone')}>모두 되는 시간</button>
      </div>
      <div className="schedule-people-heading"><strong>현재 명단 ({people.length})</strong>
       <button type="button" onClick={()=>setChosen(people.map(p=>p.uid))}>모두 선택</button></div>
      <div className="schedule-people-list">{people.map(p=><label key={p.uid} className="schedule-person-option">
       <input type="checkbox" checked={chosen.includes(p.uid)}
        onChange={()=>setChosen(current=>current.includes(p.uid)?current.filter(id=>id!==p.uid):[...current,p.uid])}/>
       <span className="schedule-person-icon"><Users size={14}/></span>
       <span>{p.name}{p.uid===ownUid?' (나)':''}</span>
      </label>)}</div>
      {selectedCell&&<p className="schedule-draft-hover">{shortDate(dates[selectedCell.day])} · {formatTime(slots[selectedCell.slot])}–{formatTime(slots[selectedCell.slot]+30)}</p>}
      {active.length===0&&<p className="schedule-side-warning">표시할 사람을 한 명 이상 선택해 주세요.</p>}
     </aside>
    </div>
    <div className="schedule-draft-save-row">
     {dirty&&<span className="schedule-unsaved-message">저장되지 않은 변경 사항이 있습니다.</span>}
     <button type="button" className="button button-primary" disabled={!dirty||saving} onClick={()=>void save()}>
      {saving?'저장 중…':'저장하기'}</button>
    </div>
    {error&&<p role="alert" className="schedule-side-warning">{error}</p>}
   </>}
  </section>
  {rosterOpen&&schedule&&<div className="schedule-roster-backdrop" role="presentation"
   onMouseDown={e=>{if(e.target===e.currentTarget&&!inviteBusy)setRosterOpen(false);}}>
   <div className="schedule-roster-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-roster-title">
    <div className="schedule-roster-dialog-header"><div><h2 id="schedule-roster-title">명단 수정</h2>
     <p>학번으로 초대할 수 있습니다. 수락 전에는 초대 대상의 이름이 공개되지 않습니다.</p></div>
     <button type="button" aria-label="명단 수정 창 닫기" onClick={()=>setRosterOpen(false)} disabled={inviteBusy}><X size={21}/></button>
    </div>
    <h3>현재 명단 ({people.length})</h3>
    <div className="schedule-roster-list">{people.map(p=><div key={p.uid}><span><Users size={15}/>{p.name}{p.uid===ownUid?' (나)':''}</span>
     {p.uid!==ownUid&&<button type="button" disabled={inviteBusy} onClick={()=>void remove(p.uid,p.name)}><Trash2 size={15}/> 제외</button>}
    </div>)}</div>
    <form className="schedule-roster-search-form" onSubmit={e=>{e.preventDefault();void invite();}}>
     <label htmlFor="schedule-invite-id">학번으로 초대</label>
     <div><input id="schedule-invite-id" type="text" inputMode="numeric" maxLength={10}
      pattern="[0-9]{10}" value={studentId} onChange={e=>setStudentId(e.target.value)}
      placeholder="학번을 입력하세요"/>
      <button type="submit" className="button button-primary" disabled={inviteBusy||!/^[0-9]{10}$/.test(studentId)}>초대하기</button></div>
    </form>
    <div className="schedule-roster-footer"><span>상대방이 초대를 수락한 뒤에만 명단에 표시됩니다.</span>
     <button type="button" className="outline-action" onClick={()=>setRosterOpen(false)}>닫기</button>
    </div>
   </div>
  </div>}
  {notice&&<div className="toast schedule-invite-toast" role="status" aria-live="polite">
   <Check size={17}/><span>{notice}</span><button type="button" aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={15}/></button>
  </div>}
 </>;
}
