import {useToastFeedback} from './toast';
import { useEffect, useState } from 'react';
import LoadingText from './LoadingText';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Download, Plus, Save, Upload } from 'lucide-react';
import { getDonationManagement, importDonations, saveDonation, saveAnonymousPeople } from './donationApi';
import type { ManageData } from './donationApi';
import { displayAmount, displayDate, donationDateRange, EMPTY_DONATION, parseDonationCsv, serializeDonationCsv, validateDonation } from './donationData';
import type { AnonymousPerson, DonationInput, DonationRecord } from './donationData';
import { activeAnonymousPeople,hasAnonymousRosterChanges } from './anonymousRosterDraft';

type Editing = { id?: string; updateTime?: string; row: DonationInput };
const blankPerson: AnonymousPerson = {donorName:'',studentId:''};

export default function DonationManagement({onBack}:{onBack:()=>void}) {
  const [data,setData]=useState<ManageData|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [editing,setEditing]=useState<Editing|null>(null);
  const [csvRows,setCsvRows]=useState<DonationInput[]>([]);
  const [people,setPeople]=useState<AnonymousPerson[]>([]);
  const [pendingExclusions,setPendingExclusions]=useState<number[]>([]);
  const peopleChanged=Boolean(data && hasAnonymousRosterChanges(people,data.people,pendingExclusions));
  const [peopleError,setPeopleError]=useState('');
  const [peopleMessage,setPeopleMessage]=useState('');
  useToastFeedback(error,'error');
  useToastFeedback(message,'success');
  useToastFeedback(peopleError,'error');
  useToastFeedback(peopleMessage,'success');
  function markPeopleChanged() {
    setPeopleError('');
    setPeopleMessage('');
  }
  const csvRange=donationDateRange(csvRows);
  function isSavedPerson(index:number) {
    return Boolean(data && index < data.people.length);
  }
  async function refresh() {
    const result=await getDonationManagement();
    setData(result);setPeople(result.people);setPendingExclusions([]);
  }
  useEffect(()=>{
    let active=true;
    void getDonationManagement().then(result=>{
      if(active){setData(result);setPeople(result.people);}
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'조회 오류');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  function updateRow(field:keyof DonationInput,value:string) {
    setEditing(previous=>previous?{...previous,row:{...previous.row,[field]:value}}:null);
  }
  async function persist() {
    if(!editing||busy)return;
    setError('');setMessage('');
    try {
      const valid=validateDonation(editing.row);
      setBusy(true);
      await saveDonation(valid,editing.id,editing.updateTime);
      await refresh();setEditing(null);setMessage('후원 내역이 저장되었습니다.');
    } catch(reason){setError(reason instanceof Error?reason.message:'저장 오류');}
    finally{setBusy(false);}
  }
  async function chooseCsv(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    setError('');setMessage('');setCsvRows([]);
    if(file.size>200000){setError('CSV 파일은 200KB 이하여야 합니다.');return;}
    try{setCsvRows(parseDonationCsv(await file.text()));}
    catch(reason){setError(reason instanceof Error?reason.message:'CSV 오류');}
  }
  async function commitCsv() {
    if(busy||!csvRows.length)return;
    if(!window.confirm('CSV '+csvRows.length+'건을 기존 후원 내역에 추가합니다. 중복 데이터도 추가될 수 있습니다. 진행할까요?'))return;
    setBusy(true);setError('');setMessage('');
    let added=0;
    try{
      for(let i=0;i<csvRows.length;i+=40){
        const result=await importDonations(csvRows.slice(i,i+40));
        added+=result.added;
      }
      setCsvRows([]);await refresh();setMessage('CSV '+added+'건을 추가했습니다.');
    }catch(reason){setError('CSV 등록 중 '+added+'건 완료 후 중단되었습니다. 중복 등록하지 않도록 목록을 확인하세요. '+(reason instanceof Error?reason.message:''));await refresh().catch(()=>{});}
    finally{setBusy(false);}
  }
  function downloadTemplate() {
    const example=serializeDonationCsv([
      {date:'2026-10-14',donorName:'홍길동',studentId:'2026300001',amount:'10000',anonymous:''},
      {date:'2026-10-15',donorName:'나재원',studentId:'2026300002',amount:'100000',anonymous:'o'}
    ]);
    downloadTextCsv('myrock-donations-template.csv',example);
  }
  function downloadTextCsv(filename:string,contents:string) {
    const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadCsv() {
    if(!data)return;
    const contents=serializeDonationCsv(data.records);
    const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='myrock-donations.csv';document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function persistPeople() {
    if(busy||!data)return;
    setPeopleError('');setPeopleMessage('');
    setBusy(true);
    try{
      const cleaned=activeAnonymousPeople(people,pendingExclusions);
      if(cleaned.some(person=>!person.donorName.trim()||!/^\d{10}$/.test(person.studentId.trim()))) {
        throw new Error('익명자 명단은 이름과 숫자 10자리 학번을 모두 입력해야 저장할 수 있습니다.');
      }
      await saveAnonymousPeople(cleaned,data.registryUpdateTime);
      await refresh();setPeopleMessage('익명자 명단이 저장되었습니다.');
    }catch(reason){setPeopleError(reason instanceof Error?reason.message:'익명자 명단 저장 오류');}
    finally{setBusy(false);}
  }
  return <>
    <div className="page-heading container"><span className="eyebrow">DONATION ADMINISTRATION</span>
      <h1>후원 내역 관리</h1><p>후원 기록과 익명자 명단을 관리합니다. 실무단 이상만 접근할 수 있습니다.</p>
    </div>
    <div className="container finance-details-content finance-manager" data-async-busy={busy ? "true" : undefined}>
      <button type="button" className="finance-return-link" onClick={onBack}><ArrowLeft size={16}/> 후원 내역으로 돌아가기</button>

      {loading?<div className="finance-manager-loading-panels">
        <section className="finance-manager-section">
         <div className="finance-manager-heading"><div><h2>후원 기록</h2><p>내부 기록에는 익명 처리된 후원자의 원본 이름과 학번도 보관됩니다.</p></div></div>
         <div className="finance-manager-table-wrap"><table className="finance-manager-table finance-donations-admin">
          <thead><tr><th>후원일</th><th>후원자명</th><th>학번</th><th>후원금액</th><th>익명</th><th>관리</th></tr></thead>
          <tbody><tr><td colSpan={6}><LoadingText className="is-inline">후원 기록을 불러오고 있습니다.</LoadingText></td></tr></tbody>
         </table></div>
        </section>
        <section className="finance-manager-section"><div className="finance-manager-heading"><div><h2>익명자 명단 관리</h2><p>이름과 학번을 등록해 익명 처리할 수 있습니다.</p></div></div>
         <div className="finance-manager-anonymous-list"><LoadingText className="is-compact">익명자 명단을 불러오는 중입니다</LoadingText></div>
        </section>
       </div>:!data?<p>후원 기록을 불러오지 못했습니다. 새로고침해 주세요.</p>:<>
        <section className="finance-manager-section">
          <div className="finance-manager-heading"><div><h2>후원 기록</h2><p>내부 기록에는 익명 처리된 후원자의 원본 이름과 학번도 보관됩니다.</p></div>
            <div className="finance-manager-actions">
              <button className="outline-action" type="button" onClick={()=>setEditing({row:{...EMPTY_DONATION}})} disabled={busy||Boolean(editing)}><Plus size={15}/> 개별 추가</button>
              <button className="outline-action" type="button" onClick={downloadCsv}><Download size={15}/> 전체 내역 CSV 다운로드</button>
            </div>
          </div>
          <div className="finance-manager-import">
            <label className="outline-action finance-manager-upload"><Upload size={15}/> CSV 파일 선택
              <input type="file" accept=".csv,text/csv" onChange={event=>void chooseCsv(event)} aria-label="후원 내역 CSV 파일 선택"/>
            </label>
            <button type="button" className="outline-action finance-manager-template" onClick={downloadTemplate}><Download size={15}/> 양식 내려받기</button>
            <div className="finance-manager-csv-guidance"><span>날짜는 반드시 다음 예시와 같은 형식을 사용해야 합니다. 예시) 2026-10-14</span><span>익명으로 표시하려면 '익명 여부' 칸에 소문자 'o'를 입력해 주세요. 다른 값이나 빈칸은 익명으로 처리되지 않습니다.</span></div>
            {csvRows.length>0&&<div className="finance-manager-import-confirm">
              <strong>추가 준비: {csvRows.length}건{csvRange&&` (${csvRange.start} ~ ${csvRange.end})`}</strong><button type="button" className="button button-primary" disabled={busy} onClick={()=>void commitCsv()}>CSV {csvRows.length}건 추가</button>
              <button type="button" className="outline-action" disabled={busy} onClick={()=>setCsvRows([])}>취소</button>
            </div>}
          </div>
          {editing&&!editing.id&&<form className="finance-manager-edit" onSubmit={event=>{event.preventDefault();void persist();}}>
            <h3>후원 기록 추가</h3>
            <div className="finance-manager-edit-grid">
              <label>후원일<input type="date" value={editing.row.date} required onChange={event=>updateRow('date',event.target.value)}/></label>
              <label>후원자명 (빈칸 가능)<input value={editing.row.donorName} maxLength={80} onChange={event=>updateRow('donorName',event.target.value)}/></label>
              <label>학번 (빈칸 가능)<input value={editing.row.studentId} maxLength={10} inputMode="numeric" onChange={event=>updateRow('studentId',event.target.value)}/></label>
              <label>후원금액 (원)<input value={editing.row.amount} required inputMode="numeric" onChange={event=>updateRow('amount',event.target.value)}/></label>
              <label>익명여부<select value={editing.row.anonymous} onChange={event=>updateRow('anonymous',event.target.value)}>
                <option value="x">x · 공개</option><option value="o">o · 익명</option>
              </select></label>
            </div>
            <div className="finance-manager-actions">
              <button className="button button-primary" type="submit" disabled={busy}><Save size={15}/> 저장</button>
              <button className="outline-action" type="button" disabled={busy} onClick={()=>setEditing(null)}>취소</button>
            </div>
          </form>}
          <div className="finance-manager-table-wrap">
            <table className="finance-manager-table finance-donations-admin"><thead><tr><th>후원일</th><th>후원자명</th><th>학번</th><th>후원금액</th><th>익명</th><th>관리</th></tr></thead>
              <tbody>{data.records.length?data.records.map((record:DonationRecord)=>
                editing?.id===record.id?
                  <tr key={record.id} className="finance-inline-edit">
                    <td><input type="date" aria-label="후원일 수정" required value={editing.row.date} disabled={busy} onChange={e=>updateRow('date',e.target.value)}/></td>
                    <td><input aria-label="후원자명 수정" maxLength={80} value={editing.row.donorName} disabled={busy} onChange={e=>updateRow('donorName',e.target.value)}/></td>
                    <td><input aria-label="학번 수정" maxLength={10} inputMode="numeric" value={editing.row.studentId} disabled={busy} onChange={e=>updateRow('studentId',e.target.value)}/></td>
                    <td><input aria-label="후원금액 수정" required inputMode="numeric" value={editing.row.amount} disabled={busy} onChange={e=>updateRow('amount',e.target.value)}/></td>
                    <td><select aria-label="익명여부 수정" value={editing.row.anonymous} disabled={busy} onChange={e=>updateRow('anonymous',e.target.value)}>
                      <option value="x">x</option><option value="o">o</option>
                    </select></td>
                    <td className="finance-row-actions"><div className="finance-inline-row-actions">
                      <button type="button" className="outline-action" disabled={busy} onClick={()=>void persist()}><Save size={13}/> 저장</button>
                      <button type="button" className="outline-action" disabled={busy} onClick={()=>setEditing(null)}>취소</button>
                    </div></td>
                  </tr>:
                  <tr key={record.id}>
                    <td>{displayDate(record.date)}</td><td>{record.donorName||'미확인'}</td><td>{record.studentId||'미확인'}</td>
                    <td>{displayAmount(record.amount)}</td><td>{record.anonymous}</td>
                    <td><button type="button" className="outline-action" disabled={busy||Boolean(editing)} onClick={()=>setEditing({id:record.id,updateTime:record.updateTime,row:{
                      date:record.date,donorName:record.donorName,studentId:record.studentId,amount:record.amount,anonymous:record.anonymous}})}>수정</button></td>
                  </tr>):<tr><td colSpan={6}>아직 등록된 후원 기록이 없습니다.</td></tr>}</tbody>
            </table>
          </div>
        </section>
        <section className="finance-manager-section">
          <div className="finance-manager-heading"><div><h2>익명자 명단 관리</h2><p>이름과 숫자 10자리 학번을 모두 등록해야 해당 학번의 모든 후원이 익명으로 표시됩니다. 저장된 인원은 확인만 가능하며, 제외한 후에는 명단을 다시 저장해 주세요.</p></div>
            <button type="button" className="outline-action" disabled={busy} onClick={()=>{setPeople(previous=>[...previous,{...blankPerson}]);markPeopleChanged();}}><Plus size={15}/> 익명자 추가</button>
          </div>
          <div className="finance-manager-anonymous-list">
            {people.length===0&&<p>익명자 명단이 비어 있습니다.</p>}
            {people.map((person,index)=><div key={index} className={pendingExclusions.includes(index)?'finance-manager-anonymous-row is-pending-removal':'finance-manager-anonymous-row'}>
              {isSavedPerson(index)?<>
                <span className="finance-manager-anonymous-value"><small>이름</small><strong>{person.donorName}</strong></span>
                <span className="finance-manager-anonymous-value"><small>학번</small><strong>{person.studentId}</strong></span>
              </>:<>
                <label>이름<input required disabled={busy||pendingExclusions.includes(index)} value={person.donorName} maxLength={80} placeholder="이름" onChange={event=>{setPeople(previous=>previous.map((p,i)=>i===index?{...p,donorName:event.target.value}:p));markPeopleChanged();}}/></label>
                <label>학번<input required disabled={busy||pendingExclusions.includes(index)} pattern="[0-9]{10}" value={person.studentId} maxLength={10} inputMode="numeric" placeholder="숫자 10자리 학번" onChange={event=>{setPeople(previous=>previous.map((p,i)=>i===index?{...p,studentId:event.target.value}:p));markPeopleChanged();}}/></label>
              </>}
              <button type="button" className="outline-action" disabled={busy} onClick={()=>{
                if(!isSavedPerson(index)){
                  setPeople(previous=>previous.filter((_,i)=>i!==index));
                  setPendingExclusions(previous=>previous.filter(i=>i!==index).map(i=>i>index?i-1:i));
                }else{
                  setPendingExclusions(previous=>previous.includes(index)?previous.filter(i=>i!==index):[...previous,index]);
                }
                markPeopleChanged();
              }}>{!isSavedPerson(index)?'삭제':pendingExclusions.includes(index)?'제외 취소':'제외'}</button>
            </div>)}
          </div>
          <div className="finance-manager-people-save">
            <button type="button" className="button button-primary" disabled={busy||!peopleChanged} aria-disabled={busy||!peopleChanged} onClick={()=>void persistPeople()}>익명자 명단 저장</button>

          </div>
        </section>
      </>}
    </div>

  </>;
}
