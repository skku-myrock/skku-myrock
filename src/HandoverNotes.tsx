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
 const [identity,setIdentity]=useState<{positions:string[];name:string;generation:string}>({
  positions:[],name:'',generation:'',
 });
 const [error,setError]=useState('');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let mounted=true;
  void getHandoverPositions().then(result=>{
   if(mounted)setIdentity(result);
  }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'직책을 확인할 수 없습니다.');})
    .finally(()=>{if(mounted)setReady(true);});
  return()=>{mounted=false;};
 },[]);
 const {positions,name,generation}=identity;
 const generationLabel=generation?(generation.endsWith('기')?generation:generation+'기'):'';
 const writerSubtitle=ready&&name?[generationLabel,positions.join(' · '),name].filter(Boolean).join(' '):'작성자 정보를 불러오는 중입니다.';
 return <>
  <PageHeading tag="HANDOVER EDITOR" title="인수인계 작성하기" description={writerSubtitle}/>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>
   <p className="handover-editor-intro">현직 운영진과 OB 운영진 모두 작성된 인수인계를 확인할 수 있습니다.</p>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {!ready?<p role="status">작성 권한을 확인하는 중입니다.</p>:!error&&<>
    {positions.length===0&&<p className="handover-editor-help">등록된 직책이 없습니다. 운영진에게 직책 정보를 확인해 주세요.</p>}
    {positions.map(position=><NoteEditor key={'role-'+position} kind="role" position={position}
     title={'직책별 인수인계 · '+position}
     description={'후배 '+position+'에게 전달하고 싶은 내용을 작성해주세요.'}/>)}
    <NoteEditor key="common" kind="common" position="" title="운영진 공통 인수인계"
     description="후배 운영진 모두에게 전달하고 싶은 내용을 작성해주세요."/>
   </>}
  </section>
 </>;
}

const exampleArchive=[
 {generation:'27기',positions:'보컬파트장',name:'나재원'},
 {generation:'28기',positions:'회장, 보컬파트장',name:'김서연'},
 {generation:'28기',positions:'공연부장, 기타파트장',name:'배은성'},
];
export function HandoverNotesView({onBack}:{onBack:()=>void}){
 return <>
  <PageHeading tag="HANDOVER ARCHIVE" title="인수인계 확인하기" description="현직 운영진과 OB 운영진 모두 인수인계를 확인할 수 있습니다."/>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>
   <p className="handover-archive-notice">아래 목록은 화면 구성 예시입니다. 실제 작성자별 조회 및 열람 기능은 추후 연결됩니다.</p>
   <div className="handover-archive-list" aria-label="인수인계 목록 예시">
    {exampleArchive.map((entry,index)=><div className="handover-archive-row" key={index}>
     <span className="handover-archive-generation">{entry.generation}</span>
     <span className="handover-archive-positions">{entry.positions}</span>
     <strong className="handover-archive-name">{entry.name}</strong>
     <button type="button" className="outline-action" disabled title="상세 열람은 추후 지원 예정입니다.">확인하기</button>
    </div>)}
   </div>
  </section>
 </>;
}
