import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Save,Search,X} from 'lucide-react';
import {PageHeading} from './pages/SitePages';
import {getHandoverNote,getHandoverPositions,saveHandoverNote,getHandoverArchive} from './handoverNotesApi';
import type {HandoverArchiveEntry,HandoverNote} from './handoverNotesApi';
import LoadingText from './LoadingText';
import {useToastSignals} from './useToastSignals';

type Kind='role'|'common';
function NoteEditor({kind,position,title,description,initial}:{kind:Kind;position:string;title:string;description:string;initial:HandoverNote}){
 const [text,setText]=useState(initial.content);
 const [original,setOriginal]=useState(initial.content);
 const [version,setVersion]=useState(initial.updateTime);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 useToastSignals({error,message});
 const loading=false;
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
 const [initialNotes,setInitialNotes]=useState<Record<string,HandoverNote>>({});
 useEffect(()=>{
  let mounted=true;
  void getHandoverPositions().then(async result=>{
   // Loading ends only when all role-specific and common documents are available.
   const pairs=await Promise.all([...result.positions.map(position=>({kind:'role' as const,position})),{kind:'common' as const,position:''}]
    .map(async item=>({key:item.kind+'|'+item.position,note:await getHandoverNote(item.kind,item.position)})));
   if(mounted){setIdentity(result);setInitialNotes(Object.fromEntries(pairs.map(pair=>[pair.key,pair.note])));}
  }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'인수인계를 불러올 수 없습니다.');})
    .finally(()=>{if(mounted)setReady(true);});
  return()=>{mounted=false;};
 },[]);
 const {positions,name,generation}=identity;
 const generationMatch=generation.trim().match(/^(\d+)(?:\.\d+)?기?$/);
 const generationLabel=generationMatch?generationMatch[1]+'기':generation.trim();
 const writerSubtitle=ready&&name?[generationLabel,positions.join(' · '),name].filter(Boolean).join(' '):'';
 return <>
  <div className="page-heading container handover-writer-heading">
   <span className="eyebrow">HANDOVER EDITOR</span>
   <h1>인수인계 작성하기</h1>
   {writerSubtitle&&<p className="handover-writer-subtitle">{writerSubtitle}</p>}
   <p className="handover-writer-guidance">앞으로 모여락을 이끌어갈 후배 운영진들을 위해 선배 운영진 여러분의 경험을 공유해주세요.</p>
  </div>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>

   {!ready?<LoadingText>작성 권한을 확인하는 중입니다</LoadingText>:!error&&<>
    {positions.length===0&&<p className="handover-editor-help">등록된 직책이 없습니다. 운영진에게 직책 정보를 확인해 주세요.</p>}
    {positions.map(position=><NoteEditor key={'role-'+position} kind="role" position={position}
     initial={initialNotes['role|'+position]} title={'직책별 인수인계 · '+position}
     description={'후배 '+position+'에게 전달하고 싶은 내용을 작성해주세요.'}/>)}
    <NoteEditor key="common" kind="common" position="" initial={initialNotes["common|"]} title="운영진 공통 인수인계"
     description="후배 운영진 모두에게 전달하고 싶은 내용을 작성해주세요."/>
   </>}
  </section>
 </>;
}

function archiveGeneration(generation:string){
 const match=generation.trim().match(/^(\d+)(?:\.\d+)?기?$/);
 return match?match[1]+'기':generation.trim();
}
export function HandoverNotesView({onBack}:{onBack:()=>void}){
 const [entries,setEntries]=useState<HandoverArchiveEntry[]>([]);
 const [query,setQuery]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<HandoverArchiveEntry|null>(null);
 const [notes,setNotes]=useState<{title:string;content:string}[]>([]);
 const [noteLoading,setNoteLoading]=useState(false);
 const [noteError,setNoteError]=useState('');
 const [reloadIndex,setReloadIndex]=useState(0);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');
  void getHandoverArchive().then(result=>{
   if(active)setEntries(result);
  }).catch(cause=>{
   if(active){setEntries([]);setError(cause instanceof Error?cause.message:'인수인계 목록을 불러오지 못했습니다.');}
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[reloadIndex]);
 const filtered=useMemo(()=>{
  const search=query.trim().toLocaleLowerCase('ko').replace(/\s+/g,'');
  if(!search)return entries;
  return entries.filter(entry=>{
   const fields=[entry.generation,archiveGeneration(entry.generation),entry.name,...entry.positions];
   return fields.some(field=>field.toLocaleLowerCase('ko').replace(/\s+/g,'').includes(search));
  });
 },[entries,query]);
 useEffect(()=>{
  if(!selected){setNotes([]);setNoteError('');return;}
  let active=true;
  setNoteLoading(true);setNoteError('');setNotes([]);
  void Promise.all(selected.notes.map(async note=>{
   const result=await getHandoverNote(note.kind,note.position,selected.uid);
   return {
    title:note.kind==='role'?'직책별 인수인계 · '+note.position:'운영진 공통 인수인계',
    content:result.content,
   };
  })).then(result=>{
   if(active)setNotes(result.filter(note=>note.content.trim()));
  }).catch(cause=>{
   if(active)setNoteError(cause instanceof Error?cause.message:'인수인계 내용을 불러오지 못했습니다.');
  }).finally(()=>{if(active)setNoteLoading(false);});
  return()=>{active=false;};
 },[selected]);
 useEffect(()=>{
  if(!selected)return;
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setSelected(null);
  };
  window.addEventListener('keydown',onKeyDown);
  return()=>window.removeEventListener('keydown',onKeyDown);
 },[selected]);
 return <>
  <PageHeading tag="HANDOVER ARCHIVE" title="인수인계 확인하기" description="역대 운영진이 남긴 인수인계 내용을 확인할 수 있습니다."/>
  <section className="container section-block handover-editor-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 인수인계로 돌아가기</button>
   <div className="handover-archive-toolbar">
    <label className="handover-archive-search"><Search size={17}/>
     <input type="search" placeholder="기수, 이름 또는 직책 검색" aria-label="인수인계 검색" value={query} onChange={event=>setQuery(event.target.value)}/>
    </label>
    <button type="button" className="outline-action" disabled={loading} onClick={()=>setReloadIndex(index=>index+1)}>새로고침</button>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {loading?<LoadingText>인수인계 목록을 불러오는 중입니다.</LoadingText>:
    filtered.length===0?<p className="handover-archive-notice">{query.trim()?'검색 결과가 없습니다.':'저장된 인수인계가 없습니다.'}</p>:
    <div className="handover-archive-list" aria-label="저장된 인수인계 목록">
     {filtered.map(entry=><div className="handover-archive-row" key={entry.uid}>
      <span className="handover-archive-generation">{archiveGeneration(entry.generation)}</span>
      <span className="handover-archive-positions">{entry.positions.join(', ')}</span>
      <strong className="handover-archive-name">{entry.name}</strong>
      <button type="button" className="outline-action" onClick={()=>setSelected(entry)} aria-label={entry.name+' 인수인계 확인하기'}>확인하기</button>
     </div>)}
    </div>}
  </section>
  {selected&&<div className="handover-preview-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
   <section className="handover-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="handover-preview-title">
    <div className="handover-preview-header">
     <div>
      <span className="eyebrow">HANDOVER NOTE</span>
      <h2 id="handover-preview-title">{[archiveGeneration(selected.generation),selected.positions.join(' · '),selected.name].filter(Boolean).join(' ')}</h2>
     </div>
     <button type="button" className="handover-preview-close" autoFocus aria-label="닫기" onClick={()=>setSelected(null)}><X size={20}/></button>
    </div>
    <div className="handover-preview-notes">
     {noteLoading?<LoadingText className="is-compact">인수인계 내용을 불러오는 중입니다.</LoadingText>:
      noteError?<p className="form-error" role="alert">{noteError}</p>:
      notes.length===0?<p className="handover-archive-notice">현재 확인할 수 있는 인수인계 내용이 없습니다.</p>:
      notes.map(note=><section className="handover-preview-note" key={note.title}>
       <h3>{note.title}</h3><p>{note.content}</p>
      </section>)}
    </div>
    <div className="handover-preview-footer"><button type="button" className="button button-secondary" onClick={()=>setSelected(null)}>닫기</button></div>
   </section>
  </div>}
 </>;
}
