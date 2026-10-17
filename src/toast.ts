import {useEffect} from 'react';

export type ToastTone='success'|'error'|'warning';
export const MYROCK_TOAST_EVENT='myrock:toast';
export type ToastPayload={id:number;message:string;tone:ToastTone};
let toastId=0;

/** Route every transient user feedback message through the shared app-level toast. */
export function showToast(message:string,tone:ToastTone='success'){
 if(!message?.trim())return;
 const payload:ToastPayload={id:++toastId,message,tone};
 window.dispatchEvent(new CustomEvent<ToastPayload>(MYROCK_TOAST_EVENT,{detail:payload}));
}

export function useToastFeedback(message:string,tone:ToastTone='success'){
 useEffect(()=>{if(message)showToast(message,tone)},[message,tone]);
}
