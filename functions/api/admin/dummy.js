import {failure,parseBody,reject,secureOrigin,success,FIRESTORE_ROOT,toFields} from '../../_lib/shared.js';
import {assertAccess} from '../../_lib/google.js';
import {commit} from '../../_lib/schedules.js';
import {validateNotice} from '../../_lib/notices.js';
import {normalizeDonation,donationFields} from '../../_lib/donations.js';
import {normalizeTransaction} from '../../_lib/financeTransactions.js';
import {listGalleryAlbums,validateGalleryAlbum} from '../../_lib/gallery.js';
import {getDummyGalleryFixtures,ensureDummyGalleryFixtures} from '../../_lib/githubImages.js';

export const DUMMY_CONFIRMATION='더미 데이터 생성';
export const DUMMY_COUNTS={notices:100,donations:100,expenses:100,gallery:150};
const BATCH=20;
const ROOTS={notices:'notices',donations:'donations',expenses:'expenseTransactions',gallery:'galleryAlbums'};
const KINDS={notices:1,donations:2,expenses:3,gallery:4};
const pad=(number,length)=>String(number).padStart(length,'0');
const documentId=(kind,index)=>'d00d0000-0000-4000-8000-'+pad(KINDS[kind],2)+pad(index+1,10);
const resource=path=>FIRESTORE_ROOT.replace('https://firestore.googleapis.com/v1/','')+'/'+path;
const date=(index)=>new Date(Date.UTC(2026,9,1)+index*86400000).toISOString().slice(0,10);
const timestamp=index=>new Date(Date.UTC(2026,9,17,0,0)+index*60000).toISOString();
function dummyNotice(index,caller){
 const n=pad(index+1,3),d=validateNotice({
  title:'[테스트] 공지사항 '+n,category:['공지','공연','행사'][index%3],
  blocks:[{kind:'text',text:'페이지네이션 테스트를 위한 더미 공지사항 '+n+'입니다. 실제 동아리 공지가 아닙니다.'}]
 });
 return {...d,body:d.blocks[0].text,description:d.blocks[0].text,images:[],
  author:'테스트',authorUid:caller.uid,publishedAt:timestamp(index),isDummy:true,dummyBatch:'pagination-v1'};
}
function dummyDonation(index){
 const n=pad(index+1,3),record=normalizeDonation({date:date(index),donorName:'[테스트] 후원자 '+n,
  studentId:'',amount:String(10000+(index%9)*5000),anonymous:'x'});
 return {...donationFields(record),isDummy:true,dummyBatch:'pagination-v1'};
}
function dummyExpense(index){
 const record=normalizeTransaction({dateTime:timestamp(index).slice(0,16),type:index%4===0?'출금':'입금',
  amount:String(5000+(index%8)*3000),balance:String(2000000+index*10000),
  description:'[테스트] 회비 거래 '+pad(index+1,3)});
 return {...record,isDummy:true,dummyBatch:'pagination-v1'};
}
export function selectFixtureAlbum(albums){
 const found=albums.find(album=>album.title?.includes('Youth on Tape')&&album.title?.includes('소리사랑')
  &&Array.isArray(album.photos)&&album.photos.length>=17);
 if(!found)reject('Youth on Tape 공연의 사진 17장이 포함된 원본 갤러리 앨범을 찾지 못했습니다. 해당 앨범을 먼저 확인해 주세요.',409);
 return found;
}
function dummyGallery(index,photos,env,caller){
 const rotate=index%photos.length;
 const ordered=[...photos.slice(rotate),...photos.slice(0,rotate)];
 const validated=validateGalleryAlbum({
  title:'[테스트] 갤러리 앨범 '+pad(index+1,3),
  category:['공연','행사','일상'][index%3],photos:ordered
 },env.MYROCK_IMAGES_PUBLIC_BASE_URL);
 return {...validated,createdAt:timestamp(index),author:'테스트 데이터',
  authorUid:caller.uid,isDummy:true,dummyBatch:'pagination-v1'};
}
export async function onRequestPost({request,env}){
 try{
  secureOrigin(request);
  const caller=await assertAccess(request,env,'president');
  if(!caller.superadmin)reject('검증된 최고관리자만 더미 데이터를 생성할 수 있습니다.',403);
  const body=await parseBody(request);
  if(body?.confirmation!==DUMMY_CONFIRMATION)reject('더미 데이터 생성 확인값이 올바르지 않습니다.');
  const stage=body.stage,start=body.start;
  if(!Object.hasOwn(DUMMY_COUNTS,stage)||!Number.isInteger(start)||start<0||start%BATCH!==0||start>=DUMMY_COUNTS[stage])
   reject('더미 데이터 생성 구간이 올바르지 않습니다.');
  const end=Math.min(start+BATCH,DUMMY_COUNTS[stage]);
  let photos=null;
  if(stage==='gallery'){
   photos=await getDummyGalleryFixtures(env);
   if(!photos.length){
    const source=selectFixtureAlbum(await listGalleryAlbums(env));
    const original=validateGalleryAlbum({category:source.category,title:source.title,photos:source.photos},env.MYROCK_IMAGES_PUBLIC_BASE_URL).photos;
    photos=await ensureDummyGalleryFixtures(env,original);
   }
  }
  const writes=[];
  for(let index=start;index<end;index++){
   const values=stage==='notices'?dummyNotice(index,caller):
    stage==='donations'?dummyDonation(index):
    stage==='expenses'?dummyExpense(index):
    dummyGallery(index,photos,env,caller);
   writes.push({update:{name:resource(ROOTS[stage]+'/'+documentId(stage,index)),fields:toFields(values)}});
  }
  await commit(env,writes);
  return success({stage,processed:writes.length,next:end,done:end===DUMMY_COUNTS[stage],total:DUMMY_COUNTS[stage]});
 }catch(error){return failure(error);}
}
