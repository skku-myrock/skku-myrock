import {useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {ArrowLeft,CalendarDays,ChevronDown,Clock3,Plus,Search,Trash2,X,Users} from 'lucide-react';
import {brushCalendarDays,futureCalendarMonths,candidateHourLabel,isoLocalToday} from './scheduleCreationModel';
import type {CandidateCell} from './scheduleCreationModel';
import {createSchedule,createTeamSchedule,searchTeamMembers} from './scheduleApi';
import type {TeamMember} from './scheduleApi';
import type {ScheduleInput} from './scheduleGrid';

const weekdays=['일','월','화','수','목','금','토'] as const;
type BrushState={pointerId:number;start:CandidateCell;baseline:Set<string>;activate:boolean;lastIso:string};

export default function ScheduleCreation({onBack,onCreated,teamMode=false}:{onBack:()=>void;onCreated:(id:string)=>void;teamMode?:boolean}){
  const [teamMembers,setTeamMembers]=useState<TeamMember[]>([]);
  const [memberDialog,setMemberDialog]=useState(false);
  const [memberQuery,setMemberQuery]=useState('');
  const [memberResults,setMemberResults]=useState<TeamMember[]>([]);
  const [searching,setSearching]=useState(false);
  const [memberError,setMemberError]=useState('');
  async function searchMembers(){
    if(!memberQuery.trim())return;
    setSearching(true);setMemberError('');
    try{setMemberResults(await searchTeamMembers(memberQuery.trim()));}
    catch(error){setMemberError(error instanceof Error?error.message:'부원 검색에 실패했습니다.');}
    finally{setSearching(false);}
  }
  function addMember(member:TeamMember){
    setTeamMembers(previous=>previous.some(item=>item.uid===member.uid)?previous:[...previous,member]);
  }
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState('');
  async function submit(input:ScheduleInput){
    if(creating)return;
    setCreating(true);setError('');
    try{
      const result=teamMode?await createTeamSchedule(input,teamMembers.map(item=>item.uid)):await createSchedule(input);
      onCreated(result.id);
    }
    catch(e){setError(e instanceof Error?e.message:'시간표 생성에 실패했습니다.');}
    finally{setCreating(false);}
  }
  const [today]=useState(()=>isoLocalToday());
  const [visibleMonthCount,setVisibleMonthCount]=useState(1);
  const [title,setTitle]=useState('');
  const [dates,setDates]=useState<Set<string>>(()=>new Set());
  const [startHour,setStartHour]=useState(9);
  const [endHour,setEndHour]=useState(17);
  const brush=useRef<BrushState|null>(null);

  const months=useMemo(()=>futureCalendarMonths(today,visibleMonthCount),[today,visibleMonthCount]);
  const weeks=useMemo(()=>months.flatMap(month=>month.weeks),[months]);
  function startBrush(event:ReactPointerEvent<HTMLDivElement>){
    if(event.button!==0&&event.pointerType==='mouse')return;
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-candidate-date]');
    if(!target||target.disabled)return;
    const row=Number(target.dataset.week),col=Number(target.dataset.day);
    const cell=weeks[row]?.[col];
    if(!cell||cell.past)return;
    event.preventDefault();
    const baseline=new Set(dates);
    const activate=!baseline.has(cell.iso);
    brush.current={pointerId:event.pointerId,start:cell,baseline,activate,lastIso:cell.iso};
    setDates(brushCalendarDays(baseline,weeks,cell,cell,activate));
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveBrush(event:ReactPointerEvent<HTMLDivElement>){
    const active=brush.current;
    if(!active||active.pointerId!==event.pointerId)return;
    const element=document.elementFromPoint(event.clientX,event.clientY);
    const button=element?.closest<HTMLButtonElement>('[data-candidate-date]');
    if(!button||button.disabled)return;
    const cell=weeks[Number(button.dataset.week)]?.[Number(button.dataset.day)];
    if(!cell||cell.past||active.lastIso===cell.iso)return;
    active.lastIso=cell.iso;
    setDates(brushCalendarDays(active.baseline,weeks,active.start,cell,active.activate));
  }
  function endBrush(event:ReactPointerEvent<HTMLDivElement>){
    if(brush.current?.pointerId!==event.pointerId)return;
    brush.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function cancelBrush(event:ReactPointerEvent<HTMLDivElement>){
    const active=brush.current;
    if(!active||active.pointerId!==event.pointerId)return;
    // Let a vertical touch swipe scroll the page without leaving an accidental selection.
    setDates(new Set(active.baseline));
    endBrush(event);
  }
  function toggleKeyboard(cell:CandidateCell){
    setDates(previous=>{
      const updated=new Set(previous);
      if(updated.has(cell.iso))updated.delete(cell.iso);
      else updated.add(cell.iso);
      return updated;
    });
  }
  return <>
    <div className="page-heading container">
      <span className="eyebrow">SCHEDULE CREATE</span>
      <h1>합주 시간표 만들기</h1>
      <p>함께 합주할 날짜와 시간대를 설정해 보세요.</p>
    </div>
    <section className="container section-block schedule-create-page">
      <button type="button" className="schedule-back-button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true"/> 합주 시간 조율로 돌아가기
      </button>
      <div className="schedule-create-title">
        <label htmlFor="schedule-create-title">시간표 제목</label>
        <input id="schedule-create-title" type="text" maxLength={100} value={title}
          onChange={event=>setTitle(event.target.value)} placeholder="예: 정기공연 A팀 합주"
          autoComplete="off"/>
      </div>

      <div className="schedule-create-columns">
        <section className="schedule-create-panel schedule-date-panel" aria-labelledby="candidate-date-title">
          <div className="schedule-create-panel-heading">
            <span className="schedule-create-panel-icon"><CalendarDays size={20} aria-hidden="true"/></span>
            <div><h2 id="candidate-date-title">후보 날짜 선택</h2><p>날짜를 누르거나 드래그하여 여러 날짜를 선택하세요.</p></div>
          </div>
          <div className="schedule-calendar-months"
            onPointerDown={startBrush} onPointerMove={moveBrush}
            onPointerUp={endBrush} onPointerCancel={cancelBrush}
            onLostPointerCapture={()=>{brush.current=null;}}>
            {months.map(month=><div className="schedule-calendar-month" key={month.key}>
              <div className="schedule-calendar-top">
                <strong>{month.year}년 {month.monthNumber}월</strong>
              </div>
              <div className="schedule-calendar-weekdays" aria-hidden="true">
                {weekdays.map((day,index)=><span key={day}
                  className={index===0?'is-sunday':index===6?'is-saturday':''}>{day}</span>)}
              </div>
              <div className="schedule-calendar-grid" role="group"
                aria-label={`${month.year}년 ${month.monthNumber}월 후보 날짜`}>
                {month.weeks.flatMap((week,rowIndex)=>week.map((cell,weekday)=>
                  cell?<button type="button" key={cell.iso}
                    data-candidate-date={cell.iso} data-week={cell.week} data-day={cell.weekday}
                    className={'schedule-calendar-day'+(dates.has(cell.iso)?' is-selected':'')+
                      (cell.iso===today?' is-today':'')+
                      (cell.weekday===0?' is-sunday':'')+(cell.weekday===6?' is-saturday':'')}
                    aria-label={`${cell.iso} ${weekdays[cell.weekday]}요일`}
                    aria-pressed={dates.has(cell.iso)}
                    onClick={event=>{if(event.detail===0)toggleKeyboard(cell);}}>
                    {cell.day}
                  </button>:<span aria-hidden="true" key={`${month.key}-${rowIndex}-${weekday}`}
                    className="schedule-calendar-empty"/>))}
              </div>
            </div>)}
          </div>
          <button type="button" className="schedule-calendar-expand"
            aria-label="다음 달 달력 추가"
            onClick={()=>{brush.current=null;setVisibleMonthCount(count=>count+1);}}>
            <ChevronDown size={27} strokeWidth={2.4} aria-hidden="true"/>
            <span>다음 달 보기</span>
          </button>
        </section>
        <section className="schedule-create-panel schedule-time-panel" aria-labelledby="candidate-time-title">
          <div className="schedule-create-panel-heading">
            <span className="schedule-create-panel-icon"><Clock3 size={20} aria-hidden="true"/></span>
            <div><h2 id="candidate-time-title">후보 시간대 선택</h2><p>선택한 날짜에 적용할 시간 범위를 정하세요.</p></div>
          </div>
          <div className="schedule-create-time-fields">
            <label htmlFor="schedule-start-hour">시작</label>
            <select id="schedule-start-hour" value={startHour} onChange={event=>{
              const hour=Number(event.target.value);setStartHour(hour);
              if(hour>=endHour)setEndHour(hour+1);
            }}>
              {Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{candidateHourLabel(hour)}</option>)}
            </select>
            <label htmlFor="schedule-end-hour">종료</label>
            <select id="schedule-end-hour" value={endHour} onChange={event=>setEndHour(Number(event.target.value))}>
              {Array.from({length:24},(_,index)=>index+1).map(hour=>
                <option key={hour} value={hour} disabled={hour<=startHour}>{candidateHourLabel(hour)}</option>)}
            </select>
          </div>
          <p className="schedule-create-time-summary">
            모든 후보 날짜에 <strong>{candidateHourLabel(startHour)} ~ {candidateHourLabel(endHour)}</strong> 시간대를 적용합니다.
          </p>
        </section>
      </div>
      {teamMode&&<section className="schedule-team-section" aria-labelledby="schedule-team-heading">
        <div className="schedule-team-heading">
          <div><h2 id="schedule-team-heading">구성팀 명단</h2><p>함께 시간표를 사용할 부원을 직접 추가합니다. 초대 수락은 필요하지 않습니다.</p></div>
          <button type="button" className="button button-secondary" disabled={!title.trim()||dates.size===0||creating} onClick={()=>setMemberDialog(true)}><Plus size={15}/> 인원 추가</button>
        </div>
        {teamMembers.length===0?<p className="schedule-team-empty">추가된 구성팀 인원이 없습니다.</p>:
         <ul className="schedule-team-members">{teamMembers.map(member=><li key={member.uid}><Users size={14}/><span>{member.name} ({member.studentId})</span><button type="button" aria-label={member.name+' 제외'} disabled={creating} onClick={()=>setTeamMembers(previous=>previous.filter(item=>item.uid!==member.uid))}><Trash2 size={15}/> 삭제</button></li>)}</ul>}
      </section>}
      <div className="schedule-create-footer">
        {(!title.trim()||dates.size===0)&&<p>제목과 후보 날짜를 선택해 주세요.</p>}
        {teamMode&&teamMembers.length===0&&<p>구성팀 인원을 한 명 이상 추가해 주세요.</p>}
        <button type="button" className="button button-primary"
          disabled={!title.trim()||dates.size===0||creating||(teamMode&&teamMembers.length===0)}
          onClick={()=>void submit({title:title.trim(),dates:[...dates].sort(),startHour,endHour})}>{creating?'생성 중…':'시간표 생성'}</button>
        {error&&<p role="alert" className="schedule-side-warning">{error}</p>}
      </div>
      {teamMode&&memberDialog&&<div className="schedule-team-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setMemberDialog(false);}}>
        <section className="schedule-team-dialog" role="dialog" aria-modal="true" aria-label="구성팀 인원 추가">
          <div className="schedule-team-dialog-title"><div><h2>구성팀 인원 추가</h2><p>학번 또는 이름으로 검색하고 명단에 추가하세요.</p></div><button type="button" aria-label="닫기" onClick={()=>setMemberDialog(false)}><X size={19}/></button></div>
          <form onSubmit={event=>{event.preventDefault();void searchMembers();}} className="schedule-team-search">
            <input autoFocus value={memberQuery} onChange={event=>setMemberQuery(event.target.value)} placeholder="이름 또는 학번 검색" maxLength={40} aria-label="이름 또는 학번" />
            <button type="submit" className="button button-primary" disabled={searching||!memberQuery.trim()}><Search size={15}/>{searching?'검색 중…':'검색'}</button>
          </form>
          {memberError&&<p role="alert" className="schedule-side-warning">{memberError}</p>}
          <div className="schedule-team-results">{memberResults.length===0?<p>검색 결과가 없습니다. 검색어를 입력하고 검색을 눌러주세요.</p>:
           memberResults.map(member=><div className="schedule-team-result" key={member.uid}><span><strong>{member.name}</strong> ({member.studentId})</span>
            <button type="button" className="outline-action" disabled={teamMembers.some(entry=>entry.uid===member.uid)} onClick={()=>addMember(member)}>{teamMembers.some(entry=>entry.uid===member.uid)?'추가됨':'추가하기'}</button></div>)}</div>
          <div className="schedule-team-dialog-foot"><span>추가된 인원 {teamMembers.length}명</span><button type="button" className="button button-primary" onClick={()=>setMemberDialog(false)}>완료</button></div>
        </section>
      </div>}
    </section>
  </>;
}
