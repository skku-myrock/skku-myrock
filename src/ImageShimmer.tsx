import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,ReactNode} from 'react';

/** Keep the image frame stable until the actual image finishes loading. */
export default function ImageShimmer({src,alt,className='',loading='lazy',fetchPriority='auto',style,draggable,onLoad}:{
 src:string;alt:string;className?:string;loading?:'eager'|'lazy';fetchPriority?:'high'|'low'|'auto';fallback?:ReactNode;
 style?:CSSProperties;draggable?:boolean;onLoad?:(width:number,height:number)=>void;
}){
 const [state,setState]=useState<'pending'|'ready'>('pending');
 const previousSrc=useRef(src);
 useEffect(()=>{
  if(previousSrc.current!==src){previousSrc.current=src;setState('pending');}
 },[src]);
 return <div className={'image-shimmer-frame '+className+(state==='pending'?' is-image-loading':'')} style={style} role={state==='pending'?'status':undefined}
  aria-label={state==='pending'?alt+'을 불러오는 중':undefined}>
  {state==='pending'&&<span className="image-shimmer-band" aria-hidden="true"/>}
  <img className="image-shimmer-content" src={src} alt={alt} loading={loading} fetchPriority={fetchPriority}
   decoding="async" draggable={draggable} onLoad={event=>{onLoad?.(event.currentTarget.naturalWidth,event.currentTarget.naturalHeight);setState('ready');}} onError={()=>setState('pending')}/>
 </div>;
}
