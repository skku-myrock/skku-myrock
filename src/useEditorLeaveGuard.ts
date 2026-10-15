import {useEffect,useRef} from 'react';

export const UNSAVED_CHANGES_WARNING='변경사항이 저장되지 않았습니다. 페이지를 나가시겠습니까? 진행 상황은 저장되지 않습니다';

/**
 * Internal SPA navigation uses the caller's guard. Browser refresh/close can
 * only show the browser-managed beforeunload wording (custom text is ignored).
 */
export function useEditorLeaveGuard(
  dirty:boolean,
  register:(guard:(()=>boolean)|null)=>void
){
  const dirtyRef=useRef(dirty);
  dirtyRef.current=dirty;
  useEffect(()=>{
    const guard=()=>!dirtyRef.current||window.confirm(UNSAVED_CHANGES_WARNING);
    register(guard);
    return()=>register(null);
  },[register]);
  useEffect(()=>{
    if(!dirty)return;
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',onBeforeUnload);
    return()=>window.removeEventListener('beforeunload',onBeforeUnload);
  },[dirty]);
}
