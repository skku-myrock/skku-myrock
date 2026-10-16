import {matchPath} from 'react-router-dom';

export type Page = 'home' | 'about' | 'about-manage' | 'news' | 'notice-detail' | 'notice-compose' | 'notice-edit'
 | 'schedule' | 'schedule-create' | 'schedule-detail' | 'gallery' | 'equipment' | 'finance' | 'donations'
 | 'donation-manage' | 'expenses' | 'expense-manage' | 'handover' | 'members' | 'profile';
export type Navigate = (page:Page)=>void;
export type Notify = (message?:string)=>void;
export type NavItem = {id:Page;label:string};

export const navGroups:{label:string;items:NavItem[]}[]=[
 {label:'소개',items:[{id:'about',label:'동아리 소개'},{id:'gallery',label:'갤러리'}]},
 {label:'소식',items:[{id:'news',label:'공지사항'},{id:'finance',label:'후원 · 회계'}]},
 {label:'활동',items:[{id:'schedule',label:'합주 시간 조율'},{id:'equipment',label:'장비 대여'}]},
];
export const allNav:NavItem[]=[
 ...navGroups.flatMap(group=>group.items),
 {id:'members',label:'부원 관리'},{id:'handover',label:'인수인계'},{id:'profile',label:'내 정보'},
];
export const routeDefinitions:{page:Page;path:string}[]=[
 {page:'home',path:'/'},
 {page:'about',path:'/about'},
 {page:'about-manage',path:'/about/manage'},
 {page:'news',path:'/news'},
 {page:'notice-compose',path:'/news/write'},
 {page:'notice-edit',path:'/news/:id/edit'},
 {page:'notice-detail',path:'/news/:id'},
 {page:'schedule',path:'/schedule'},
 {page:'schedule-create',path:'/schedule/create'},
 {page:'schedule-detail',path:'/schedule/:id'},
 {page:'gallery',path:'/gallery'},
 {page:'equipment',path:'/equipment'},
 {page:'finance',path:'/finance'},
 {page:'donations',path:'/finance/donations'},
 {page:'donation-manage',path:'/finance/donations/manage'},
 {page:'expenses',path:'/finance/expenses'},
 {page:'expense-manage',path:'/finance/expenses/manage'},
 {page:'handover',path:'/handover'},
 {page:'members',path:'/members'},
 {page:'profile',path:'/profile'},
];
export function routeFromPath(pathname:string){
 for(const route of routeDefinitions){
  const match=matchPath({path:route.path,end:true,caseSensitive:false},pathname);
  if(match)return {page:route.page,params:match.params};
 }
 return {page:'home' as Page,params:{} as Record<string,string|undefined>};
}
export function pathFor(page:Page){
 const path=routeDefinitions.find(entry=>entry.page===page)?.path??'/';
 // Parameterized routes are navigated via the URL helpers below.
 return path.includes(':')?(page==='schedule-detail'?'/schedule':'/news'):path;
}
export const noticePath=(id:string)=>'/news/'+encodeURIComponent(id);
export const editNoticePath=(id:string)=>noticePath(id)+'/edit';
export const schedulePath=(id:string)=>'/schedule/'+encodeURIComponent(id);
