import { auth } from './firebase';
export type Officer={id:string;name:string;position:string;photoUrl:string};
export type HistoryEntry={id:string;year:string;description:string};
export type AboutContent={homeImage:string;heroImage:string;cohortLabel:string;officers:Officer[];history:HistoryEntry[]};
export type AboutManageResponse={content:AboutContent;updateTime:string|null};
export const DEFAULT_ABOUT:AboutContent={
  homeImage:'',heroImage:'',
  cohortLabel:'28기 운영진 소개',
  officers:[
    {id:'default-1',name:'김서연',position:'회장, 보컬파트장',photoUrl:''},
    {id:'default-2',name:'신희수',position:'부회장',photoUrl:''},
    {id:'default-3',name:'배은성',position:'공연부장, 기타파트장',photoUrl:''},
    {id:'default-4',name:'허지원',position:'총무',photoUrl:''},
    {id:'default-5',name:'정해준',position:'홍보부장',photoUrl:''},
    {id:'default-6',name:'김하은',position:'베이스파트장',photoUrl:''},
    {id:'default-7',name:'추서현',position:'드럼파트장',photoUrl:''},
    {id:'default-8',name:'김민현',position:'키보드파트장',photoUrl:''}
  ],
  history:[{id:'history-1',year:'1998년',description:'모여락 창단'},
    {id:'history-2',year:'2023년',description:'중앙동아리 승격'}]
};
async function request<T>(path:string,body?:unknown,method='GET'):Promise<T>{
  const protectedCall=method==='POST'||path==='manage';
  const token=protectedCall?await auth.currentUser?.getIdToken():null;
  if(protectedCall&&!token)throw Error('로그인이 필요합니다.');
  const res=await fetch('/api/about/'+path,{method,headers:{
    ...(body===undefined?{}:{'content-type':'application/json'}),
    ...(token?{authorization:'Bearer '+token}:{}),
  },body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok)throw Error(typeof data.error==='string'?data.error:'동아리 소개 정보를 처리하지 못했습니다.');
  return data as T;
}
export const getAbout=()=>request<{content:AboutContent}>('content');
export const getAboutManagement=()=>request<AboutManageResponse>('manage');
export const saveAbout=(content:AboutContent,expectedUpdateTime:string|null)=>request<AboutManageResponse>('content',{content,expectedUpdateTime},'POST');
