import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';

type TimedBottomToastProps={
  message:string;
  onClose:()=>void;
  tone?:'success'|'error'|'warning';
};

// Shared success/error/warning reference design for selected bottom notices.
export default function TimedBottomToast({message,onClose,tone='success'}:TimedBottomToastProps){
  const [leaving,setLeaving]=useState(false);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;

  useEffect(()=>{
    setLeaving(false);
    const timer=window.setTimeout(()=>setLeaving(true),3000);
    return()=>window.clearTimeout(timer);
  },[message]);

  useEffect(()=>{
    if(!leaving)return;
    const timer=window.setTimeout(()=>closeRef.current(),250);
    return()=>window.clearTimeout(timer);
  },[leaving]);

  return <div className={'site-bottom-toast is-timed '+(tone==='error'?'is-error':tone==='warning'?'is-warning':'is-success')+(leaving?' is-leaving':'')}
    role={tone==='error'?'alert':'status'} aria-live={tone==='error'?'assertive':'polite'}>
    <span>{message}</span>
    <button type="button" aria-label="알림 닫기" onClick={()=>setLeaving(true)}><X size={17} aria-hidden="true"/></button>
  </div>;
}
