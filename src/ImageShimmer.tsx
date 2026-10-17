import {useState} from 'react';
import type {ReactNode} from 'react';

/** Keep the image frame stable until the actual image finishes loading. */
export default function ImageShimmer({src,alt,className='',loading='lazy',fetchPriority='auto',fallback}:{
 src:string;alt:string;className?:string;loading?:'eager'|'lazy';fetchPriority?:'high'|'low'|'auto';fallback?:ReactNode;
}){
 const [state,setState]=useState<'pending'|'ready'|'error'>('pending');
 return <div className={'image-shimmer-frame '+className+(state==='pending'?' is-image-loading':'')} role={state==='pending'?'status':undefined}
  aria-label={state==='pending'?alt+'을 불러오는 중':undefined}>
  {state==='pending'&&<span className="image-shimmer-band" aria-hidden="true"/>}
  {state==='error'?(fallback??<span className="image-shimmer-error">사진을 불러올 수 없습니다.</span>):null}
  <img className="image-shimmer-content" src={src} alt={alt} loading={loading} fetchPriority={fetchPriority}
   decoding="async" onLoad={()=>setState('ready')} onError={()=>setState('error')} hidden={state==='error'}/>
 </div>;
}
