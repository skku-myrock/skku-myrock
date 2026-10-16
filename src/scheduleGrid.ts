export type ScheduleInput={title:string;dates:string[];startHour:number;endHour:number};
export const blockKey=(day:string,time:number)=>day+'|'+time;
export function rectangleTimeSelection(
 baseline:ReadonlySet<string>,dates:readonly string[],slots:readonly number[],
 from:{day:number;slot:number},to:{day:number;slot:number},select:boolean,
):Set<string>{
 const result=new Set(baseline);
 for(let day=Math.min(from.day,to.day);day<=Math.max(from.day,to.day);day++)
  for(let slot=Math.min(from.slot,to.slot);slot<=Math.max(from.slot,to.slot);slot++){
   if(dates[day]===undefined||slots[slot]===undefined)continue;
   const key=blockKey(dates[day],slots[slot]);
   if(select)result.add(key);else result.delete(key);
  }
 return result;
}
export const slotCount=(dates:readonly string[],startHour:number,endHour:number)=>dates.length*(endHour-startHour)*2;
export function encodeBits(selected:ReadonlySet<string>,dates:readonly string[],startHour:number,endHour:number):string{
 const count=slotCount(dates,startHour,endHour),bits=new Uint8Array(Math.ceil(count/8));
 for(let i=0;i<(endHour-startHour)*2;i++)for(let j=0;j<dates.length;j++){
  if(selected.has(blockKey(dates[j],startHour*60+i*30))){
   const index=i*dates.length+j;
   bits[Math.floor(index/8)]|=1<<(7-index%8);
  }
 }
 let binary='';for(const byte of bits)binary+=String.fromCharCode(byte);
 return btoa(binary);
}
export function decodeBits(value:string,dates:readonly string[],startHour:number,endHour:number):Set<string>{
 const result=new Set<string>(),count=slotCount(dates,startHour,endHour),binary=atob(value);
 if(binary.length!==Math.ceil(count/8))throw new Error('저장된 체크 행렬 크기가 올바르지 않습니다.');
 for(let i=0;i<count;i++)if(binary.charCodeAt(i>>3)&(1<<(7-i%8))){
  const day=i%dates.length,row=Math.floor(i/dates.length);
  result.add(blockKey(dates[day],startHour*60+row*30));
 }
 return result;
}
