export type ToastTone='success'|'error'|'warning';
export type ToastDetail={message:string;tone:ToastTone;id:number};
let nextId=0;
/** One bottom-toast pipeline shared by page, dialog and management components. */
export function showToast(message:string,tone:ToastTone='success'){
 if(!message||typeof window==='undefined')return;
 window.dispatchEvent(new CustomEvent<ToastDetail>('myrock:toast',{detail:{message,tone,id:++nextId}}));
}
export function classifyToast(message:string):ToastTone{
 if(/실패|오류|못했습니다|못했습니다|중단|불러오지 못|저장하지 못|삭제하지 못|문제가 발생|다시 시도/.test(message))return 'error';
 if(/경고|없습니다|확인해|입력해|필요합니다|올바르지|초과|누락|중복|이미 |헤더|형식|초대.*거절|취소할 수 없|권한|비활성|지연|건너뜁니다|대기/.test(message))return 'warning';
 return 'success';
}
