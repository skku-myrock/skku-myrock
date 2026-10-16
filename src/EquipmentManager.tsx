import {useState} from 'react';
import type {Dispatch,FormEvent,SetStateAction} from 'react';
import {ArrowLeft,Check,ClipboardCheck,Package,Plus,Save,Trash2,X} from 'lucide-react';
import {EQUIPMENT_STATUSES,equipmentStatusTone} from './equipmentDemo';
import type {EquipmentItem,EquipmentStatus} from './equipmentDemo';
import {PageHeading} from './pages/SitePages';

type EquipmentForm = {name:string;product:string;status:EquipmentStatus};
const emptyForm:EquipmentForm = {name:'',product:'',status:'대여 가능'};

export default function EquipmentManager({
 items,setItems,onBack,
}:{
 items:EquipmentItem[];
 setItems:Dispatch<SetStateAction<EquipmentItem[]>>;
 onBack:()=>void;
}){
 const [editingId,setEditingId]=useState<string|null>(null);
 const [creating,setCreating]=useState(false);
 const [form,setForm]=useState<EquipmentForm>(emptyForm);
 const [message,setMessage]=useState('');
 const pending=items.filter(item=>item.status==='대여 승인 대기중');
 const borrowed=items.filter(item=>item.status==='대여중');
 const returns=items.filter(item=>item.status==='반납 확인중');

 function startCreate(){
  setCreating(true);setEditingId(null);setForm({...emptyForm});setMessage('');
 }
 function startEdit(item:EquipmentItem){
  setEditingId(item.id);setCreating(false);
  setForm({name:item.name,product:item.product,status:item.status});setMessage('');
 }
 function cancelEdit(){setCreating(false);setEditingId(null);}
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const name=form.name.trim(),product=form.product.trim();
  if(!name||!product)return;
  if(creating){
   setItems(previous=>[...previous,{id:'local-'+crypto.randomUUID(),name,product,status:form.status}]);
   setMessage('화면에 장비를 추가했습니다. 새로고침하면 초기화됩니다.');
  }else if(editingId){
   setItems(previous=>previous.map(item=>item.id===editingId?{...item,name,product,status:form.status}:item));
   setMessage('화면에 변경 사항을 반영했습니다. 서버에는 저장되지 않습니다.');
  }
  cancelEdit();
 }
 function remove(item:EquipmentItem){
  if(!window.confirm(item.name+' ('+item.product+') 장비를 화면에서 삭제하시겠습니까? 실제 데이터는 삭제되지 않습니다.'))return;
  setItems(previous=>previous.filter(entry=>entry.id!==item.id));
  if(editingId===item.id)cancelEdit();
  setMessage('화면에서 장비를 삭제했습니다. 새로고침하면 복원됩니다.');
 }

 return <>
  <PageHeading tag="EQUIPMENT MANAGEMENT" title="장비 관리" description="장비별 대여 상태를 확인하고 장비 목록을 관리하는 공간입니다."/>
  <section className="container section-block equipment-manage-page">
   <button type="button" className="schedule-back-button" onClick={onBack}><ArrowLeft size={16}/> 장비 목록으로 돌아가기</button>
   <div className="equipment-demo-notice" role="note"><strong>UI 미리보기</strong><span>아래 장비와 대여 상태는 예시 데이터입니다. 추가·수정·삭제는 현재 화면에만 반영되며, 새로고침하면 초기화됩니다. 승인 및 실제 대여 처리는 아직 지원하지 않습니다.</span></div>
   <div className="equipment-stats" aria-label="장비 현황">
    <div><Package size={18}/><span>전체 장비</span><strong>{items.length}</strong></div>
    <div><ClipboardCheck size={18}/><span>승인 대기</span><strong>{pending.length}</strong></div>
    <div><Package size={18}/><span>대여중</span><strong>{borrowed.length}</strong></div>
    <div><Package size={18}/><span>반납 확인중</span><strong>{returns.length}</strong></div>
   </div>

   <section className="equipment-manage-section" aria-labelledby="equipment-pending-title">
    <div className="equipment-manage-heading"><div><h2 id="equipment-pending-title">승인 대기 목록</h2><p>대여 승인 요청의 화면 예시입니다.</p></div></div>
    {pending.length===0?<p className="equipment-manage-empty">승인 대기중인 장비가 없습니다.</p>:
     <div className="equipment-manage-list">{pending.map(item=>
      <div className="equipment-manage-item" key={item.id}>
       <div className="equipment-manage-item-info"><strong>{item.name}</strong><span>{item.product}</span><small className={'equipment-status equipment-status-'+equipmentStatusTone(item.status)}>{item.status}</small></div>
       <button type="button" className="button button-primary" disabled title="승인 기능은 아직 연결되지 않았습니다."><Check size={15}/> 승인</button>
      </div>
     )}</div>}
   </section>

   <section className="equipment-manage-section" aria-labelledby="equipment-inventory-title">
    <div className="equipment-manage-heading"><div><h2 id="equipment-inventory-title">보유 장비 목록</h2><p>장비 이름·제품명·대여 상태를 화면에서 변경할 수 있습니다.</p></div>
     <button type="button" className="button button-primary" onClick={startCreate}><Plus size={16}/> 장비 추가</button>
    </div>
    {message&&<p className="equipment-manage-feedback" role="status">{message}</p>}
    {(creating||editingId)&&<form className="equipment-manage-form" onSubmit={save}>
     <div className="equipment-manage-form-heading"><h3>{creating?'장비 추가':'장비 수정'}</h3><button type="button" aria-label="입력 취소" onClick={cancelEdit}><X size={17}/></button></div>
     <div className="equipment-manage-fields">
      <label>장비 이름<input value={form.name} maxLength={60} required placeholder="예: 기타" onChange={e=>setForm(current=>({...current,name:e.target.value}))}/></label>
      <label>제품명<input value={form.product} maxLength={100} required placeholder="예: 바커스 BST-2-RSM" onChange={e=>setForm(current=>({...current,product:e.target.value}))}/></label>
      <label>대여 상태<select value={form.status} onChange={e=>setForm(current=>({...current,status:e.target.value as EquipmentStatus}))}>{EQUIPMENT_STATUSES.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
     </div>
     <div className="equipment-manage-form-actions"><button type="button" className="outline-action" onClick={cancelEdit}>취소</button><button type="submit" className="button button-primary"><Save size={15}/> {creating?'추가하기':'변경 사항 적용'}</button></div>
    </form>}
    {items.length===0?<p className="equipment-manage-empty">표시할 장비가 없습니다. 장비 추가를 눌러 등록해 보세요.</p>:
     <div className="equipment-manage-list">{items.map(item=>
      <div className="equipment-manage-item" key={item.id}>
       <div className="equipment-manage-item-info"><strong>{item.name}</strong><span>{item.product}</span><small className={'equipment-status equipment-status-'+equipmentStatusTone(item.status)}>{item.status}</small></div>
       <div className="equipment-manage-item-actions">
        <button type="button" className="outline-action" onClick={()=>startEdit(item)}>수정</button>
        <button type="button" className="outline-action equipment-manage-danger" onClick={()=>remove(item)}><Trash2 size={14}/> 삭제</button>
       </div>
      </div>
     )}</div>}
   </section>
  </section>
 </>;
}
