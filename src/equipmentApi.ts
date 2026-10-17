import {auth} from './firebase';
import type {EquipmentItem} from './equipmentDemo';

async function request<T>(path:string,body?:unknown):Promise<T>{
 const token=await auth.currentUser?.getIdToken();
 const response=await fetch('/api/equipment'+path,{
  method:body===undefined?'GET':'POST',
  headers:{
   ...(token?{authorization:'Bearer '+token}:{}),
   ...(body===undefined?{}:{'content-type':'application/json'}),
  },
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  credentials:'same-origin',
  cache:'no-store',
 });
 let data:Record<string,unknown>;
 try{data=await response.json();}
 catch{throw new Error('장비 대여 서버에 연결할 수 없습니다.');}
 if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'장비 요청을 처리하지 못했습니다.');
 return data as T;
}
export const getEquipment=(manage=false)=>request<{items:EquipmentItem[]}>(manage?'?manage=1':'');
export type EquipmentAction = 'apply'|'cancel'|'return';
export const equipmentAction=(id:string,action:EquipmentAction)=>request<{success:boolean}>('/action',{id,action});
export type EquipmentManageAction = 'approve'|'confirm-return'|'add'|'edit'|'delete'|'force-loan'|'force-return'|'force-available'|'force-request-return'|'cancel-return'|'add-request'|'clear-queue';
export type EquipmentManageInput={id?:string;name?:string;product?:string;imageUrl?:string;studentId?:string};
export const manageEquipment=(action:EquipmentManageAction,input:EquipmentManageInput)=>
 request<{success:boolean;id:string}>('/manage',{action,...input});
