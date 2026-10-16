export const EQUIPMENT_STATUSES = ['대여 가능','대여 승인 대기중','대여중','반납 확인중'] as const;
export type EquipmentStatus = typeof EQUIPMENT_STATUSES[number];
export type EquipmentItem = {id:string;name:string;product:string;status:EquipmentStatus};

// UI fixture only. This list is not backed by Firestore or a rental API.
export const demoEquipment:EquipmentItem[] = [
 {id:'demo-guitar',name:'기타',product:'바커스 BST-2-RSM',status:'대여 가능'},
 {id:'demo-mic',name:'마이크',product:'슈어 SM98',status:'대여 승인 대기중'},
 {id:'demo-di',name:'DI 박스',product:'래디얼 ProDI',status:'대여중'},
 {id:'demo-stand',name:'마이크 스탠드',product:'K&M 210/9',status:'반납 확인중'},
];

export function equipmentStatusTone(status:EquipmentStatus){
 switch(status){
  case '대여 가능':return 'available';
  case '대여 승인 대기중':return 'pending';
  case '대여중':return 'borrowed';
  case '반납 확인중':return 'returning';
 }
}
