import { FIRESTORE_ROOT,docFields,reject,toFields } from './shared.js';
import { googleRequest } from './google.js';

export const ABOUT_DOC=FIRESTORE_ROOT+'/siteContent/clubIntroduction';
export const DEFAULT_ABOUT={
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
    {id:'default-8',name:'김민현',position:'키보드파트장',photoUrl:''},
  ],
  history:[{id:'history-1',year:'1998년',description:'모여락 창단'},
    {id:'history-2',year:'2023년',description:'중앙동아리 승격'}],
};
const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)reject(label+'을(를) 확인해 주세요.');return value.trim();};
export function normalizeImage(value){
  if(typeof value!=='string'||value.length>1000)reject('이미지 주소를 확인해 주세요.');
  const url=value.trim();
  if(!url)return '';
  if(!/^https:\/\//.test(url))reject('이미지는 HTTPS 주소 또는 업로드한 이미지만 사용할 수 있습니다.');
  try {const parsed=new URL(url);if(parsed.username||parsed.password)reject('이미지 주소를 확인해 주세요.');}
  catch {reject('이미지 주소가 올바르지 않습니다.');}
  return url;
}
export function normalizeAbout(input){
  if(!input||typeof input!=='object'||Array.isArray(input))reject('동아리 소개 형식이 올바르지 않습니다.');
  const homeImage=normalizeImage(input.homeImage??'');
  const heroImage=normalizeImage(input.heroImage??'');
  const cohortLabel=text(input.cohortLabel,80,'운영진 소개 문구');
  if(!Array.isArray(input.officers)||input.officers.length>40)reject('운영진은 최대 40명까지 등록할 수 있습니다.');
  if(!Array.isArray(input.history)||input.history.length>100)reject('연혁은 최대 100건까지 등록할 수 있습니다.');
  const ids=new Set();
  const validateId=(value)=>{
    if(typeof value!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(value)||ids.has(value))reject('운영진 또는 연혁 ID가 올바르지 않습니다.');
    ids.add(value);return value;
  };
  const officers=input.officers.map(officer=>({
    id:validateId(officer?.id),name:text(officer?.name,65,'운영진 이름'),
    position:text(officer?.position,110,'운영진 직위'),photoUrl:normalizeImage(officer?.photoUrl??''),
  }));
  const history=input.history.map(row=>({
    id:validateId(row?.id),year:text(row?.year,40,'연혁 연도'),description:text(row?.description,250,'연혁 내용'),
  }));
  return {homeImage,heroImage,cohortLabel,officers,history};
}
/** Reset introduction text while preserving its existing image URLs.
 * The eight 28th-cohort profiles are restored; photos follow the original
 * officer by name where possible, otherwise remain in their existing slot.
 */
export function resetAboutTextKeepingImages(content){
  const current=normalizeAbout(content);
  const urlsByName=new Map(current.officers.map(person=>[person.name,person.photoUrl]));
  return {
    ...DEFAULT_ABOUT,
    homeImage:current.homeImage,
    heroImage:current.heroImage,
    officers:DEFAULT_ABOUT.officers.map((person,index)=>({
      ...person,
      photoUrl:urlsByName.get(person.name)??current.officers[index]?.photoUrl??''
    })),
    history:DEFAULT_ABOUT.history.map(item=>({...item}))
  };
}

/** Erase only image links; preserve descriptions, membership and history. */
export function withoutAboutPhotoUrls(content){
  const valid=normalizeAbout(content);
  return {
    ...valid,homeImage:'',heroImage:'',
    officers:valid.officers.map(person=>({...person,photoUrl:''}))
  };
}
export async function getAbout(env){
  const res=await googleRequest(env,ABOUT_DOC);
  if(res.status===404)return {content:DEFAULT_ABOUT,updateTime:null};
  if(!res.ok)throw Error('동아리 소개 조회 실패: '+res.status);
  const existing=docFields(res.data);
  // Legacy relative image paths are no longer hosted. Hide them instead of failing
  // the entire introduction page while the old Firestore record still exists.
  const image=value=>typeof value==='string'&&value.startsWith('/')?'':value;
  const safe={...existing,homeImage:image(existing.homeImage),heroImage:image(existing.heroImage),
    officers:Array.isArray(existing.officers)?existing.officers.map(o=>({...o,photoUrl:image(o.photoUrl)})):existing.officers};
  return {content:normalizeAbout(safe),updateTime:res.data.updateTime??null};
}
export async function saveAbout(env,content,expectedUpdateTime){
  const valid=normalizeAbout(content);
  const url=new URL(ABOUT_DOC);
  if(expectedUpdateTime)url.searchParams.set('currentDocument.updateTime',expectedUpdateTime);
  else url.searchParams.set('currentDocument.exists','false');
  const res=await googleRequest(env,url.toString(),{method:'PATCH',body:{fields:toFields(valid)}});
  if([409,412].includes(res.status))reject('다른 운영진이 소개를 수정했습니다. 새로고침 후 다시 시도해 주세요.',409);
  if(!res.ok)throw Error('동아리 소개 저장 실패: '+res.status);
  return {content:valid,updateTime:res.data.updateTime??null};
}
