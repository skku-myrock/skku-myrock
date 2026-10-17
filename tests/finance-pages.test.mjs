import {readStyles} from './readStyles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const finance = await readFile(new URL('../src/FinancePages.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/app/siteNavigation.ts', import.meta.url), 'utf8');
const styles = await readStyles();

test('finance landing introduces donations before account instructions and transaction links', () => {
  const start = finance.indexOf('export function FinanceLanding');
  const end = finance.indexOf('function BackToFinance', start);
  const landing = finance.slice(start, end);
  const indexes = [
    '여러분의 응원이 모여',
    '후원 계좌 안내',
    '후원 및 회계 내역',
    '후원 내역 확인',
    '회비 집행 내역 확인',
  ].map(phrase => landing.indexOf(phrase));
  assert.ok(indexes.every(index => index >= 0));
  assert.ok(indexes.every((index, pos) => pos === 0 || indexes[pos - 1] < index));
  assert.match(landing, /onClick=\{onDonations\}/);
  assert.match(landing, /onClick=\{onExpenses\}/);
});
test('bank account defaults to the requested Nonghyup account and president-only account form',async()=>{
  const financeTypes=await readFile(new URL('../src/financeTransactions.ts',import.meta.url),'utf8');
  const accountServer=await readFile(new URL('../functions/_lib/financeTransactions.js',import.meta.url),'utf8');
  assert.match(accountServer,/bank: '농협', number: '302-0000-0000-31', holder: '나재원'/);
  assert.doesNotMatch(financeTypes,/302-0000-0000-31|DEFAULT_ACCOUNT/);
  assert.match(finance,/loggedIn&&!authPending&&canEditAccount&&!editing&&account&&<button/);
  assert.match(finance,/readAccountForManagement\(\)/);
  assert.match(finance,/saveDonationAccount\(editing,version\)/);
  assert.match(app,/canEditAccount=\{Boolean\(user&&!authPending&&currentLevel==='president'\)\}/);
  assert.match(finance,/<strong>\{account.bank\}<\/strong>/);
  assert.match(finance,/<strong>\{account.number\}<\/strong>/);
  assert.match(finance,/<strong>\{account.holder\}<\/strong>/);
  assert.match(styles,/\.finance-privacy-note\s*\{[^}]*margin-top:\s*24px;/s);
});
test('bank fields have no bottom padding at desktop and mobile widths', () => {
  assert.match(styles, /\.finance-bank-fields\s*\{[^}]*padding:\s*28px 0 0;/s);
  assert.match(styles, /@media \(max-width:\s*680px\)[\s\S]*?\.finance-bank-fields\s*\{[^}]*padding:\s*20px 0 0;/);
});

test('donations load sanitized public and student-specific histories and restrict staff manager button', () => {
  assert.match(finance, /getPublicDonations\(\)/);
  assert.match(finance, /getOwnDonations\(\)/);
  assert.match(finance, /canManageDonations&&<div className="finance-manager-entry">/);
  assert.match(finance, /onClick=\{onManage\}/);
  assert.match(finance, /finance-personal-columns"><span>후원일<\/span><span>후원 금액<\/span>/);
  assert.doesNotMatch(finance, /<span>후원 내역<\/span>/);
  assert.match(finance, /row\.donorName/);
  assert.match(finance, /row\.amount/);
  assert.match(finance, /authPending\?/);
  assert.match(finance, /loggedIn\?<div className="finance-record-table">/);
  assert.match(finance, /onClick=\{onLogin\}/);
});
test('finance management uses separate protected route, not the public list', () => {
  for(const page of ['finance','donations','donation-manage','expenses','expense-manage'])assert.match(routes,new RegExp("page:'"+page+"'"));
  assert.match(routes,/page:'donation-manage',path:'\/finance\/donations\/manage'/);
  assert.match(app,/'donation-manage':\s*\(authPending/);
  assert.match(app, /canManageDonations=currentLevel==='staff'\|\|currentLevel==='president'/);
  assert.match(app, /<DonationManagement onBack=\{\(\)=>navigate\('donations'\)\}/);
  assert.match(app,/useBlocker\(/);
  assert.doesNotMatch(app,/window\.addEventListener\('popstate'/);
  assert.match(app, /<FinanceLanding onDonations=\{\(\) => navigate\('donations'\)\} onExpenses=\{\(\) => navigate\('expenses'\)\} canEditAccount=/);
  assert.match(app, /<ExpenseHistory onBack=\{\(\) => navigate\('finance'\)\} canManageExpenses=/);
  assert.match(app, /후원 회계 초기화/);
  assert.match(app, /void resetCategory\('finance'\)/);
});
test('server-only sensitive ledger operations and accessible manager actions remain distinct', async () => {
  const manager=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  const api=await readFile(new URL('../src/donationApi.ts',import.meta.url),'utf8');
  const publicRoute=await readFile(new URL('../functions/api/donations/public.js',import.meta.url),'utf8');
  const mineRoute=await readFile(new URL('../functions/api/donations/mine.js',import.meta.url),'utf8');
  const managementRoute=await readFile(new URL('../functions/api/donations/manage.js',import.meta.url),'utf8');
  for(const phrase of ['개별 추가','CSV 파일 선택','전체 내역 CSV 다운로드','익명자 명단 관리','익명자 명단 저장','수정','실무단 이상']){
    assert.ok(manager.includes(phrase),phrase);
  }
  assert.match(api,/auth.currentUser\?\.getIdToken\(\)/);
  assert.match(publicRoute,/publicDonation\(record,registry.people\)/);
  assert.match(mineRoute,/loadDonationsByStudentId\(env,studentId\)/);
  assert.match(managementRoute,/assertAccess\(request,env,'staff'\)/);
  assert.doesNotMatch(finance,/getDocs\(|collection\(/);
  assert.match(finance,/회비 집행 기록/);
  assert.match(finance,/readExpenses\(\)/);
  assert.match(finance,/거래일시<\/span><span>거래구분<\/span><span>거래금액<\/span><span>거래 후 잔액<\/span><span>거래내용/);
});
test('three finance pages retain mobile-friendly layouts', () => {
  assert.match(styles, /\.finance-entry-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(max-width:\s*680px\)\s*\{[\s\S]*?\.finance-entry-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.finance-bank-fields\s*\{/);
  assert.match(styles, /\.finance-login-gate\s*\{/);
});

test('footer copyright and nonclickable contacts share the same lower area', () => {
  const footer = app.slice(app.indexOf('<footer className="site-footer">'));
  const navStart = footer.indexOf('<nav className="footer-nav"');
  const navEnd = footer.indexOf('</nav>');
  const lower = footer.indexOf('<div className="container footer-lower">');
  const copyright = footer.indexOf('<div className="footer-bottom">');
  const contacts = footer.indexOf('<div className="footer-contact-section">');
  assert.ok(navStart >= 0 && navEnd > navStart && lower > navEnd && copyright > lower && contacts > copyright);
  assert.match(footer, /© MYROCK · 성균관대학교 중앙 밴드동아리/);
  assert.match(footer, /<span>회장 김서연 · 010-6350-7007<\/span>/);
  assert.match(footer, /<span>부회장 신희수 · 010-7684-4336<\/span>/);
  assert.match(footer, /<span className="footer-bug-report">/);
  assert.match(footer, /오류 보고 · naa3000@naver.com/);
  assert.doesNotMatch(footer, /href="(?:tel:|mailto:)|기능 개발 중|운영진 연락처 등록 예정/);
});
test('footer copyright is top-left and contacts top-right with mobile stacking', () => {
  assert.match(styles, /\.site-footer \.footer-lower\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) max-content;[^}]*align-items:\s*start;[^}]*border-top:\s*1px solid var\(--border\);/s);
  assert.match(styles, /\.site-footer \.footer-bottom\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;[^}]*padding:\s*2px 0 0;/s);
  assert.match(styles, /\.site-footer \.footer-contact-section\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;[^}]*justify-self:\s*end;/s);
  assert.match(styles, /@media \(max-width:\s*620px\)[\s\S]*?\.site-footer \.footer-bottom\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1;/);
  assert.match(styles, /@media \(max-width:\s*620px\)[\s\S]*?\.site-footer \.footer-contact-section\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2;/);
});


test('donation privacy guidance matches the actual CSV flag and anonymous roster policy', () => {
  assert.match(finance, /해당 기록의 <b>익명여부<\/b>를 설정/);
  assert.match(finance, /학번을 기준으로 <b>익명자 명단<\/b>에 등록/);
  assert.doesNotMatch(finance, /홍길동\(비공개\)/);
});

test('personal donation sum and CSV date-range preview are visible only with valid data', async () => {
  const manager=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  assert.match(finance,/mineLoaded&&!mineError&&<div className="finance-personal-total">/);
  assert.match(finance,/지금까지의 내 총 후원 금액/);
  assert.match(finance,/displayAmount\(sumDonationAmounts\(mine\)\)/);
  assert.match(manager,/const csvRange=donationDateRange\(csvRows\)/);
  assert.match(manager,/추가 준비: \{csvRows.length\}건\{csvRange&&/);
  assert.match(manager,/csvRange.start/);
  assert.match(manager,/csvRange.end/);
  assert.match(styles,/\.finance-personal-total\{/);
});
test('anonymous registry requires full identity and saved rows are read-only until removed',async()=>{
  const manager=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  const server=await readFile(new URL('../functions/_lib/donations.js',import.meta.url),'utf8');
  assert.match(manager,/isSavedPerson\(index\)\?<>/);
  assert.match(manager,/finance-manager-anonymous-value/);
  assert.match(manager,/person\.donorName\.trim\(\)/);
  assert.match(manager,/\^\\d\{10\}\$/);
  assert.match(manager,/익명자 명단은 이름과 숫자 10자리 학번을 모두 입력/);
  assert.match(manager,/saveAnonymousPeople\(cleaned,data.registryUpdateTime\)/);
  assert.match(server,/!donorName \|\| donorName.length > 80/);
  assert.doesNotMatch(manager,/placeholder="이름 \(선택\)"/);
});


test('donation edits use only inline row fields and remove the private disclosure note',async()=>{
  const manager=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(finance,/후원 기록이 익명으로 표시되어도 본인 학번으로 확인된 모든 내역을 조회할 수 있습니다/);
  assert.match(manager,/editing\?\.id===record.id\?/);
  for(const label of ['후원일 수정','후원자명 수정','학번 수정','후원금액 수정','익명여부 수정']){
    assert.ok(manager.includes(label),label);
  }
  assert.match(manager,/onClick=\{\(\)=>void persist\(\)\}/);
  assert.match(manager,/onClick=\{\(\)=>setEditing\(null\)\}>취소/);
  assert.match(manager,/editing&&!editing.id&&<form/);
});
test('transaction manager supports CSV upload, individual edits, templates and export',async()=>{
  const manager=await readFile(new URL('../src/ExpenseManagement.tsx',import.meta.url),'utf8');
  const client=await readFile(new URL('../src/financeTransactions.ts',import.meta.url),'utf8');
  assert.match(routes,/page:'expense-manage',path:'\/finance\/expenses\/manage'/);
  assert.match(app,/'expense-manage':\s*\(authPending/);
  assert.match(app,/user&&canManageDonations\?<ExpenseManagement/);
  for(const label of ['거래일시','거래구분','거래금액','거래 후 잔액','거래내용','CSV 다운로드','수정','취소']){
    assert.ok(manager.includes(label),label);
  }
  assert.match(manager,/finance-inline-edit/);
  assert.match(client,/TRANSACTION_COLUMNS=\['거래일시','거래구분','거래금액','거래 후 잔액','거래내용'\]/);
  assert.match(manager,/type="file"/);
  assert.match(manager,/onChange=\{event=>void chooseCsv\(event\)\}/);
  assert.match(manager,/onClick=\{\(\)=>void commitCsv\(\)\}/);
  assert.match(manager,/양식 내려받기/);
  assert.match(client,/downloadTransactions/);
  assert.match(styles,/\.finance-transaction-scroll>/);
});


test('anonymous roster save reports errors and success in a fixed bottom popup', async () => {
  const manager=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  assert.match(manager,/const \[peopleError,setPeopleError\]=useState\(''\)/);
  assert.match(manager,/const \[peopleMessage,setPeopleMessage\]=useState\(''\)/);
  assert.match(manager,/function markPeopleChanged\(\) \{[\s\S]*?setPeopleError\(''\);[\s\S]*?setPeopleMessage\(''\);/);
  const persist=manager.slice(manager.indexOf('  async function persistPeople()'),manager.indexOf('  return <>',manager.indexOf('  async function persistPeople()')));
  assert.match(persist,/setPeopleError\(''\);setPeopleMessage\(''\)/);
  assert.match(persist,/setPeopleMessage\('익명자 명단이 저장되었습니다.'\)/);
  assert.match(persist,/setPeopleError\(reason instanceof Error/);
  assert.doesNotMatch(persist,/setError\(|setMessage\(/);
  const footer=manager.slice(manager.indexOf('<div className="finance-manager-people-save">'));
  assert.match(footer,/익명자 명단 저장<\/button>/);
  assert.match(manager,/useToastSignals\(\{error:peopleError,message:peopleMessage\}\)/);
  assert.doesNotMatch(footer,/site-bottom-toast/);
  assert.match(styles,/\.site-bottom-toast\{position:fixed/);
  assert.doesNotMatch(footer,/finance-manager-people-feedback/);
});
test('donation inline edit keeps fixed columns and equally aligned save/cancel actions',async()=>{
  const manager=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  assert.match(manager,/<table className="finance-manager-table finance-donations-admin">/);
  assert.match(manager,/editing\?\.id===record.id\?/);
  assert.match(manager,/finance-row-actions"><div className="finance-inline-row-actions">/);
  assert.match(manager,/onClick=\{\(\)=>void persist\(\)\}[^>]*><Save size=\{13\}\/> 저장<\/button>/);
  assert.match(manager,/onClick=\{\(\)=>setEditing\(null\)\}>취소<\/button>/);
  assert.match(styles,/\.finance-donations-admin\{table-layout:fixed;min-width:900px\}/);
  assert.match(styles,/\.finance-donations-admin \.finance-inline-row-actions\{display:flex;align-items:center;gap:6px/);
  assert.match(styles,/\.finance-donations-admin \.finance-inline-row-actions \.outline-action\{[\s\S]*?flex:1;[\s\S]*?height:36px/);
});


test('both CSV managers provide matching sample formats and date guidance',async()=>{
  const donations=await readFile(new URL('../src/DonationManagement.tsx',import.meta.url),'utf8');
  const expenses=await readFile(new URL('../src/ExpenseManagement.tsx',import.meta.url),'utf8');
  for(const manager of [donations,expenses]){
    assert.match(manager,/CSV 파일 선택/);
    assert.match(manager,/양식 내려받기/);
    assert.match(manager,/날짜는 반드시 다음 예시와 같은 (?:형식|값)을 사용해야 합니다/);
    assert.match(manager,/추가 준비: \{csvRows.length\}건/);
    assert.match(manager,/CSV \{csvRows.length\}건 추가/);
    assert.match(manager,/window.confirm\('CSV '/);
  }
  assert.match(donations,/예시\) 2026-10-14/);
  assert.match(donations,/익명으로 표시하려면 '익명 여부' 칸에 소문자 'o'를 입력해 주세요. 다른 값이나 빈칸은 익명으로 처리되지 않습니다/);
  assert.doesNotMatch(donations,/후원일, 후원자명, 학번, 후원금액, 익명여부 · o만 익명 처리합니다/);
  assert.match(donations,/myrock-donations-template.csv/);
  assert.match(expenses,/예시\) 2026-10-14 15:30/);
  assert.doesNotMatch(expenses,/익명 여부 표시에는/);
  assert.match(expenses,/myrock-expense-transactions-template.csv/);
  assert.match(expenses,/for\(let i=0;i<csvRows.length;i\+=20\)/);
  assert.match(styles,/\.finance-manager-csv-guidance\{display:flex;flex-direction:column/);
});
test('member-management copy removed, action column is right aligned with a 3+2 control grid',async()=>{
  const members=await readFile(new URL('../src/MemberManager.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(members,/부원 명단 조회와 변경 권한은 Cloudflare 서버에서 매 요청마다 검사합니다/);
  assert.match(members,/className="member-live-head"><span>부원<\/span><span>기수 · 세션<\/span><span>직책 · 권한<\/span><span>관리<\/span>/);
  assert.match(styles,/\.member-live-head>span:last-child\{text-align:right;justify-self:end/);
  assert.match(styles,/\.member-live-row>\.member-actions\{[\s\S]*?display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles,/\.member-live-row>\.member-actions>button:nth-child\(4\)\{grid-column:1\/span 2\}/);
  assert.match(styles,/\.member-live-row>\.member-actions>button:nth-child\(5\)\{grid-column:3\}/);
});

test('unchanged bank account uses the same gray disabled save design as anonymous roster',async()=>{
  const page=await readFile(new URL('../src/FinancePages.tsx',import.meta.url),'utf8');
  assert.match(page,/disabled=\{busy\|\|!accountChanged\}/);
  assert.match(styles,/\.finance-manager-people-save>\.button:disabled\{/);
  assert.match(styles,/\.finance-account-edit-actions>\.button:disabled\{/);
  assert.match(styles,/background:#e4e9e5!important;border-color:#dbe1dc!important/);
  assert.match(styles,/\.finance-account-edit-actions>\.button:not\(:disabled\)\{opacity:1;filter:none\}/);
});

test('donation account is hidden from guests and available only to authenticated members',async()=>{
 const financeModel=await readFile(new URL('../src/financeTransactions.ts',import.meta.url),'utf8');
 const accountHandler=await readFile(new URL('../functions/api/finance/account.js',import.meta.url),'utf8');
 assert.match(app,/loggedIn=\{Boolean\(user&&profile&&!authPending\)\} authPending=\{authPending\} onLogin=\{showLogin\}/);
 assert.match(finance,/if\(!loggedIn\|\|authPending\)return/);
 assert.match(finance,/authPending\|\|!loggedIn\?<div className="finance-account-locked" role="status">/);
 assert.match(finance,/후원 계좌 정보는 비공개입니다\./);
 assert.match(finance,/후원 계좌는 로그인 후 확인할 수 있습니다\./);
 assert.match(finance,/onClick=\{onLogin\}/);
 assert.match(finance,/회칙에 따라 <strong>회원인 동아리 부원 및 OB만 후원할 수 있습니다\.<\/strong>/);
 assert.match(accountHandler,/await assertAccess\(request,env,'member'\)/);
 assert.match(financeModel,/readDonationAccount=\(\)=>request<\{account:DonationAccount\}>\('account',undefined,true\)/);
 assert.doesNotMatch(financeModel,/302-0000-0000-31|DEFAULT_ACCOUNT/);
 assert.match(styles,/\.finance-account-locked\{/);
 assert.match(styles,/\.finance-support-eligibility\{/);
});
