import { auth } from './firebase';
import type { AnonymousPerson, DonationInput, DonationRecord, OwnDonation, PublicDonation } from './donationData';

async function call<T>(path:string,body?:unknown,authorized=false):Promise<T>{
  const token=authorized?await auth.currentUser?.getIdToken():null;
  if(authorized&&!token)throw Error('로그인이 필요합니다.');
  const response=await fetch('/api/donations/'+path,{
    method:body===undefined?'GET':'POST',
    headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const data=await response.json();
  if(!response.ok)throw Error(typeof data.error==='string'?data.error:'후원 데이터를 불러오지 못했습니다.');
  return data as T;
}
export const getPublicDonations=()=>call<{records:PublicDonation[]}>('public');
export const getOwnDonations=()=>call<{records:OwnDonation[]}>('mine',undefined,true);
export type ManageData={records:DonationRecord[];people:AnonymousPerson[];registryUpdateTime:string|null};
export const getDonationManagement=()=>call<ManageData>('manage',undefined,true);
export const saveDonation=(record:DonationInput,id?:string,expectedUpdateTime?:string)=>call<{record:DonationRecord}>('manage',{action:'save',record,id,expectedUpdateTime},true);
export const importDonations=(rows:DonationInput[])=>call<{added:number}>('manage',{action:'import',rows},true);
export const saveAnonymousPeople=(people:AnonymousPerson[],expectedUpdateTime:string|null)=>call<{people:AnonymousPerson[];registryUpdateTime:string}>('manage',{action:'people',people,expectedUpdateTime},true);
export const purgeDonations=()=>call<{deleted:number;done:boolean}>('purge',{confirmation:'후원 · 회계 초기화'},true);
