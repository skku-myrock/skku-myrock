import {useEffect,useState} from 'react';
import {ArrowLeft,Save} from 'lucide-react';
import {PageHeading} from './pages/SitePages';
import {getHandoverNote,getHandoverPositions,saveHandoverNote} from './handoverNotesApi';

type Kind='role'|'common';
function NoteEditor({kind,position,title,description}:{
 kind:Kind;position:string;title:string;description:string;
}){
 const [text,setText]=useState('');
 const [original,setOriginal]=useState('');
 const [version,setVersion]=useState('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  if(kind==='role'&&!position){setLoading(false);return;}
  let active=true;
  setLoading(true);setError('');setMessage('');
  void getHandoverNote(kind,position).then(note=>{
   if(!active)return;
   setText(note.content);setOriginal(note.content);setVersion(note.updateTime);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'인수인계를 불러올 수 없습니다.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[kind,position]);
 const dirty=text!==original;
 async function save(){
  if(loading||saving||!dirty||!position&&kind==='role')return;
  setSaving(true);setError('');setMessage('');
  const snapshot=text;
  try{
   const result=await saveHandoverNote(kind,position,snapshot,version);
   setOriginal(snapshot);setVersion(result.updateTime);setMessage('인수인계 내용을 저장했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'저장에 실패했습니다.');}
  finally{setSaving(false);}
 }
 return <section className="handover-editor-panel">
  <div className="handover-editor-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
  {kind==='role'&&!position?<p className="handover-editor-help">연결된 직책이 없어 직책별 인수인계를 작성할 수 없습니다.</p>:
   <>
    <textarea value={text} disabled={loading||saving} onChange={e=>{setText(e.target.value);setMessage('');}} maxLength={30000} placeholder="인수인계 내용을 입력하세요." aria-label={title} rows={11}/>
    <div className="handover-editor-actions"><span>{loading?'이전 내용을 불러오는 중입니다.':dirty?'저장하지 않은 변경 사항이 있습니다.':'저장된 내용입니다.'}</span>
     <button type="button" className="button button-primary" disabled={loading||saving||!dirty} onClick={()=>void save()}><Save size={15}/>{saving?'저장 중…':'저장하기'}</button></div>
   </>
  }
  {error&&<p className="form-error" role="alert">{error}</p>}
  {message&&<p className="handover-save-notice" role="status">{message}</p>}
 </section>;
}
export default function HandoverNotesEditor({onBack}:{onBack:()=>void}){
 const [positions,setPositions]=useState<string[]>([]);
 const [position,setPosition]=useState('');
 const [error,setError]=useState('');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let mounted=true;
  void getHandoverPositions().then(result=>{
   if(!mounted)return;
   setPositions(result.positions);
   setPosition(result.positions[0]??'');
  }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'직책을 확인할 수 없습니다.');})
    .finally(()=>{if(mounted)setReady(true);});
  return()=>{mounted=false;};
 },[]);
 return <>
  <PageHeading tag="HANDOVER EDITOR" title="인수인계 작성하기" description="직책별 인수인계와 운영진 공통 인수인계를 각각 작성하고 저장합니다."/>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {!ready?<p role="status">작성 권한을 확인하는 중입니다.</p>:<>
    {positions.length>1&&<label className="handover-position-picker">작성 직책
     <select value={position} onChange={event=>{
      if(event.target.value===position)return;
      if(!window.confirm('직책을 변경하면 저장하지 않은 수정 내용이 사라질 수 있습니다. 변경하시겠습니까?'))return;
      setPosition(event.target.value);
     }}>{positions.map(item=><option key={item} value={item}>{item}</option>)}</select>
    </label>}
    <NoteEditor kind="role" position={position} title={'직책별 인수인계'+(position?' · '+position:'')} description="현재 선택한 직책을 가진 운영진만 확인할 수 있는 내용입니다."/>
    <NoteEditor kind="common" position="" title="운영진 공통 인수인계" description="인수인계 접근 권한을 가진 운영진 모두가 확인할 수 있는 내용입니다."/>
   </>}
  </section>
 </>;
}
export function HandoverNotesView({onBack}:{onBack:()=>void}){
 return <>
  <PageHeading tag="HANDOVER ARCHIVE" title="인수인계 확인하기" description="운영진 인수인계를 확인하는 공간입니다."/>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>
   <div className="handover-view-placeholder"><h2>인수인계 확인하기</h2><p>이 페이지의 상세 열람 화면은 추후 구현할 예정입니다.</p></div>
  </section>
 </>;
}
