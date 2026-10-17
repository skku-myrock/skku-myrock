import type {ReactNode} from 'react';

/** Single-line, quiet loading status. The gallery is the style reference. */
export default function LoadingText({children,className=''}:{children:ReactNode;className?:string}){
 return <p role="status" className={'loading-text'+(className?' '+className:'')}>{children}</p>;
}
