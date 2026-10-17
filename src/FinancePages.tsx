import { useEffect, useState } from 'react';
import TimedBottomToast from './TimedBottomToast';
import type { FormEvent } from 'react';
import { getOwnDonations, getPublicDonations } from './donationApi';
import { displayAmount, displayDate, sumDonationAmounts } from './donationData';
import type { OwnDonation, PublicDonation } from './donationData';
import { formatTransactionDate,formatWon,readDonationAccount,readAccountForManagement,saveDonationAccount,readExpenses } from './financeTransactions';
import type { DonationAccount, FinanceTransactionInput } from './financeTransactions';
import { ArrowLeft, ArrowRight, ArrowUpRight, ClipboardList, HeartHandshake, LockKeyhole, Wallet } from 'lucide-react';

type Nav = () => void;

function FinanceHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading container">
    <span className="eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
  </div>;
}

function FinanceSectionTitle({ title, description }: { title: string; description?: string }) {
  return <div className="section-heading">
    <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
  </div>;
}

export function FinanceLanding({ onDonations, onExpenses, canEditAccount, loggedIn, authPending, onLogin }: { onDonations: Nav; onExpenses: Nav; canEditAccount:boolean; loggedIn:boolean; authPending:boolean; onLogin:Nav }) {
  const [account,setAccount]=useState<DonationAccount|null>(null);
  const [editing,setEditing]=useState<DonationAccount|null>(null);
  const [version,setVersion]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [accountMessage,setAccountMessage]=useState('');
  const accountChanged=Boolean(editing&&account&&(editing.bank.trim()!==account.bank||editing.number.trim()!==account.number||editing.holder.trim()!==account.holder));
  useEffect(()=>{
    let active=true;
    setAccount(null);
    setEditing(null);
    setVersion(null);
    setError('');
    if(!loggedIn||authPending)return()=>{active=false;};
    void readDonationAccount().then(data=>{if(active)setAccount(data.account);})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'계좌 조회에 실패했습니다.');});
    return()=>{active=false;};
  },[loggedIn,authPending]);
  async function beginEdit(){
    if(busy)return;
    setBusy(true);setError('');setAccountMessage('');
    try{
      const data=await readAccountForManagement();
      setAccount({bank:data.account.bank,number:data.account.number,holder:data.account.holder});
      setVersion(data.account.updateTime);
      setEditing({bank:data.account.bank,number:data.account.number,holder:data.account.holder});
    }catch(reason){setError(reason instanceof Error?reason.message:'수정 권한을 확인할 수 없습니다.');}
    finally{setBusy(false);}
  }
  async function persistAccount(event:FormEvent){
    event.preventDefault();
    if(!editing||busy||!accountChanged)return;
    setBusy(true);setError('');setAccountMessage('');
    try{
      const saved=await saveDonationAccount(editing,version);
      setVersion(saved.account.updateTime);
      setAccount({bank:saved.account.bank,number:saved.account.number,holder:saved.account.holder});
      setEditing(null);
      setAccountMessage('저장을 완료했습니다.');
    }catch(reason){setError(reason instanceof Error?reason.message:'계좌 정보 저장에 실패했습니다.');}
    finally{setBusy(false);}
  }
  return <>
    <FinanceHeading eyebrow="SUPPORT & FINANCE" title="후원 · 회계"
      description="모여락의 다음 무대를 함께 만들어 주시는 모든 분께 감사드립니다." />

    {accountMessage&&<TimedBottomToast tone="warning" message={accountMessage} onClose={()=>setAccountMessage('')}/>}

    <section className="container section-block finance-support-intro">
      <span className="eyebrow">SUPPORT MYROCK</span>
      <h2>여러분의 응원이 모여<br />더 나은 모여락을 만듭니다.</h2>
      <p>모여락은 음악을 좋아하는 사람들이 함께 배우고, 합주하고, 무대에 오르는 성균관대학교 중앙 밴드동아리입니다. 서로 다른 악기와 목소리가 모여 하나의 음악을 완성하듯, 동아리를 응원해 주시는 한 분 한 분의 마음이 모여 모여락의 활동을 더욱 풍성하게 만들어 줍니다.</p>
      <p>여러분의 후원은 악기와 장비를 더 좋은 상태로 유지하고, 신입부원이 새로운 음악에 도전하며, 더 많은 공연과 활동을 이어갈 수 있는 소중한 힘이 됩니다. 크고 작은 관심과 응원 모두 모여락의 성장에 큰 도움이 됩니다.</p>
      <p>보내주신 마음이 의미 있게 쓰일 수 있도록 후원 내역과 회비 집행 내역을 투명하게 공유하는 공간도 마련하고자 합니다. 모여락이 앞으로도 즐겁게 음악을 만들 수 있도록 따뜻한 관심 부탁드립니다.</p>
    </section>

    <section className="container section-block finance-donation-account" data-async-busy={busy ? "true" : undefined}>
      <div className="finance-account-heading"><FinanceSectionTitle title="후원 계좌 안내" description="후원을 원하시는 분을 위한 계좌 안내입니다." />
        {loggedIn&&!authPending&&canEditAccount&&!editing&&account&&<button type="button" className="admin-only-action" disabled={busy} onClick={()=>void beginEdit()}>정보 수정</button>}
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="finance-bank-card">
        <div className="finance-bank-card-header">
          <span className="finance-bank-eyebrow">DONATION ACCOUNT</span>
        </div>
        {authPending||!loggedIn?<div className="finance-account-locked" role="status">
          <LockKeyhole size={21} aria-hidden="true"/>
          <div>
            <strong>{authPending?'로그인 상태를 확인하고 있습니다.':'후원 계좌 정보는 비공개입니다.'}</strong>
            <p>후원 계좌는 로그인 후 확인할 수 있습니다.</p>
          </div>
          {!authPending&&<button type="button" className="button button-primary" onClick={onLogin}>로그인 <ArrowRight size={15}/></button>}
        </div>:editing?<form className="finance-account-form" onSubmit={event=>void persistAccount(event)}>
          <div className="finance-bank-fields">
            <label><span>은행</span><input required maxLength={35} value={editing.bank} onChange={e=>setEditing(p=>p?{...p,bank:e.target.value}:null)}/></label>
            <label><span>계좌번호</span><input required pattern="[0-9-]{7,35}" value={editing.number} onChange={e=>setEditing(p=>p?{...p,number:e.target.value}:null)}/></label>
            <label><span>예금주</span><input required maxLength={70} value={editing.holder} onChange={e=>setEditing(p=>p?{...p,holder:e.target.value}:null)}/></label>
          </div>
          <div className="finance-manager-actions finance-account-edit-actions">
            <button type="submit" className="button button-primary" disabled={busy||!accountChanged} aria-disabled={busy||!accountChanged}>저장</button>
            <button type="button" className="outline-action" disabled={busy} onClick={()=>setEditing(null)}>취소</button>
          </div>
        </form>:account?<div className="finance-bank-fields">
          <div><span>은행</span><strong>{account.bank}</strong></div>
          <div><span>계좌번호</span><strong>{account.number}</strong></div>
          <div><span>예금주</span><strong>{account.holder}</strong></div>
        </div>:<p className="finance-account-loading" role="status">{error?'후원 계좌 정보를 불러오지 못했습니다.':'후원 계좌 정보를 불러오는 중입니다.'}</p>}
      </div>
      <p className="finance-support-eligibility">회칙에 따라 <strong>회원인 동아리 부원 및 OB만 후원할 수 있습니다.</strong></p>
      <div className="finance-privacy-note">
        <LockKeyhole size={19} aria-hidden="true" />
        <div>
          <strong>이름을 공개하지 않고 후원할 수 있습니다.</strong>
          <p>특정 후원 기록을 익명으로 표시하고 싶다면 운영진에게 해당 기록의 <b>익명여부</b>를 설정해 달라고 요청해 주세요. 익명 처리된 후원은 <b>전체 후원 내역</b>에서 이름 대신 <b>익명</b>으로 표시됩니다. 본인의 <b>모든 내역</b>을 익명으로 표시하려면 운영진에게 학번을 기준으로 <b>익명자 명단</b>에 등록해 달라고 요청해 주세요.</p>
          <p>익명 처리 여부와 관계없이, 본인이 후원한 내역은 로그인 후 <b>내 후원 내역</b>에서 확인할 수 있습니다.</p>
        </div>
      </div>
    </section>

    <section className="container section-block finance-entry-section">
      <FinanceSectionTitle title="후원 및 회계 내역" description="후원 현황과 동아리의 회비 사용 내역을 확인하는 공간입니다." />
      <div className="finance-entry-grid">
        <button type="button" className="finance-entry-card" onClick={onDonations}>
          <HeartHandshake size={26} strokeWidth={1.6} aria-hidden="true" />
          <span className="finance-entry-content">
            <strong>후원 내역 확인</strong>
            <small>전체 후원 내역 및 로그인 후 내 후원 내역</small>
          </span>
          <ArrowUpRight size={19} aria-hidden="true" />
        </button>
        <button type="button" className="finance-entry-card" onClick={onExpenses}>
          <ClipboardList size={26} strokeWidth={1.6} aria-hidden="true" />
          <span className="finance-entry-content">
            <strong>회비 집행 내역 확인</strong>
            <small>동아리 회비가 사용된 항목과 집행 기록</small>
          </span>
          <ArrowUpRight size={19} aria-hidden="true" />
        </button>
      </div>
    </section>
  </>;
}

function BackToFinance({ onBack }: { onBack: Nav }) {
  return <button type="button" className="finance-return-link" onClick={onBack}>
    <ArrowLeft size={16} aria-hidden="true" /> 후원 · 회계로 돌아가기
  </button>;
}

function FinanceEmpty({ title, description }: { title: string; description: string }) {
  return <div className="finance-record-empty" role="status">
    <Wallet size={24} strokeWidth={1.5} aria-hidden="true" />
    <strong>{title}</strong>
    <p>{description}</p>
  </div>;
}

export function DonationHistory({
  onBack, loggedIn, authPending, onLogin, canManageDonations, onManage,
}: {
  onBack: Nav; loggedIn: boolean; authPending: boolean; onLogin: Nav;
  canManageDonations: boolean; onManage: Nav;
}) {
  const [all,setAll]=useState<PublicDonation[]>([]);
  const [mine,setMine]=useState<OwnDonation[]>([]);
  const [allError,setAllError]=useState('');
  const [mineError,setMineError]=useState('');
  const [loadingAll,setLoadingAll]=useState(true);
  const [allCursor,setAllCursor]=useState<string|null>(null);
  const [loadingMoreAll,setLoadingMoreAll]=useState(false);
  const [loadingMine,setLoadingMine]=useState(false);
  const [mineLoaded,setMineLoaded]=useState(false);
  useEffect(()=>{
    let active=true;
    void getPublicDonations().then(data=>{if(active){setAll(data.records);setAllCursor(data.nextPageToken);}})
      .catch(reason=>{if(active)setAllError(reason instanceof Error?reason.message:'후원 기록 조회 오류');})
      .finally(()=>{if(active)setLoadingAll(false);});
    return()=>{active=false;};
  },[]);
  async function loadMoreDonations(){
    if(!allCursor||loadingMoreAll)return;
    setLoadingMoreAll(true);
    try{const result=await getPublicDonations(allCursor);setAll(prev=>[...prev,...result.records.filter(record=>!prev.some(item=>item.id===record.id))]);setAllCursor(result.nextPageToken);setAllError('');}
    catch(e){setAllError(e instanceof Error?e.message:'후원 기록 추가 조회 실패');}
    finally{setLoadingMoreAll(false);}
  }
  useEffect(()=>{
    let active=true;
    if(authPending||!loggedIn){setMine([]);setMineLoaded(false);return()=>{active=false;};}
    setLoadingMine(true);setMineLoaded(false);setMine([]);setMineError('');
    void getOwnDonations().then(data=>{if(active){setMine(data.records);setMineLoaded(true);}})
      .catch(reason=>{if(active)setMineError(reason instanceof Error?reason.message:'내 후원 기록 조회 오류');})
      .finally(()=>{if(active)setLoadingMine(false);});
    return()=>{active=false;};
  },[authPending,loggedIn]);
  return <>
    <FinanceHeading eyebrow="DONATION HISTORY" title="후원 내역"
      description="모여락에 보내주신 소중한 응원을 확인하는 공간입니다." />
    <div className="container finance-details-content">
      <BackToFinance onBack={onBack} />
      {canManageDonations&&<div className="finance-manager-entry"><button type="button" className="admin-only-action" onClick={onManage}>후원 내역 관리 <ArrowRight size={15}/></button></div>}
      <section className="finance-record-section" aria-labelledby="all-donations-heading">
        <FinanceSectionTitle title="전체 후원 내역" description="누구나 확인할 수 있는 동아리 후원 기록입니다." />
        <p className="finance-record-description" id="all-donations-heading">
          개별 익명 요청이나 익명자 명단에 포함된 기록, 후원자 정보가 확인되지 않은 기록은 <b>익명</b>으로 표시됩니다.
        </p>
        <div className="finance-record-table">
          <div className="finance-record-table-header finance-donations-columns">
            <span>후원일</span><span>후원자</span><span>후원 금액</span>
          </div>
          {loadingAll?<FinanceEmpty title="후원 기록 조회 중" description="후원 내역을 불러오고 있습니다."/>:
            allError?<FinanceEmpty title="후원 기록 조회 실패" description={allError}/>:
            all.length===0?<FinanceEmpty title="등록된 후원 내역이 없습니다" description="운영진이 후원 내역을 등록하면 이곳에 표시됩니다."/>:
            all.map(row=><div key={row.id} className="finance-record-row finance-donations-columns">
              <span>{displayDate(row.date)}</span><span>{row.donorName}</span><span>{displayAmount(row.amount)}</span>
            </div>)}
        </div>
        {allCursor&&<div className="list-bottom"><button type="button" className={loadingMoreAll?"outline-action is-fetching":"outline-action"} disabled={loadingMoreAll} onClick={()=>void loadMoreDonations()}>{loadingMoreAll?'더 불러오는 중...':'후원 내역 더 보기'}</button></div>}
      </section>
      <section className="finance-record-section" aria-labelledby="my-donations-heading">
        <FinanceSectionTitle title="내 후원 내역" description="로그인한 부원의 학번에 연결된 기록만 표시합니다." />
        {authPending?<FinanceEmpty title="로그인 상태 확인 중" description="본인 확인 후 내역을 불러옵니다."/>:
          loggedIn?<div className="finance-record-table">
            {mineLoaded&&!mineError&&<div className="finance-personal-total">
              <span>지금까지의 내 총 후원 금액</span>
              <strong>{displayAmount(sumDonationAmounts(mine))}</strong>
            </div>}
            <div className="finance-record-table-header finance-personal-columns"><span>후원일</span><span>후원 금액</span></div>
            {loadingMine?<FinanceEmpty title="내 후원 기록 조회 중" description="본인 학번으로 조회하고 있습니다."/>:
              mineError?<FinanceEmpty title="내 후원 기록 조회 실패" description={mineError}/>:
              mine.length===0?<FinanceEmpty title="내 후원 내역이 없습니다" description="현재 학번에 연결된 후원 기록이 없습니다."/>:
              mine.map(row=><div key={row.id} className="finance-record-row finance-personal-columns">
                <span>{displayDate(row.date)}</span><span>{displayAmount(row.amount)}</span>
              </div>)}
          </div>:
          <div className="finance-login-gate"><LockKeyhole size={24} aria-hidden="true"/>
            <div><strong>내 후원 내역은 로그인 후 확인할 수 있습니다.</strong><p>개인별 후원 내역은 로그인한 본인의 학번으로 확인합니다.</p></div>
            <button type="button" className="button button-primary" onClick={onLogin}>로그인 <ArrowRight size={15}/></button>
          </div>}
      </section>
      <div className="finance-detail-footer"><BackToFinance onBack={onBack}/></div>
    </div>
  </>;
}

export function ExpenseHistory({ onBack, canManageExpenses, onManage }: {
  onBack:Nav;canManageExpenses:boolean;onManage:Nav;
}) {
  const [rows,setRows]=useState<Array<FinanceTransactionInput & {id:string}>>([]);
  const [expenseCursor,setExpenseCursor]=useState<string|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    void readExpenses().then(data=>{if(active){setRows(data.records);setExpenseCursor(data.nextPageToken);}})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'거래 내역 조회 실패');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  async function loadMoreExpenses(){
    if(!expenseCursor||loadingMore)return;
    setLoadingMore(true);
    try{const result=await readExpenses(expenseCursor);setRows(prev=>[...prev,...result.records.filter(record=>!prev.some(item=>item.id===record.id))]);setExpenseCursor(result.nextPageToken);setError('');}
    catch(e){setError(e instanceof Error?e.message:'거래 내역 추가 조회 실패');}
    finally{setLoadingMore(false);}
  }
  return <>
    <FinanceHeading eyebrow="CLUB EXPENSES" title="회비 집행 내역"
      description="동아리 계좌의 입금·출금 거래 내역을 투명하게 공개합니다." />
    <div className="container finance-details-content">
      <BackToFinance onBack={onBack}/>
      {canManageExpenses&&<div className="finance-manager-entry"><button type="button" className="admin-only-action" onClick={onManage}>회비 집행 내역 관리 <ArrowRight size={15}/></button></div>}
      <section className="finance-record-section">
        <FinanceSectionTitle title="회비 집행 기록" description="입금과 출금을 포함한 전체 거래 내역입니다."/>
        <div className="finance-record-table finance-transaction-scroll">
          <div className="finance-record-table-header finance-expense-columns">
            <span>거래일시</span><span>거래구분</span><span>거래금액</span><span>거래 후 잔액</span><span>거래내용</span>
          </div>
          {loading?<FinanceEmpty title="거래 내역 조회 중" description="거래 기록을 불러오고 있습니다."/>:
            error?<FinanceEmpty title="거래 내역 조회 실패" description={error}/>:
            rows.length===0?<FinanceEmpty title="등록된 회비 집행 내역이 없습니다" description="운영진이 거래 내역을 등록하면 이곳에 표시됩니다."/>:
            rows.map(row=><div key={row.id} className="finance-record-row finance-expense-columns">
              <span>{formatTransactionDate(row.dateTime)}</span><span>{row.type}</span>
              <span>{formatWon(row.amount)}</span><span>{formatWon(row.balance)}</span><span>{row.description}</span>
            </div>)}
        </div>
        {expenseCursor&&<div className="list-bottom"><button type="button" className={loadingMore?"outline-action is-fetching":"outline-action"} disabled={loadingMore} onClick={()=>void loadMoreExpenses()}>{loadingMore?'더 불러오는 중...':'회비 내역 더 보기'}</button></div>}
      </section>
      <div className="finance-detail-footer"><BackToFinance onBack={onBack}/></div>
    </div>
  </>;
}
