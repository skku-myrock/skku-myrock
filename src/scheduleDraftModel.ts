
export type ScheduleDraftInput={
  title:string;
  dates:string[];
  startHour:number;
  endHour:number;
};
export const INITIAL_DRAFT_PARTICIPANTS=['갑길동','을길동','병길동','정길동'] as const;
export const DEMO_INVITATION={studentId:'2027000001',name:'무길동'} as const;

export function draftFromRoute(value:unknown):ScheduleDraftInput|null{
  if(!value||typeof value!=='object')return null;
  const input=value as Record<string,unknown>;
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>100
    ||!Array.isArray(input.dates)||input.dates.length<1||input.dates.length>366
    ||!input.dates.every((day:unknown)=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day))
    ||new Set(input.dates).size!==input.dates.length
    ||!Number.isInteger(input.startHour)||!Number.isInteger(input.endHour)
    ||(input.startHour as number)<0||(input.endHour as number)>24
    ||(input.startHour as number)>=(input.endHour as number))return null;
  return {
    title:input.title.trim(),dates:[...input.dates].sort(),
    startHour:input.startHour as number,endHour:input.endHour as number,
  };
}
export const blockKey=(day:string,time:number)=>day+'|'+time;
export function rectangleTimeSelection(
  baseline:ReadonlySet<string>,
  dates:readonly string[], slots:readonly number[],
  from:{day:number;slot:number},
  to:{day:number;slot:number},
  select:boolean,
):Set<string>{
  const result=new Set(baseline);
  for(let day=Math.min(from.day,to.day);day<=Math.max(from.day,to.day);day++){
    for(let slot=Math.min(from.slot,to.slot);slot<=Math.max(from.slot,to.slot);slot++){
      const date=dates[day],time=slots[slot];
      if(date===undefined||time===undefined)continue;
      const key=blockKey(date,time);
      if(select)result.add(key);else result.delete(key);
    }
  }
  return result;
}
export function mockFindInvitee(studentId:string):string|null{
  return studentId.trim()===DEMO_INVITATION.studentId?DEMO_INVITATION.name:null;
}
