import { useEffect,useState } from 'react';
import {useToastSignals} from './useToastSignals';
import type { ChangeEvent } from 'react';
import { ArrowLeft,Download,Plus,Save,Upload } from 'lucide-react';
import { downloadTransactions,EMPTY_TRANSACTION,formatTransactionDate,formatWon,
  readExpensesForManagement,saveExpense,validateTransaction,parseTransactionCsv,transactionCsvDateRange,transactionCsvExample,importExpenses } from './financeTransactions';
import type { FinanceTransaction,FinanceTransactionInput } from './financeTransactions';

type EditState={id?:string;updateTime?:string;record:FinanceTransactionInput};

export default function ExpenseManagement({onBack}:{onBack:()=>void}){
  const [records,setRecords]=useState<FinanceTransaction[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  useToastSignals({error,message});
  const [add,setAdd]=useState<EditState|null>(null);
  const [editing,setEditing]=useState<EditState|null>(null);
  const [csvRows,setCsvRows]=useState<FinanceTransactionInput[]>([]);
  const csvRange=transactionCsvDateRange(csvRows);
  useEffect(()=>{
    let active=true;
    void readExpensesForManagement().then(data=>{if(active)setRecords(data.records);})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'조회 실패');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  function change(field:keyof FinanceTransactionInput,value:string,adding=false){
    const update=(current:EditState|null)=>current?{...current,record:{...current.record,[field]:value}}:null;
    if(adding)setAdd(update);else setEditing(update);
  }
  async function save(adding=false){
    const target=adding?add:editing;
    if(!target||busy)return;
    setError('');setMessage('');
    try {
      const record=validateTransaction(target.record);
      setBusy(true);
      await saveExpense(record,target.id,target.updateTime);
      const refreshed=await readExpensesForManagement();
      setRecords(refreshed.records);
      if(adding)setAdd(null);else setEditing(null);
      setMessage('거래 내역을 저장했습니다.');
    }catch(reason){setError(reason instanceof Error?reason.message:'저장 실패');}
    finally{setBusy(false);}
  }
  function download(){
    const blob=new Blob([downloadTransactions(records)],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='myrock-expense-transactions.csv';
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function chooseCsv(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    setError('');setMessage('');setCsvRows([]);
    if(file.size>200000){setError('CSV 파일은 200KB 이하여야 합니다.');return;}
    try{setCsvRows(parseTransactionCsv(await file.text()));}
    catch(reason){setError(reason instanceof Error?reason.message:'CSV 오류');}
  }
  async function commitCsv(){
    if(busy||!csvRows.length)return;
    if(!window.confirm('CSV '+csvRows.length+'건을 기존 회비 거래 내역에 추가합니다. 중복 데이터도 추가될 수 있습니다. 진행할까요?'))return;
    setBusy(true);setError('');setMessage('');
    let added=0;
    try {
      for(let i=0;i<csvRows.length;i+=20){
        const result=await importExpenses(csvRows.slice(i,i+20));
        added+=result.added;
      }
      setCsvRows([]);
      const refreshed=await readExpensesForManagement();
      setRecords(refreshed.records);
      setMessage('CSV '+added+'건을 추가했습니다.');
    }catch(reason){
      setError('CSV 등록 중 '+added+'건 완료 후 중단되었습니다. 중복 등록하지 않도록 목록을 확인하세요. '+(reason instanceof Error?reason.message:''));
      await readExpensesForManagement().then(data=>setRecords(data.records)).catch(()=>{});
    }finally{setBusy(false);}
  }
  function downloadTemplate(){
    const url=URL.createObjectURL(new Blob([transactionCsvExample()],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='myrock-expense-transactions-template.csv';
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  return <>
    <div className="page-heading container"><span className="eyebrow">FINANCE ADMINISTRATION</span><h1>회비 집행 내역 관리</h1>
      <p>동아리 계좌의 입금과 출금을 포함한 모든 거래를 기록합니다.</p></div>
    <div className="container finance-details-content finance-manager" data-async-busy={busy ? "true" : undefined}>
      <button type="button" className="finance-return-link" onClick={onBack}><ArrowLeft size={16}/> 회비 집행 내역으로 돌아가기</button>


      <section className="finance-manager-section">
        <div className="finance-manager-heading"><div><h2>거래 기록 관리</h2><p>거래일시·거래구분·거래금액·거래 후 잔액·거래내용을 관리합니다.</p></div>
          <div className="finance-manager-actions">
            <button type="button" className="outline-action" disabled={busy||Boolean(add)||Boolean(editing)} onClick={()=>setAdd({record:{...EMPTY_TRANSACTION}})}><Plus size={15}/> 거래 추가</button>
            <button type="button" className="outline-action" disabled={busy||loading} onClick={download}><Download size={15}/> 전체 거래 CSV 다운로드</button>
          </div>
        </div>
        <div className="finance-manager-import">
          <label className="outline-action finance-manager-upload"><Upload size={15}/> CSV 파일 선택
            <input type="file" accept=".csv,text/csv" aria-label="회비 집행 내역 CSV 파일 선택" onChange={event=>void chooseCsv(event)}/>
          </label>
          <button type="button" className="outline-action finance-manager-template" onClick={downloadTemplate}><Download size={15}/> 양식 내려받기</button>
          <div className="finance-manager-csv-guidance"><span>날짜는 반드시 다음 예시와 같은 값을 사용해야 합니다. 예시) 2026-10-14 15:30</span></div>
          {csvRows.length>0&&<div className="finance-manager-import-confirm">
            <strong>추가 준비: {csvRows.length}건{csvRange&&` (${csvRange.start} ~ ${csvRange.end})`}</strong>
            <button type="button" className="button button-primary" disabled={busy} onClick={()=>void commitCsv()}>CSV {csvRows.length}건 추가</button>
            <button type="button" className="outline-action" disabled={busy} onClick={()=>setCsvRows([])}>취소</button>
          </div>}
        </div>
        <div className="finance-manager-table-wrap">
          <table className="finance-manager-table finance-transactions-admin">
            <thead><tr><th>거래일시</th><th>거래구분</th><th>거래금액</th><th>거래 후 잔액</th><th>거래내용</th><th>관리</th></tr></thead>
            <tbody>
              {add&&<tr className="finance-inline-edit"><td colSpan={6}>
                <form id="expense-add" onSubmit={e=>{e.preventDefault();void save(true);}} className="finance-inline-add-form">
                  <div className="finance-inline-fields">
                    <label>거래일시<input type="datetime-local" required value={add.record.dateTime} onChange={e=>change('dateTime',e.target.value,true)}/></label>
                    <label>거래구분<select value={add.record.type} onChange={e=>change('type',e.target.value,true)}><option value="입금">입금</option><option value="출금">출금</option></select></label>
                    <label>거래금액<input required inputMode="numeric" value={add.record.amount} onChange={e=>change('amount',e.target.value,true)}/></label>
                    <label>거래 후 잔액<input required inputMode="numeric" value={add.record.balance} onChange={e=>change('balance',e.target.value,true)}/></label>
                    <label>거래내용<input required maxLength={240} value={add.record.description} onChange={e=>change('description',e.target.value,true)}/></label>
                  </div>
                  <div className="finance-manager-actions"><button type="submit" className="button button-primary" disabled={busy}><Save size={14}/> 저장</button><button type="button" className="outline-action" disabled={busy} onClick={()=>setAdd(null)}>취소</button></div>
                </form>
              </td></tr>}
              {loading?<tr><td colSpan={6}>거래 내역을 불러오는 중입니다.</td></tr>:
                records.length===0&&!add?<tr><td colSpan={6}>등록된 거래 내역이 없습니다.</td></tr>:
                records.map(record=>editing?.id===record.id?
                  <tr key={record.id} className="finance-inline-edit">
                    <td><input aria-label="거래일시 수정" type="datetime-local" required value={editing.record.dateTime} disabled={busy} onChange={e=>change('dateTime',e.target.value)}/></td>
                    <td><select aria-label="거래구분 수정" value={editing.record.type} disabled={busy} onChange={e=>change('type',e.target.value)}><option value="입금">입금</option><option value="출금">출금</option></select></td>
                    <td><input aria-label="거래금액 수정" required inputMode="numeric" value={editing.record.amount} disabled={busy} onChange={e=>change('amount',e.target.value)}/></td>
                    <td><input aria-label="거래 후 잔액 수정" required inputMode="numeric" value={editing.record.balance} disabled={busy} onChange={e=>change('balance',e.target.value)}/></td>
                    <td><input aria-label="거래내용 수정" required maxLength={240} value={editing.record.description} disabled={busy} onChange={e=>change('description',e.target.value)}/></td>
                    <td className="finance-row-actions"><button type="button" className="outline-action" disabled={busy} onClick={()=>void save(false)}><Save size={13}/> 저장</button>
                      <button type="button" className="outline-action" disabled={busy} onClick={()=>setEditing(null)}>취소</button></td>
                  </tr>:
                  <tr key={record.id}><td>{formatTransactionDate(record.dateTime)}</td><td>{record.type}</td><td>{formatWon(record.amount)}</td>
                    <td>{formatWon(record.balance)}</td><td>{record.description}</td>
                    <td><button type="button" className="outline-action" disabled={busy||Boolean(add)||Boolean(editing)} onClick={()=>setEditing({id:record.id,updateTime:record.updateTime,record:{
                      dateTime:record.dateTime,type:record.type,amount:record.amount,balance:record.balance,description:record.description}})}>수정</button></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </>;
}
