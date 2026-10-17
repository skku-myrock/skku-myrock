export const EQUIPMENT_STATUSES = ['대여 가능','대여 승인 대기중','대여중','반납 확인중'] as const;
export type EquipmentStatus = typeof EQUIPMENT_STATUSES[number];
export type EquipmentRequest = {uid:string;name:string;studentId:string;requestedAt:string};
export type EquipmentBorrower = EquipmentRequest & {borrowedAt:string};
export type EquipmentItem = {
 id:string;name:string;product:string;imageUrl?:string;status:EquipmentStatus;
 queueLength:number;myPosition:number|null;isBorrower:boolean;
 queue?:EquipmentRequest[];borrower?:EquipmentBorrower|null;returnRequestedAt?:string|null;
};

export function equipmentStatusTone(status:EquipmentStatus){
 switch(status){
  case '대여 가능':return 'available';
  case '대여 승인 대기중':return 'pending';
  case '대여중':return 'borrowed';
  case '반납 확인중':return 'returning';
 }
}
export function equipmentDate(value:string){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date).replace(/\s/g,'').replace(/\.$/,'');
}
