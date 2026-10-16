import {useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {ArrowLeft,CalendarDays,ChevronDown,Clock3} from 'lucide-react';
import {brushCalendarDays,futureCalendarMonths,candidateHourLabel,isoLocalToday} from './scheduleCreationModel';
import type {CandidateCell} from './scheduleCreationModel';
import {draftFromRoute} from './scheduleDraftModel';
import type {ScheduleDraftInput} from './scheduleDraftModel';

const weekdays=['일','월','화','수','목','금','토'] as const;
type BrushState={pointerId:number;start:CandidateCell;baseline:Set<string>;activate:boolean;lastIso:string};

export default function ScheduleCreation({onBack,onPreview,initial}:{onBack:()=>void;onPreview:(draft:ScheduleDraftInput)=>void;initial?:unknown}){
  const [restored]=useState(()=>draftFromRoute(initial));
  const [today]=useState(()=>isoLocalToday());
  const [visibleMonthCount,setVisibleMonthCount]=useState(1);
  const [title,setTitle]=useState(restored?.title??'');
  const [dates,setDates]=useState<Set<string>>(()=>new Set(restored?.dates??[]));
  const [startHour,setStartHour]=useState(restored?.startHour??9);
  const [endHour,setEndHour]=useState(restored?.endHour??17);
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
  const displayDates=[...dates].sort();
  const candidateCount=displayDates.length;
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
          <p className="schedule-create-selection-summary" role="status">
            {candidateCount?`선택한 날짜 ${candidateCount}일 · ${displayDates[0]}부터`:'선택한 날짜가 없습니다.'}
          </p>
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
      <div className="schedule-create-footer">
        <p>{title.trim()&&dates.size?'저장하지 않고 빈 시간표 화면을 미리 확인합니다.':'제목과 후보 날짜를 선택하면 빈 시간표를 확인할 수 있습니다.'}</p>
        <button type="button" className="button button-primary"
          disabled={!title.trim()||dates.size===0}
          onClick={()=>onPreview({title:title.trim(),dates:[...dates].sort(),startHour,endHour})}>시간표 생성</button>
      </div>
    </section>
  </>;
}
