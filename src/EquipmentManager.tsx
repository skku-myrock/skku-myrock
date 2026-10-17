import LoadingText from './LoadingText';
import {useToastSignals} from './useToastSignals';
import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowLeft,Check,ClipboardCheck,ImagePlus,Package,Plus,Save,Trash2,X} from 'lucide-react';
import {equipmentDate,equipmentStatusTone} from './equipmentDemo';
import type {EquipmentItem} from './equipmentDemo';
import type {EquipmentManageAction,EquipmentManageInput} from './equipmentApi';
import {uploadImagesBatch} from './imageUpload';
import {validateSourceImage} from './imageCompression';
import {PageHeading} from './pages/SitePages';

export default function EquipmentManager({items,busy,loading,error,onRefresh,onMutate,onBack}:{
 items:EquipmentItem[];busy:boolean;loading:boolean;error:string;
 onRefresh:()=>void;
 onMutate:(action:EquipmentManageAction,input:EquipmentManageInput)=>Promise<void>;
 onBack:()=>void;
}){
 const [editingId,setEditingId]=useState<string|null>(null);
 const [creating,setCreating]=useState(false);
 const [name,setName]=useState(''),[product,setProduct]=useState('');
 const [imageUrl,setImageUrl]=useState(''),[imageFile,setImageFile]=useState<File|null>(null),[previewUrl,setPreviewUrl]=useState('');
 const [saving,setSaving]=useState(false);
 const [correctingId,setCorrectingId]=useState<string|null>(null);
 const [correctionAction,setCorrectionAction]=useState<EquipmentManageAction>('force-return');
 const [studentId,setStudentId]=useState('');
 useEffect(()=>{
  if(!imageFile){setPreviewUrl('');return;}
  const url=URL.createObjectURL(imageFile);setPreviewUrl(url);
  return()=>URL.revokeObjectURL(url);
 },[imageFile]);
 const [feedback,setFeedback]=useState(''),[localError,setLocalError]=useState('');
 useToastSignals({error:localError,message:feedback});
 useToastSignals({error});
 const pending=items.filter(item=>item.status==='대여 승인 대기중');
 const returning=items.filter(item=>item.status==='반납 확인중');
 const borrowed=items.filter(item=>item.status==='대여중');
 const equipmentChanged=creating||Boolean(editingId&&items.some(item=>item.id===editingId&&(name.trim()!==item.name||product.trim()!==item.product||imageUrl.trim()!==(item.imageUrl??'')||imageFile!==null)));
 const begin=(item?:EquipmentItem)=>{
  setCreating(!item);setEditingId(item?.id??null);setCorrectingId(null);
  setName(item?.name??'');setProduct(item?.product??'');setImageUrl(item?.imageUrl??'');setImageFile(null);
  setFeedback('');setLocalError('');
 };
 const cancel=()=>{setCreating(false);setEditingId(null);setImageFile(null);};
 async function perform(action:EquipmentManageAction,input:EquipmentManageInput,label:string){
  setLocalError('');setFeedback('');
  try{await onMutate(action,input);setFeedback(label);if(['add','edit','delete'].includes(action))cancel();return true;}
  catch(e){setLocalError(e instanceof Error?e.message:'장비 관리 요청에 실패했습니다.');return false;}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||saving||!name.trim()||!product.trim()||!equipmentChanged)return;
  setSaving(true);setLocalError('');setFeedback('');
  try{
   const uploaded=imageFile?await uploadImagesBatch([imageFile],'equipment'):null;
   await onMutate(creating?'add':'edit',{
    id:editingId??undefined,name:name.trim(),product:product.trim(),
    imageUrl:uploaded?.[0]??imageUrl.trim(),
   });
   setFeedback(creating?'장비를 추가했습니다.':'장비 정보를 수정했습니다.');
   cancel();
  }catch(e){setLocalError(e instanceof Error?e.message:'장비 정보 저장에 실패했습니다.');}
  finally{setSaving(false);}
 }
 function beginCorrection(item:EquipmentItem){
  setCorrectingId(previous=>previous===item.id?null:item.id);
  setCreating(false);setEditingId(null);setImageFile(null);
  setCorrectionAction(item.borrower?'force-return':'force-loan');setStudentId('');
  setLocalError('');setFeedback('');
 }
 async function correctStatus(event:FormEvent<HTMLFormElement>,item:EquipmentItem){
  event.preventDefault();if(busy||saving)return;
  if(correctionAction==='force-available'&&!window.confirm(item.name+' 장비의 대여자, 반납 요청, 대기 신청을 모두 삭제하고 대여 가능으로 변경하시겠습니까?'))return;
  if(correctionAction==='clear-queue'&&!window.confirm(item.name+' 장비의 모든 대기 신청을 삭제하시겠습니까?'))return;
  if(correctionAction==='force-return'&&!window.confirm(item.name+' 장비를 실제 반납된 것으로 처리하시겠습니까? 대기 신청은 유지됩니다.'))return;
  if(correctionAction==='force-loan'&&item.queueLength>0&&!window.confirm('대기열에 다른 신청자가 있어도 지정한 학번으로 대여 처리합니다. 다른 신청은 대기열에 유지됩니다. 계속하시겠습니까?'))return;
  setSaving(true);
  try{
   const done=await perform(correctionAction,{id:item.id,...(['force-loan','add-request'].includes(correctionAction)?{studentId}:{})},'장비 대여 상태와 관련 정보를 정정했습니다.');
   if(done){setCorrectingId(null);setStudentId('');}
  }finally{setSaving(false);}
 }
 const details=(item:EquipmentItem)=><div className="equipment-manage-item-info">
  <div className="equipment-manage-description">
   {item.imageUrl?<img src={item.imageUrl} alt={item.name+' 장비 사진'} loading="lazy" decoding="async"/>:<div className="equipment-manage-photo-empty">사진 없음</div>}
   <div><strong>{item.name}</strong><span>{item.product}</span></div>
  </div>
  <small className={'equipment-status equipment-status-'+equipmentStatusTone(item.status)}>{item.borrower?`${item.status}(${equipmentDate(item.borrower.borrowedAt)}) · ${item.borrower.name}(${item.borrower.studentId})`:item.status}</small>
  {item.queueLength>0&&<span className="equipment-queue-caption">대기 신청 {item.queueLength}건</span>}
 </div>;
 return <>
  <PageHeading tag="EQUIPMENT MANAGEMENT" title="장비 관리" description="장비별 대여 현황, 승인 대기열 및 반납 요청을 관리합니다."/>
  <section className="container section-block equipment-manage-page" data-async-busy={busy||saving?"true":undefined}>
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 장비 목록으로 돌아가기</button>
   <div className="equipment-stats" aria-label="장비 현황">
    <div><Package size={18}/><span>전체 장비</span><strong>{items.length}</strong></div>
    <div><ClipboardCheck size={18}/><span>승인 대기</span><strong>{pending.length}</strong></div>
    <div><Package size={18}/><span>대여중</span><strong>{borrowed.length}</strong></div>
    <div><Package size={18}/><span>반납 확인중</span><strong>{returning.length}</strong></div>
   </div>
   <div className="equipment-manage-refresh"><button className="outline-action" type="button" onClick={onRefresh} disabled={busy||loading}>새로고침</button></div>
   
   {loading&&<p role="status">장비 현황을 불러오는 중입니다.</p>}
   <section className="equipment-manage-section" aria-labelledby="equipment-pending-title">
    <div className="equipment-manage-heading"><div><h2 id="equipment-pending-title">승인 대기 목록</h2><p>대여 신청은 먼저 신청한 부원부터 승인됩니다. 반납 확인도 이곳에서 처리합니다.</p></div></div>
    {loading?null:pending.length===0&&returning.length===0?<p className="equipment-manage-empty">승인이나 반납 확인이 필요한 장비가 없습니다.</p>:
     <div className="equipment-manage-list">
      {pending.map(item=><div className="equipment-manage-item" key={item.id}>
       {details(item)}
       <div className="equipment-manage-requests">{(item.queue??[]).map((person,index)=><span key={person.uid}>{index+1}순위 · {person.name}({person.studentId}) · {equipmentDate(person.requestedAt)} 신청</span>)}</div>
       <button type="button" className="button button-primary" disabled={busy||loading||saving} onClick={()=>void perform('approve',{id:item.id},'최선순위 신청자의 대여를 승인했습니다.')}><Check size={15}/> 승인</button>
      </div>)}
      {returning.map(item=><div className="equipment-manage-item" key={item.id}>
       {details(item)}
       <button type="button" className="button button-primary" disabled={busy||loading||saving} onClick={()=>void perform('confirm-return',{id:item.id},'반납을 확인했습니다.')}><Check size={15}/> 반납 확인</button>
      </div>)}
     </div>}
   </section>
   <section className="equipment-manage-section" aria-labelledby="equipment-inventory-title">
    <div className="equipment-manage-heading"><div><h2 id="equipment-inventory-title">보유 장비 목록</h2><p>장비 이름과 제품명을 수정할 수 있습니다. 관리자 정정 기능으로 대여자·대기열·반납 요청을 함께 변경할 수 있습니다.</p></div>
     <button type="button" className="button button-primary" disabled={busy||saving} onClick={()=>begin()}><Plus size={16}/> 장비 추가</button>
    </div>


    {(creating||editingId)&&<form className="equipment-manage-form" onSubmit={save}>
     <div className="equipment-manage-form-heading"><h3>{creating?'장비 추가':'장비 수정'}</h3><button type="button" aria-label="입력 취소" onClick={cancel}><X size={17}/></button></div>
     <div className="equipment-manage-fields">
      <label>장비 이름<input value={name} maxLength={60} required onChange={event=>setName(event.target.value)}/></label>
      <label>제품명<input value={product} maxLength={100} required onChange={event=>setProduct(event.target.value)}/></label>
      <label className="equipment-image-url-field">장비 이미지 URL (HTTPS)<input type="url" value={imageUrl} placeholder="https://..." onChange={event=>{setImageUrl(event.target.value);setImageFile(null);}}/></label>
     </div>
     <div className="equipment-manage-image-picker">
      <div className="equipment-manage-image-preview">
       {previewUrl||imageUrl?<img src={previewUrl||imageUrl} alt="장비 이미지 미리보기"/>:<span>사진 없음</span>}
      </div>
      <div className="equipment-manage-image-actions">
       <label className="outline-action"><ImagePlus size={15}/> 이미지 파일 선택
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||saving} onChange={event=>{
         const file=event.target.files?.[0];event.target.value='';if(!file)return;
         try{validateSourceImage(file);setImageFile(file);setLocalError('');}
         catch(e){setLocalError(e instanceof Error?e.message:'이미지를 확인해 주세요.');}
        }}/>
       </label>
       <button type="button" className="outline-action" disabled={busy||saving} onClick={()=>{setImageUrl('');setImageFile(null);}}>이미지 제거</button>
       <small>JPG·PNG·WebP, 원본 30MB 이하. 저장 시 WebP로 변환하여 업로드합니다.</small>
      </div>
     </div>
     <div className="equipment-manage-form-actions"><button type="button" className="outline-action" onClick={cancel} disabled={saving||busy}>취소</button><button type="submit" className="button button-primary" disabled={busy||saving||!equipmentChanged}><Save size={15}/> {saving?'저장 중…':creating?'추가하기':'저장하기'}</button></div>
    </form>}
    {loading?<LoadingText>장비 현황을 불러오는 중입니다.</LoadingText>:items.length===0?<p className="equipment-manage-empty">등록된 장비가 없습니다.</p>:
     <div className="equipment-manage-list">{items.map(item=><div className="equipment-manage-item" key={item.id}>
      {details(item)}
      <div className="equipment-manage-item-actions">
       <button type="button" className="outline-action" disabled={busy||loading||saving} onClick={()=>begin(item)}>수정</button>
       <button type="button" className="outline-action" disabled={busy||loading||saving} onClick={()=>beginCorrection(item)}>상태 정정</button>
       <button type="button" className="outline-action equipment-manage-danger" disabled={busy||loading||saving||item.queueLength>0||item.status==='대여중'||item.status==='반납 확인중'} title={item.queueLength>0||item.status!=='대여 가능'?'진행 중인 대여 신청이 있는 장비는 삭제할 수 없습니다.':undefined} onClick={()=>{
        if(!window.confirm(item.name+' 장비를 삭제하시겠습니까?'))return;
        void perform('delete',{id:item.id},'장비를 삭제했습니다.');
       }}><Trash2 size={14}/> 삭제</button>
      </div>
      {correctingId===item.id&&<form className="equipment-correction-form" onSubmit={event=>void correctStatus(event,item)}>
       <label>정정 작업
        <select value={correctionAction} onChange={event=>setCorrectionAction(event.target.value as EquipmentManageAction)}>
         <option value="force-return" disabled={!item.borrower}>강제 반납 완료 · 대기열 유지</option>
         <option value="force-available" disabled={!item.borrower&&!item.queueLength}>대여 가능으로 초기화 · 대여자·대기열 삭제</option>
         <option value="force-loan" disabled={Boolean(item.borrower)}>대여자 직접 지정</option>
         <option value="add-request" disabled={Boolean(item.borrower)}>대기 신청자 추가</option>
         <option value="clear-queue" disabled={!item.queueLength}>대기 신청 전부 취소</option>
         <option value="force-request-return" disabled={!item.borrower||item.status==='반납 확인중'}>반납 확인중으로 변경</option>
         <option value="cancel-return" disabled={item.status!=='반납 확인중'}>반납 요청 취소 · 대여중 복귀</option>
        </select>
       </label>
       {['force-loan','add-request'].includes(correctionAction)&&<label>대상 부원 학번<input inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required value={studentId} placeholder="학번 10자리" onChange={event=>setStudentId(event.target.value.replace(/\D/g,''))}/></label>}
       <p>상태는 대여자·대기 신청·반납 요청에 따라 자동 결정됩니다. 정정은 저장 즉시 실제 대여 데이터에 반영됩니다.</p>
       <div className="equipment-manage-form-actions"><button type="button" className="outline-action" onClick={()=>setCorrectingId(null)} disabled={busy||saving}>취소</button>
       <button type="submit" className="button button-primary" disabled={busy||saving||(['force-loan','add-request'].includes(correctionAction)&&studentId.length!==10)}>{saving?'처리 중…':'정정 실행'}</button></div>
      </form>}
     </div>)}</div>}
   </section>
  </section>
 </>;
}
