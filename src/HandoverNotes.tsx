import {useEffect,useState} from 'react';
import {ArrowLeft,Save,X} from 'lucide-react';
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
 const generationMatch=generation.trim().match(/^(\d+)(?:\.\d+)?기?$/);
 const generationLabel=generationMatch?generationMatch[1]+'기':generation.trim();
 const writerSubtitle=ready&&name?[generationLabel,positions.join(' · '),name].filter(Boolean).join(' '):'작성자 정보를 불러오는 중입니다.';
 return <>
  <div className="handover-writer-heading"><PageHeading tag="HANDOVER EDITOR" title="인수인계 작성하기" description={writerSubtitle}/></div>
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

// Illustrative entries only: these are not actual Firestore handover documents.
const exampleArchive=[
 {generation:'27기',positions:'보컬파트장',name:'나재원',notes:[
  {title:'직책별 인수인계 · 보컬파트장',content:'정기 합주 전에는 곡별 보컬 파트와 키를 정리하고, 마이크와 모니터 장비의 상태를 확인해주세요. 합주에서 결정된 변경 사항은 파트원들에게 공유해주세요.'},
  {title:'운영진 공통 인수인계',content:'운영 회의에서 정해진 공연 일정과 담당자를 문서로 남겨주세요. 후임 운영진이 진행 상황을 이어받을 수 있도록 준비 사항도 함께 정리해주세요.'},
 ]},
 {generation:'28기',positions:'회장, 보컬파트장',name:'김서연',notes:[
  {title:'직책별 인수인계 · 회장',content:'학기 초 운영진 회의 일정을 정하고, 부서별 업무 분장을 기록해주세요. 중요한 대외 협의 사항은 회의록과 함께 정리해주세요.'},
  {title:'직책별 인수인계 · 보컬파트장',content:'공연마다 보컬 파트 인원과 곡별 동선을 점검해주세요. 리허설 일정과 필요한 장비도 파트원들에게 미리 안내해주세요.'},
  {title:'운영진 공통 인수인계',content:'행사 준비 일정과 예산, 진행 담당자를 한 문서에서 관리해주세요. 행사가 끝난 뒤 개선할 점도 기록해두면 좋습니다.'},
 ]},
 {generation:'28기',positions:'공연부장, 기타파트장',name:'배은성',notes:[
  {title:'직책별 인수인계 · 공연부장',content:'공연장 대관 일정과 음향·조명 요청 사항을 확인하고, 리허설 시간표를 구성원에게 공유해주세요.'},
  {title:'직책별 인수인계 · 기타파트장',content:'기타 앰프와 케이블 상태를 점검하고, 파트별 합주 일정과 필요한 장비를 미리 조율해주세요.'},
  {title:'운영진 공통 인수인계',content:'공연이 끝나면 장비 반환과 정산 기록을 마무리하고, 다음 기수가 참고할 자료를 한곳에 정리해주세요.'},
 ]},
];

export function HandoverNotesView({onBack}:{onBack:()=>void}){
 const [selectedIndex,setSelectedIndex]=useState<number|null>(null);
 const selected=selectedIndex===null?null:exampleArchive[selectedIndex];
 useEffect(()=>{
  if(selectedIndex===null)return;
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setSelectedIndex(null);
  };
  window.addEventListener('keydown',onKeyDown);
  return()=>window.removeEventListener('keydown',onKeyDown);
 },[selectedIndex]);
 return <>
  <PageHeading tag="HANDOVER ARCHIVE" title="인수인계 확인하기" description="현직 운영진과 OB 운영진 모두 인수인계를 확인할 수 있습니다."/>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>
   <p className="handover-archive-notice">아래 목록과 열람 내용은 화면 구성 예시입니다. 실제 작성자별 인수인계 조회는 추후 연결됩니다.</p>
   <div className="handover-archive-list" aria-label="인수인계 목록 예시">
    {exampleArchive.map((entry,index)=><div className="handover-archive-row" key={index}>
     <span className="handover-archive-generation">{entry.generation}</span>
     <span className="handover-archive-positions">{entry.positions}</span>
     <strong className="handover-archive-name">{entry.name}</strong>
     <button type="button" className="outline-action" onClick={()=>setSelectedIndex(index)} aria-label={entry.name+' 인수인계 확인하기'}>확인하기</button>
    </div>)}
   </div>
  </section>
  {selected&&<div className="handover-preview-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedIndex(null);}}>
   <section className="handover-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="handover-preview-title" aria-describedby="handover-preview-description">
    <div className="handover-preview-header">
     <div>
      <span className="eyebrow">HANDOVER PREVIEW</span>
      <h2 id="handover-preview-title">{selected.name}의 인수인계</h2>
      <p>{selected.generation} · {selected.positions}</p>
     </div>
     <button type="button" className="handover-preview-close" autoFocus aria-label="닫기" onClick={()=>setSelectedIndex(null)}><X size={20}/></button>
    </div>
    <p id="handover-preview-description" className="handover-preview-hint">실제 작성된 기록이 아닌 예시 내용입니다.</p>
    <div className="handover-preview-notes">{selected.notes.map(note=><section className="handover-preview-note" key={note.title}>
     <h3>{note.title}</h3><p>{note.content}</p>
    </section>)}</div>
    <div className="handover-preview-footer"><button type="button" className="button button-secondary" onClick={()=>setSelectedIndex(null)}>닫기</button></div>
   </section>
  </div>}
 </>;
}
