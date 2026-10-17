import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import {ArrowLeft,ArrowDown,ArrowUp,ImagePlus,Plus,Save,Trash2} from 'lucide-react';
import {DEFAULT_ABOUT,getAboutManagement,saveAbout} from './aboutContent';
import {uploadImagesBatch} from './imageUpload';
import {validateSourceImage} from './imageCompression';
import {useEditorLeaveGuard} from './useEditorLeaveGuard';
import TimedBottomToast from './TimedBottomToast';
import type {AboutContent,Officer,HistoryEntry} from './aboutContent';

type PhotoTarget={type:'home'}|{type:'hero'}|{type:'officer';id:string};

export default function AboutManagement({onBack,onSaved,registerLeaveGuard}:{onBack:()=>void;onSaved:(message?:string)=>void;registerLeaveGuard:(guard:(()=>boolean)|null)=>void}){
  const [content,setContent]=useState<AboutContent>(structuredClone(DEFAULT_ABOUT));
  const [version,setVersion]=useState<string|null>(null);
  const savedSnapshot=useRef<string|null>(null);
  const staged=useRef(new Map<string,File>());
  const uploaded=useRef(new Map<string,string>());
  useEffect(()=>()=>{for(const key of staged.current.keys())URL.revokeObjectURL(key);},[]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const hasUnsavedChanges=!loading&&savedSnapshot.current!==null&&JSON.stringify(content)!==savedSnapshot.current;
  useEditorLeaveGuard(hasUnsavedChanges||busy,registerLeaveGuard);
  useEffect(()=>{
    let active=true;
    void getAboutManagement().then(data=>{
      if(active){savedSnapshot.current=JSON.stringify(data.content);setContent(data.content);setVersion(data.updateTime);}
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'조회 실패');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  function updateOfficer(id:string,field:keyof Omit<Officer,'id'>,value:string){
    setContent(previous=>({...previous,officers:previous.officers.map(x=>x.id===id?{...x,[field]:value}:x)}));
    setMessage('');
  }
  function updateHistory(id:string,field:keyof Omit<HistoryEntry,'id'>,value:string){
    setContent(previous=>({...previous,history:previous.history.map(x=>x.id===id?{...x,[field]:value}:x)}));
    setMessage('');
  }
  function reorder<T extends {id:string}>(key:'officers'|'history',index:number,offset:number){
    const arr=[...content[key]] as unknown as T[];
    const target=index+offset;if(target<0||target>=arr.length)return;
    [arr[index],arr[target]]=[arr[target],arr[index]];
    setContent(prev=>({...prev,[key]:arr}));setMessage('');
  }
  function chooseImage(event:ChangeEvent<HTMLInputElement>,target:PhotoTarget){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||busy)return;
    try{validateSourceImage(file);}catch(reason){setError(reason instanceof Error?reason.message:'이미지 형식이나 크기를 확인해 주세요.');return;}
    const url=URL.createObjectURL(file);staged.current.set(url,file);
    if(target.type==='home')setContent(prev=>({...prev,homeImage:url}));
    else if(target.type==='hero')setContent(prev=>({...prev,heroImage:url}));
    else updateOfficer(target.id,'photoUrl',url);
    setError('');setMessage('선택한 사진은 로컬 미리보기입니다. 변경 사항 저장 시 업로드됩니다.');
  }
  async function save(){
    if(busy||loading)return;
    setError('');setMessage('');setBusy(true);
    try{
      const sources=[content.homeImage,content.heroImage,...content.officers.map(o=>o.photoUrl)];
      const pending=[...new Set(sources.filter(url=>staged.current.has(url)&&!uploaded.current.has(url)))];
      if(pending.length){
        const urls=await uploadImagesBatch(pending.map(url=>staged.current.get(url)!));
        pending.forEach((url,i)=>uploaded.current.set(url,urls[i]));
      }
      const resolved=(url:string)=>uploaded.current.get(url)??url;
      const next={...content,homeImage:resolved(content.homeImage),heroImage:resolved(content.heroImage),officers:content.officers.map(person=>({...person,photoUrl:resolved(person.photoUrl)}))};
      const updated=await saveAbout(next,version);
      savedSnapshot.current=JSON.stringify(updated.content);
      setContent(updated.content);setVersion(updated.updateTime);
      registerLeaveGuard(null);
      onSaved(updated.siteCleanup?.pending?'소개 정보는 저장했지만 이전 사진의 자동 정리가 지연되었습니다. 다음 정리 때 다시 확인해야 합니다.':undefined);
    }catch(reason){setError(reason instanceof Error?reason.message:'저장 오류');}
    finally{setBusy(false);}
  }
  return <>
    <div className="page-heading container"><span className="eyebrow">CLUB INTRODUCTION MANAGEMENT</span><h1>동아리 소개 수정</h1>
      <p>메인 페이지 사진, 동아리 소개 사진, 운영진 명단과 연혁을 수정합니다.</p></div>
    <div className="container about-manage" data-async-busy={busy?'true':undefined}>
      <button className="finance-return-link" type="button" onClick={onBack}><ArrowLeft size={16}/> 소개 페이지로 돌아가기</button>

      {loading?<p>소개 정보를 불러오는 중입니다.</p>:<>
        <p className="image-compression-notice" role="note">이미지를 저장할 때 자동으로 압축·크기 조정할 수 있습니다. <strong>업로드된 이미지는 원본을 대체하지 못하므로 원본 사진을 별도로 보관해 주세요.</strong></p>
        <section className="about-manage-section">
          <h2>메인 페이지 사진</h2>
          <div className="about-manage-photo">
            {content.homeImage?<img src={content.homeImage} alt="메인 페이지 사진 미리보기"/>:<div className="about-manage-photo-empty">등록된 메인 페이지 사진이 없습니다.</div>}
            <div className="about-manage-photo-controls">
              <label>이미지 URL<input type="url" placeholder="https://..." value={content.homeImage} onChange={e=>{setContent(p=>({...p,homeImage:e.target.value}));setMessage('');}}/></label>
              <label className="outline-action about-image-upload"><ImagePlus size={14}/> 파일 업로드
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void chooseImage(e,{type:'home'})}/>
              </label>
              <button type="button" className="outline-action" disabled={busy||!content.homeImage} onClick={()=>setContent(p=>({...p,homeImage:''}))}>사진 제거</button>
            </div>
          </div>
          <p className="about-manage-hint">메인 페이지의 첫 화면에 표시되는 사진입니다. 외부 HTTPS 이미지 URL 또는 JPG/PNG/WebP 사진(원본 30MB 이하)을 사용할 수 있습니다.</p>
        </section>
        <section className="about-manage-section">
          <h2>동아리 소개 사진</h2>
          <div className="about-manage-photo">
            {content.heroImage?<img src={content.heroImage} alt="동아리 소개 사진 미리보기"/>:<div className="about-manage-photo-empty">등록된 동아리 소개 사진이 없습니다.</div>}
            <div className="about-manage-photo-controls">
              <label>이미지 URL<input type="url" placeholder="https://..." value={content.heroImage} onChange={e=>{setContent(p=>({...p,heroImage:e.target.value}));setMessage('');}}/></label>
              <label className="outline-action about-image-upload"><ImagePlus size={14}/> 파일 업로드
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void chooseImage(e,{type:'hero'})}/>
              </label>
              <button type="button" className="outline-action" disabled={busy||!content.heroImage} onClick={()=>setContent(p=>({...p,heroImage:''}))}>사진 제거</button>
            </div>
          </div>
          <p className="about-manage-hint">동아리 소개 페이지에 표시되는 사진입니다. 외부 HTTPS 이미지 URL 또는 JPG/PNG/WebP 사진(원본 30MB 이하)을 사용할 수 있습니다.</p>
        </section>
        <section className="about-manage-section">
          <div className="about-manage-section-heading"><h2>운영진 명단</h2><button type="button" className="outline-action" disabled={busy||content.officers.length>=40} onClick={()=>{
            setContent(p=>({...p,officers:[...p.officers,{id:crypto.randomUUID(),name:'',position:'',photoUrl:''}]}));setMessage('');
          }}><Plus size={15}/> 운영진 추가</button></div>
          <label className="about-manage-label">소개 제목<input maxLength={80} value={content.cohortLabel} onChange={e=>setContent(p=>({...p,cohortLabel:e.target.value}))}/></label>
          <div className="about-manage-items">
            {content.officers.map((person,index)=><article className="about-manage-item" key={person.id}>
              <div className="about-manage-item-head"><strong>{index+1}번째 운영진</strong><div className="about-manage-actions">
                <button type="button" disabled={busy||index===0} onClick={()=>reorder<Officer>('officers',index,-1)} aria-label="운영진 위로 이동"><ArrowUp size={15}/></button>
                <button type="button" disabled={busy||index===content.officers.length-1} onClick={()=>reorder<Officer>('officers',index,1)} aria-label="운영진 아래로 이동"><ArrowDown size={15}/></button>
                <button type="button" disabled={busy} onClick={()=>setContent(p=>({...p,officers:p.officers.filter(x=>x.id!==person.id)}))}><Trash2 size={15}/> 삭제</button>
              </div></div>
              <div className="about-manage-fields"><label>이름<input maxLength={65} value={person.name} onChange={e=>updateOfficer(person.id,'name',e.target.value)}/></label>
                <label>직위<input maxLength={110} value={person.position} onChange={e=>updateOfficer(person.id,'position',e.target.value)}/></label>
                <label>사진 URL<input type="url" placeholder="https://..." value={person.photoUrl} onChange={e=>updateOfficer(person.id,'photoUrl',e.target.value)}/></label>
              </div>
              <div className="about-manage-officer-photo">
                {person.photoUrl&&<img src={person.photoUrl} alt={person.name+' 사진 미리보기'}/>}
                <label className="outline-action about-image-upload"><ImagePlus size={14}/> 사진 파일 업로드
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void chooseImage(e,{type:'officer',id:person.id})}/>
                </label>
              </div>
            </article>)}
          </div>
        </section>
        <section className="about-manage-section">
          <div className="about-manage-section-heading"><h2>연혁</h2><button type="button" className="outline-action" disabled={busy||content.history.length>=100} onClick={()=>{
            setContent(p=>({...p,history:[...p.history,{id:crypto.randomUUID(),year:'',description:''}]}));setMessage('');
          }}><Plus size={15}/> 연혁 추가</button></div>
          <div className="about-manage-items">
            {content.history.map((item,index)=><div className="about-manage-item" key={item.id}>
              <div className="about-manage-item-head"><strong>{index+1}번째 연혁</strong><div className="about-manage-actions">
                <button type="button" disabled={busy||index===0} onClick={()=>reorder<HistoryEntry>('history',index,-1)} aria-label="연혁 위로 이동"><ArrowUp size={15}/></button>
                <button type="button" disabled={busy||index===content.history.length-1} onClick={()=>reorder<HistoryEntry>('history',index,1)} aria-label="연혁 아래로 이동"><ArrowDown size={15}/></button>
                <button type="button" disabled={busy} onClick={()=>setContent(p=>({...p,history:p.history.filter(x=>x.id!==item.id)}))}><Trash2 size={15}/> 삭제</button>
              </div></div>
              <div className="about-manage-fields about-manage-history-fields">
                <label>연도<input maxLength={40} value={item.year} placeholder="2026년" onChange={e=>updateHistory(item.id,'year',e.target.value)}/></label>
                <label>내용<input maxLength={250} value={item.description} onChange={e=>updateHistory(item.id,'description',e.target.value)}/></label>
              </div>
            </div>)}
          </div>
        </section>
        <div className="about-manage-footer"><button type="button" className="button button-primary" disabled={busy} onClick={()=>void save()}><Save size={16}/> 변경 사항 저장</button></div>
      </>}
    </div>
    {(error||message)&&<TimedBottomToast
      message={error||message} tone={error?'error':'success'}
      onClose={()=>{setError('');setMessage('');}}
    />}
  </>;
}
