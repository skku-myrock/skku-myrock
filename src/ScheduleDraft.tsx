import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,FormEvent} from 'react';
import {ArrowLeft,Check,Plus,Search,Trash2,Users,X} from 'lucide-react';
import {getScheduleSlots} from './SchedulePages';
import {blockKey,draftFromRoute,INITIAL_DRAFT_PARTICIPANTS,mockFindInvitee,rectangleTimeSelection} from './scheduleDraftModel';

type CellPosition={day:number;slot:number};
type Stroke={pointerId:number;start:CellPosition;baseline:Set<string>;activate:boolean;lastKey:string};
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
  const [selected,setSelected]=useState<Set<string>>(()=>new Set());
  const [people,setPeople]=useState<string[]>(()=>[...INITIAL_DRAFT_PARTICIPANTS]);
  const [rosterOpen,setRosterOpen]=useState(false);
  const [studentId,setStudentId]=useState('');
  const [searched,setSearched]=useState(false);
  const [searchResult,setSearchResult]=useState<string|null>(null);
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

  function startStroke(event:ReactPointerEvent<HTMLDivElement>){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-draft-block]');
    if(!target)return;
    const day=Number(target.dataset.day),slot=Number(target.dataset.slot);
    const date=dates[day],time=slots[slot];
    if(date===undefined||time===undefined)return;
    event.preventDefault();
    const baseline=new Set(selected),key=blockKey(date,time);
    const activate=!baseline.has(key);
    stroke.current={pointerId:event.pointerId,start:{day,slot},baseline,activate,lastKey:key};
    setSelected(rectangleTimeSelection(baseline,dates,slots,{day,slot},{day,slot},activate));
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
    setSelected(rectangleTimeSelection(active.baseline,dates,slots,active.start,{day,slot},active.activate));
  }
  function endStroke(event:ReactPointerEvent<HTMLDivElement>){
    if(stroke.current?.pointerId!==event.pointerId)return;
    stroke.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function cancelStroke(event:ReactPointerEvent<HTMLDivElement>){
    if(stroke.current?.pointerId!==event.pointerId)return;
    setSelected(new Set(stroke.current.baseline));
    endStroke(event);
  }
  function keyboardToggle(day:number,slot:number){
    const date=dates[day],time=slots[slot];
    if(date===undefined||time===undefined)return;
    const key=blockKey(date,time);
    setSelected(previous=>{
      const updated=new Set(previous);
      if(updated.has(key))updated.delete(key);else updated.add(key);
      return updated;
    });
  }
  function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setSearched(true);
    setSearchResult(mockFindInvitee(studentId));
  }
  function addMember(){
    if(!searchResult||people.includes(searchResult))return;
    setPeople(current=>[...current,searchResult]);
    setStudentId('');setSearched(false);setSearchResult(null);
  }
  function removeMember(name:string){
    setPeople(current=>current.filter(person=>person!==name));
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
        <button type="button" className="outline-action schedule-roster-edit-trigger" onClick={()=>setRosterOpen(true)}>
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
                    const key=blockKey(date,time),isSelected=selected.has(key);
                    return <button type="button" key={key} data-draft-block={key}
                      data-day={day} data-slot={slot}
                      className={'schedule-time-slot schedule-draft-block'+(time%60===0?' starts-hour':'')+(isSelected?' is-selected':'')}
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
          <p className="schedule-detail-footnote">한 칸은 30분입니다. 현재 {selected.size}칸 선택했습니다. 선택한 내용은 서버에 저장되지 않습니다.</p>
        </div>
        <aside className="schedule-people-panel schedule-draft-people-panel" aria-label="임시 시간표 명단 및 선택 현황">
          <span className="schedule-side-eyebrow">선택 현황</span>
          <strong className="schedule-draft-selected-count">{selected.size}칸 선택</strong>
          {selectedCell&&<p className="schedule-draft-hover">{shortDate(dates[selectedCell.day])} · {formatTime(slots[selectedCell.slot])}–{formatTime(slots[selectedCell.slot]+30)}</p>}
          <div className="schedule-people-heading"><strong>현재 명단 ({people.length})</strong></div>
          <div className="schedule-people-list">
            {people.map(name=><div className="schedule-draft-participant" key={name}>
              <Users size={14} aria-hidden="true"/> {name}
            </div>)}
            {people.length===0&&<p className="schedule-draft-empty-roster">아직 명단에 사람이 없습니다.</p>}
          </div>
          <p className="schedule-side-help">명단과 시간 선택은 이 화면에서만 적용되는 임시 예시입니다.</p>
        </aside>
      </div>
    </section>
    {rosterOpen&&<div className="schedule-roster-backdrop" role="presentation"
      onMouseDown={event=>{if(event.target===event.currentTarget)setRosterOpen(false);}}>
      <div className="schedule-roster-dialog" role="dialog" aria-modal="true"
        aria-labelledby="schedule-roster-title">
        <div className="schedule-roster-dialog-header">
          <div><h2 id="schedule-roster-title">명단 수정</h2><p>임시 시간표에 초대할 부원을 추가하거나 명단에서 제외할 수 있습니다.</p></div>
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
          <span><Check size={17} aria-hidden="true"/><strong>{searchResult}</strong><small>{studentId.trim()}</small></span>
          <button type="button" className="button button-primary" disabled={people.includes(searchResult)}
            onClick={addMember}><Plus size={15} aria-hidden="true"/>{people.includes(searchResult)?'추가됨':'명단에 추가'}</button>
        </div>:<p className="schedule-roster-no-result" role="status">검색 결과가 없습니다.</p>)}
        <div className="schedule-roster-footer"><span>실제 회원 조회나 초대 알림은 전송하지 않습니다.</span>
          <button type="button" className="outline-action" onClick={()=>setRosterOpen(false)}>닫기</button>
        </div>
      </div>
    </div>}
  </>;
}
