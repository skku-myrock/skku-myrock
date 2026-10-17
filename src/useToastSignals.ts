import {useEffect} from 'react';
import {classifyToast,showToast} from './toastBus';
/** Forward discrete action outcomes into the sole bottom toast host. */
export function useToastSignals({error='',message='',warning=''}:{error?:string;message?:string;warning?:string}){
 useEffect(()=>{if(error)showToast(error,classifyToast(error)==='warning'?'warning':'error');},[error]);
 useEffect(()=>{if(message)showToast(message,classifyToast(message));},[message]);
 useEffect(()=>{if(warning)showToast(warning,'warning');},[warning]);
}
