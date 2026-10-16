/** Local-calendar date keys, with UTC arithmetic to avoid daylight-saving jumps. */
export type CandidateCell={
  iso:string;
  day:number;
  month:number;
  weekday:number;
  week:number;
  past:boolean;
};

export function isoLocalToday(now:Date=new Date()):string{
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
function utcDate(iso:string):Date{
  const [year,month,day]=iso.split('-').map(Number);
  return new Date(Date.UTC(year,month-1,day));
}
function dateKey(date:Date):string{return date.toISOString().slice(0,10);}
function sundayOf(iso:string):Date{
  const value=utcDate(iso);
  value.setUTCDate(value.getUTCDate()-value.getUTCDay());
  return value;
}
export function calendarWeeks(month:string,today:string,weeks:number):CandidateCell[][]{
  const anchor=month.slice(0,7)===today.slice(0,7)?today:month.slice(0,7)+'-01';
  const start=sundayOf(anchor);
  return Array.from({length:weeks},(_,week)=>Array.from({length:7},(_,weekday)=>{
    const date=new Date(start.getTime()+(week*7+weekday)*86400000);
    const iso=dateKey(date);
    return {iso,day:date.getUTCDate(),month:date.getUTCMonth()+1,weekday,week,past:iso<today};
  }));
}

/** The current month starts at today's week; following months stack below it.
 * Past dates and spillover dates stay empty, so every date is shown only once.
 */
export type FutureCalendarMonth={
  key:string;
  year:number;
  monthNumber:number;
  weeks:(CandidateCell|null)[][];
};
export function futureCalendarMonths(today:string,count:number):FutureCalendarMonth[]{
  const [baseYear,baseMonth]=today.slice(0,7).split('-').map(Number);
  let weekOffset=0;
  return Array.from({length:count},(_,offset)=>{
    const first=new Date(Date.UTC(baseYear,baseMonth-1+offset,1));
    const key=dateKey(first).slice(0,7);
    const firstVisible=sundayOf(offset===0?today:dateKey(first));
    const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0));
    const rows=Math.ceil((last.getTime()-firstVisible.getTime()+86400000)/(7*86400000));
    const weeks=Array.from({length:rows},(_,row)=>{
      const weekIndex=weekOffset+row;
      return Array.from({length:7},(_,weekday):CandidateCell|null=>{
        const date=new Date(firstVisible.getTime()+(row*7+weekday)*86400000);
        const iso=dateKey(date);
        if(iso.slice(0,7)!==key||iso<today)return null;
        return {iso,day:date.getUTCDate(),month:date.getUTCMonth()+1,weekday,week:weekIndex,past:false};
      });
    });
    weekOffset+=rows;
    return {key,year:first.getUTCFullYear(),monthNumber:first.getUTCMonth()+1,weeks};
  });
}

/** Brush selects a rectangle of displayed calendar cells, not a continuous date interval. */
export function brushCalendarDays(
  baseline:ReadonlySet<string>,
  weeks:readonly (readonly (CandidateCell|null)[])[],
  start:CandidateCell,
  end:CandidateCell,
  activate:boolean,
):Set<string>{
  const selected=new Set(baseline);
  const rowMin=Math.min(start.week,end.week),rowMax=Math.max(start.week,end.week);
  const colMin=Math.min(start.weekday,end.weekday),colMax=Math.max(start.weekday,end.weekday);
  for(let row=rowMin;row<=rowMax;row++)for(let col=colMin;col<=colMax;col++){
    const cell=weeks[row]?.[col];
    if(!cell||cell.past)continue;
    if(activate)selected.add(cell.iso);
    else selected.delete(cell.iso);
  }
  return selected;
}
export function candidateHourLabel(hour:number):string{
  const hour12=hour%12||12;
  const period=hour%24<12?'오전':'오후';
  return `${period} ${hour12}시 (${String(hour).padStart(2,'0')}:00)`;
}
