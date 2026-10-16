import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,FormEvent} from 'react';
import {ArrowLeft,Check,Search,Trash2,Users,X} from 'lucide-react';
import {getScheduleSlots} from './SchedulePages';
import {blockKey,draftFromRoute,INITIAL_DRAFT_PARTICIPANTS,mockFindInvitee,rectangleTimeSelection} from './scheduleDraftModel';

type CellPosition={day:number;slot:number};
type ViewMode='all'|'everyone';
type PersonAvailability=Record<string,Set<string>>;
type Stroke={pointerId:number;start:CellPosition;baseline:PersonAvailability;members:string[];activate:boolean;lastKey:string};
const weekdays=['일','월','화','수','목','금','토'];
function formatTime(value:number){
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
function shortDate(iso:string){
  const [year,month,day]=iso.split('-').map(Number);
  const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay();
  return month+'/'+day+' ('+weekdays[weekday]+')';
}

export default function ScheduleDraft({initial,onBack}:{initial:unknown;onBack:()=>void}){
  const draft=useMemo(()=>draftFromRoute(initial),[initial]);
  const [people,setPeople]=useState<string[]>(()=>[...INITIAL_DRAFT_PARTICIPANTS]);
  const [selectedNames,setSelectedNames]=useState<string[]>(()=>[...INITIAL_DRAFT_PARTICIPANTS]);
  const [mode,setMode]=useState<ViewMode>('all');
  // Empty local data for each example participant. It is not read from or saved to Firebase.
  const [availabilityByPerson,setAvailabilityByPerson]=useState<PersonAvailability>(()=>
    Object.fromEntries(INITIAL_DRAFT_PARTICIPANTS.map(name=>[name,new Set<string>()])));
  const [rosterOpen,setRosterOpen]=useState(false);
  const [studentId,setStudentId]=useState('');
  const [searched,setSearched]=useState(false);
  const [searchResult,setSearchResult]=useState<string|null>(null);
  const [inviteNotice,setInviteNotice]=useState('');
  const [selectedCell,setSelectedCell]=useState<CellPosition|null>(null);
  const stroke=useRef<Stroke|null>(null);
  const scrollRef=useRef<HTMLDivElement|null>(null);
  const slots=useMemo(()=>draft?getScheduleSlots(formatTime(draft.startHour*60),formatTime(draft.endHour*60)):[],[draft]);
  const dates=useMemo(()=>draft?.dates??[],[draft]);
  const columns='64px repeat('+dates.length+', 70px)';
  const tickTimes=useMemo(()=>Array.from({length:slots.length+1},(_,i)=>(draft?.startHour??0)*60+i*30)
    .filter((time,index)=>time%60===0||index===0||index===slots.length),[draft,slots.length]);

  useEffect(()=>{
    if(!rosterOpen)return;
    const old=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const handle=(event:KeyboardEvent)=>{if(event.key==='Escape')setRosterOpen(false);};
    window.addEventListener('keydown',handle);
    return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',handle);};
  },[rosterOpen]);

  useEffect(()=>{
    if(!inviteNotice)return;
    const timeout=window.setTimeout(()=>setInviteNotice(''),3500);
    return ()=>window.clearTimeout(timeout);
  },[inviteNotice]);

  const togglePerson=(name:string)=>{
    setSelectedNames(previous=>previous.includes(name)
      ?previous.filter(person=>person!==name):[...previous,name]);
  };
  const selectEveryone=()=>setSelectedNames([...people]);
  const availableCount=(key:string)=>selectedNames.filter(name=>availabilityByPerson[name]?.has(key)).length;
  function paintArea(baseline:PersonAvailability,members:string[],start:CellPosition,end:CellPosition,activate:boolean){
    const updated={...baseline};
    for(const name of members)updated[name]=rectangleTimeSelection(
      baseline[name]??new Set<string>(),dates,slots,start,end,activate);
    return updated;
  }
  function startStroke(event:ReactPointerEvent<HTMLDivElement>){
    if(!selectedNames.length)return;
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-draft-block]');
    if(!target)return;
    const day=Number(target.dataset.day),slot=Number(target.dataset.slot);
    const date=dates[day],time=slots[slot];
    if(date===undefined||time===undefined)return;
    event.preventDefault();
    const baseline=availabilityByPerson,key=blockKey(date,time);
    const activate=mode==='all'?availableCount(key)===0:availableCount(key)<selectedNames.length;
    stroke.current={pointerId:event.pointerId,start:{day,slot},baseline,members:[...selectedNames],activate,lastKey:key};
    setAvailabilityByPerson(paintArea(baseline,selectedNames,{day,slot},{day,slot},activate));
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveStroke(event:ReactPointerEvent<HTMLDivElement>){
    const active=stroke.current;
    if(!active||active.pointerId!==event.pointerId)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)
      ?.closest<HTMLButtonElement>('[data-draft-block]');
    if(!target)return;
    const day=Number(target.dataset.day),slot=Number(target.dataset.slot);
    const date=dates[day],time=slots[slot];
    if(date===undefined||time===undefined)return;
    const key=blockKey(date,time);
    if(active.lastKey===key)return;
    active.lastKey=key;
    setAvailabilityByPerson(paintArea(active.baseline,active.members,active.start,{day,slot},active.activate));
  }
  function endStroke(event:ReactPointerEvent<HTMLDivElement>){
    if(stroke.current?.pointerId!==event.pointerId)return;
    stroke.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function cancelStroke(event:ReactPointerEvent<HTMLDivElement>){
    if(stroke.current?.pointerId!==event.pointerId)return;
    setAvailabilityByPerson(stroke.current.baseline);
    endStroke(event);
  }
  function keyboardToggle(day:number,slot:number){
    const date=dates[day],time=slots[slot];
    if(date===undefined||time===undefined)return;
    const key=blockKey(date,time);
    if(!selectedNames.length)return;
    const activate=mode==='all'?availableCount(key)===0:availableCount(key)<selectedNames.length;
    setAvailabilityByPerson(previous=>paintArea(
      previous,selectedNames,{day,slot},{day,slot},activate));
  }
  function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setSearched(true);
    setSearchResult(mockFindInvitee(studentId));
  }
  function removeMember(name:string){
    if(!window.confirm(name+'을 명단에서 제외하시겠습니까?'))return;
    setPeople(current=>current.filter(person=>person!==name));
    setSelectedNames(current=>current.filter(person=>person!==name));
    setAvailabilityByPerson(current=>{
      const next={...current};
      delete next[name];
      return next;
    });
  }
  if(!draft)return <>
    <div className="page-heading container"><span className="eyebrow">SCHEDULE DRAFT</span><h1>임시 시간표</h1><p>시간표 생성 페이지에서 제목·후보 날짜·시간을 선택해 주세요.</p></div>
    <section className="container section-block schedule-detail">
      <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 시간표 만들기로 돌아가기</button>
      <p>저장된 시간표는 없습니다. 생성 화면에서 다시 설정할 수 있습니다.</p>
    </section>
  </>;

  return <>
    <div className="page-heading container"><span className="eyebrow">SCHEDULE DRAFT</span><h1>{draft.title}</h1>
      <p>시간표 구성 미리보기 · 아직 실제로 생성되거나 저장되지 않았습니다.</p></div>
    <section className="container section-block schedule-detail schedule-draft-page">
      <button type="button" className="schedule-back-button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true"/> 시간표 만들기로 돌아가기
      </button>
      <div className="schedule-detail-heading">
        <div>
          <span className="schedule-detail-label">임시 시간표 · 저장되지 않음</span>
          <h2>시간 조율 현황</h2>
          <p>{dates.length}개 후보 날짜 · {formatTime(draft.startHour*60)}–{formatTime(draft.endHour*60)} · {people.length}명 초대 명단</p>
        </div>
        <button type="button" className="outline-action schedule-roster-edit-trigger" onClick={()=>{setInviteNotice('');setRosterOpen(true);}}>
          <Users size={16} aria-hidden="true"/> 명단 수정
        </button>
      </div>
      <div className="schedule-detail-layout">
        <div className="schedule-timetable-panel">
          <p className="schedule-draft-help">30분 칸을 누르거나 드래그하면 가능한 시간을 선택·해제할 수 있습니다.</p>
          <div className="schedule-timetable-scroll" role="region" ref={scrollRef}
            aria-label="비어 있는 임시 합주 시간표 (가로 스크롤 가능)" tabIndex={0}>
            <div className="schedule-timetable-inner" style={{width:64+dates.length*70}}>
              <div className="schedule-date-header" style={{gridTemplateColumns:columns}}>
                <span className="schedule-date-corner">시간</span>
                {dates.map(date=><span key={date} className="schedule-date-label">{shortDate(date)}</span>)}
              </div>
              <div className="schedule-time-body" style={{gridTemplateColumns:columns}}
                onPointerDown={startStroke} onPointerMove={moveStroke}
                onPointerUp={endStroke} onPointerCancel={cancelStroke}
                onLostPointerCapture={()=>{stroke.current=null;}}>
                <div className="schedule-time-axis" style={{height:slots.length*20}}>
                  {tickTimes.map(time=><span key={time} className="schedule-time-tick"
                    style={{top:(time-draft.startHour*60)/30*20}}>{formatTime(time)}</span>)}
                </div>
                {dates.map((date,day)=><div className="schedule-day-slots" key={date}>
                  {slots.map((time,slot)=>{
                    const key=blockKey(date,time);
                    const available=availableCount(key),total=selectedNames.length;
                    const isSelected=total>0&&(mode==='all'?available>0:available===total);
                    const shade=total?Math.round(35+50*available/total):0;
                    return <button type="button" key={key} data-draft-block={key}
                      data-day={day} data-slot={slot}
                      className={'schedule-time-slot schedule-draft-block'+(time%60===0?' starts-hour':'')+(isSelected?' is-selected':'')}
                      style={{backgroundColor:isSelected?`color-mix(in srgb,var(--accent) ${shade}%,white)`:'#fff'}}
                      aria-pressed={isSelected}
                      aria-label={shortDate(date)+' '+formatTime(time)+'–'+formatTime(time+30)+(isSelected?' 선택됨':' 선택 안 됨')}
                      onClick={event=>{if(event.detail===0)keyboardToggle(day,slot);}}
                      onFocus={()=>setSelectedCell({day,slot})}
                      onMouseEnter={()=>setSelectedCell({day,slot})}
                      onMouseLeave={()=>setSelectedCell(null)}
                    />;
                  })}
                </div>)}
              </div>
            </div>
          </div>
          <p className="schedule-detail-footnote">한 칸은 30분입니다. 체크한 명단의 임시 가능 시간만 표시하며, 선택한 내용은 서버에 저장되지 않습니다.</p>
        </div>
        <aside className="schedule-people-panel schedule-draft-people-panel" aria-label="시간표 필터 및 현재 명단">
          <span className="schedule-side-eyebrow">시간표 표시</span>
          <div className="schedule-filter-options" role="group" aria-label="가능 시간 표시 방법">
            <button type="button" className={mode==='all'?'selected':''}
              aria-pressed={mode==='all'} onClick={()=>setMode('all')}>모임 전체</button>
            <button type="button" className={mode==='everyone'?'selected':''}
              aria-pressed={mode==='everyone'} onClick={()=>setMode('everyone')}>모두 되는 시간</button>
          </div>
          <div className="schedule-people-heading">
            <strong>현재 명단 ({people.length})</strong>
            <button type="button" onClick={selectEveryone}>모두 선택</button>
          </div>
          <div className="schedule-people-list">
            {people.map(name=><label key={name} className="schedule-person-option">
              <input type="checkbox" checked={selectedNames.includes(name)}
                onChange={()=>togglePerson(name)}/>
              <span className="schedule-person-icon"><Users size={14} aria-hidden="true"/></span>
              <span>{name}</span>
            </label>)}
            {people.length===0&&<p className="schedule-draft-empty-roster">아직 명단에 사람이 없습니다.</p>}
          </div>
          {selectedCell&&<p className="schedule-draft-hover">{shortDate(dates[selectedCell.day])} · {formatTime(slots[selectedCell.slot])}–{formatTime(slots[selectedCell.slot]+30)}</p>}
          <p className="schedule-side-help">체크한 사람들의 임시 가능 시간만 표시합니다. 30분 칸을 칠하면 체크한 사람들에게 적용되며, 실제 부원 정보나 서버에는 저장되지 않습니다.</p>
          {selectedNames.length===0&&<p className="schedule-side-warning">표시할 사람을 한 명 이상 선택해 주세요.</p>}
        </aside>
      </div>
    </section>
    {rosterOpen&&<div className="schedule-roster-backdrop" role="presentation"
      onMouseDown={event=>{if(event.target===event.currentTarget)setRosterOpen(false);}}>
      <div className="schedule-roster-dialog" role="dialog" aria-modal="true"
        aria-labelledby="schedule-roster-title">
        <div className="schedule-roster-dialog-header">
          <div><h2 id="schedule-roster-title">명단 수정</h2><p>학번으로 초대 대상을 확인할 수 있습니다. 이름은 본인이 초대를 수락한 뒤에만 표시됩니다.</p></div>
          <button type="button" aria-label="명단 수정 창 닫기" onClick={()=>setRosterOpen(false)}><X size={21}/></button>
        </div>
        <h3>현재 명단 ({people.length})</h3>
        <div className="schedule-roster-list">
          {people.map(name=><div key={name}><span><Users size={15} aria-hidden="true"/>{name}</span>
            <button type="button" aria-label={name+' 명단에서 제외'} onClick={()=>removeMember(name)}>
              <Trash2 size={15} aria-hidden="true"/> 제외
            </button>
          </div>)}
          {people.length===0&&<p>명단이 비어 있습니다.</p>}
        </div>
        <form onSubmit={search} className="schedule-roster-search-form">
          <label htmlFor="schedule-invite-id">학번으로 초대</label>
          <div><input id="schedule-invite-id" type="text" inputMode="numeric" maxLength={20}
            value={studentId} onChange={event=>{setStudentId(event.target.value);setSearched(false);setSearchResult(null);}}
            placeholder="학번을 입력하세요"/>
            <button type="submit" className="outline-action" disabled={!studentId.trim()}>
              <Search size={15} aria-hidden="true"/> 검색
            </button>
          </div>
        </form>
        {searched&&(searchResult?<div className="schedule-roster-found">
          <span><Check size={17} aria-hidden="true"/><span>{searchResult}</span></span>
          <button type="button" className="button button-primary"
            onClick={()=>setInviteNotice('초대했습니다')}>초대하기</button>
        </div>:<p className="schedule-roster-no-result" role="status">검색 결과가 없습니다.</p>)}
        <div className="schedule-roster-footer"><span>예시 검색만 지원합니다. 실제 초대 요청이나 초대 수락 기능은 아직 구현되지 않았습니다.</span>
          <button type="button" className="outline-action" onClick={()=>setRosterOpen(false)}>닫기</button>
        </div>
        {inviteNotice&&<div className="toast schedule-invite-toast" role="status" aria-live="polite">
          <Check size={17} aria-hidden="true"/><span>{inviteNotice}</span>
          <button type="button" aria-label="알림 닫기" onClick={()=>setInviteNotice('')}><X size={15}/></button>
        </div>}
      </div>
    </div>}
  </>;
}
