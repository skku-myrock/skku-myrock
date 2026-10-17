import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('one bottom toast host handles login, about and global notices with X and 3-second dismissal',async()=>{
 const [app,about,toast,bus,login,styles]=await Promise.all([
  read('src/App.tsx'),read('src/AboutManagement.tsx'),read('src/TimedBottomToast.tsx'),
  read('src/toastBus.ts'),read('src/pages/SitePages.tsx'),read('src/styles/management.css'),
 ]);
 assert.match(app,/window\.addEventListener\('myrock:toast',listener\)/);
 assert.match(app,/bottomNotice&&<TimedBottomToast key=\{bottomNotice\.id\}/);
 assert.match(app,/notify=\{message=>showToast\(message\?\?'','success'\)\}/);
 assert.match(about,/useToastSignals\(\{error,message\}\)/);
 assert.match(login,/notify\('로그인되었습니다\. 내 정보에서 세션을 확인할 수 있습니다\.'\)/);
 assert.match(bus,/window\.dispatchEvent\(new CustomEvent<ToastDetail>\('myrock:toast'/);
 assert.match(toast,/site-bottom-toast is-timed /);
 assert.match(toast,/setTimeout\(\(\)=>setLeaving\(true\),3000\)/);
 assert.match(toast,/setTimeout\(\(\)=>closeRef\.current\(\),250\)/);
 assert.match(toast,/aria-label="알림 닫기"/);
 assert.match(toast,/<X size=\{17\}/);
 assert.match(styles,/\.site-bottom-toast\.is-timed>button\{[\s\S]*?border:0/);
 assert.match(styles,/\.site-bottom-toast\.is-timed\{padding-left:28px;/);
 assert.match(styles,/@keyframes myrock-toast-depart/);
 assert.doesNotMatch(app,/\{toast&&<div className="toast"/);
});

test('former page-local feedback routes through the global host, not fixed local toasts',async()=>{
 const pages=['src/PhotoGallery.tsx','src/DonationManagement.tsx','src/FinancePages.tsx','src/ScheduleRoom.tsx',
 'src/ExpenseManagement.tsx','src/HandoverNotes.tsx','src/EquipmentManager.tsx','src/NoticeComposer.tsx'];
 for(const page of pages){
  const source=await read(page);
  assert.match(source,/useToastSignals|showToast\(/,page);
  assert.doesNotMatch(source,/className=["{].*site-bottom-toast|toast schedule-invite-toast/,page);
 }
});
