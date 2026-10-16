import {auth} from './firebase';
import type {ScheduleInput} from './scheduleGrid';
export type ScheduleSummary={id:string;title:string;dates:string[];startHour:number;endHour:number;createdBy:string;status:string;createdAt:string;participantCount:number};
export type ScheduleMember={uid:string;name:string;availability:string|null;hasResponded:boolean;updateTime?:string};
export type ScheduleDetailData={schedule:{id:string;title:string;dates:string[];startHour:number;endHour:number;createdBy:string;status:string};people:ScheduleMember[];viewerUid:string};
export type Invitation={id:string;scheduleId:string;title:string;inviterName:string;createdAt:string};
export type PendingScheduleInvitation={id:string;studentId:string;status:'pending'|'not_found';createdAt:string};
async function request<T>(path:string,body?:unknown):Promise<T>{
 const user=auth.currentUser;
 if(!user)throw new Error('로그인이 필요합니다.');
 const token=await user.getIdToken();
 const res=await fetch('/api/'+path,{
  method:body===undefined?'GET':'POST',
  headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
 });
 const data=await res.json().catch(()=>({error:'서버 응답이 올바르지 않습니다.'}));
 if(!res.ok)throw new Error(data.error||'요청을 처리하지 못했습니다.');
 return data as T;
}
export const listSchedules=async()=> (await request<{schedules:ScheduleSummary[]}>('schedules')).schedules;
export const createSchedule=async(input:ScheduleInput)=>request<{id:string}>('schedules',input);
export const getSchedule=async(id:string)=>request<ScheduleDetailData>('schedules/'+encodeURIComponent(id));
export const saveAvailability=async(id:string,availability:string,expectedUpdateTime:string)=>
 request<{updateTime:string;availability:string;hasResponded:boolean}>('schedules/'+encodeURIComponent(id)+'/availability',{availability,expectedUpdateTime});
export const inviteMember=async(id:string,studentId:string)=>
 request<{message:string;status:'pending'|'not_found'|'accepted'|'already_member'}>('schedules/'+encodeURIComponent(id)+'/invite',{studentId});
export const listPendingScheduleInvitations=async(id:string)=>
 (await request<{invitations:PendingScheduleInvitation[]}>('schedules/'+encodeURIComponent(id)+'/invitations')).invitations;
export const cancelScheduleInvitation=async(id:string,invitationId:string)=>
 request<{success:boolean}>('schedules/'+encodeURIComponent(id)+'/cancel-invite',{invitationId});
export const removeScheduleMember=async(id:string,uid:string)=>
 request<{success:boolean}>('schedules/'+encodeURIComponent(id)+'/members/'+encodeURIComponent(uid),{action:'remove'});
export const listInvitations=async()=> (await request<{invitations:Invitation[]}>('schedule-invitations')).invitations;
export const respondInvitation=async(id:string,action:'accept'|'decline')=>
 request<{success:boolean;scheduleId:string}>('schedule-invitations/'+encodeURIComponent(id)+'/respond',{action});
