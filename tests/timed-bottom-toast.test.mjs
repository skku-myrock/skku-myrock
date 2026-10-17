import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(name)=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('login success and introduction edit notices share timed design while other generic notices remain unchanged',async()=>{
 const [app,about,toast,login,styles]=await Promise.all([
  read('src/App.tsx'),read('src/AboutManagement.tsx'),read('src/TimedBottomToast.tsx'),
  read('src/pages/SitePages.tsx'),read('src/styles/management.css'),
 ]);
 assert.match(app,/const \[loginNotice,setLoginNotice\]=useState\(''\)/);
 assert.match(app,/notify=\{message=>setLoginNotice\(message\?\?''\)\}/);
 assert.match(app,/loginNotice&&<TimedBottomToast message=\{loginNotice\}/);
 assert.match(app,/aboutSaveNotice&&<TimedBottomToast message=\{aboutSaveNotice\}/);
 assert.match(login,/notify\('로그인되었습니다\. 내 정보에서 세션을 확인할 수 있습니다\.'\)/);
 assert.match(about,/\(error\|\|message\)&&<TimedBottomToast/);
 assert.match(about,/선택한 사진은 로컬 미리보기입니다\. 변경 사항 저장 시 업로드됩니다\./);
 assert.match(app,/\{toast&&<div className="toast" role="status">/);
 assert.match(toast,/site-bottom-toast is-timed /);
 assert.match(toast,/setTimeout\(\(\)=>setLeaving\(true\),3000\)/);
 assert.match(toast,/setTimeout\(\(\)=>closeRef\.current\(\),250\)/);
 assert.match(toast,/aria-label="알림 닫기"/);
 assert.match(toast,/<X size=\{17\}/);
 assert.doesNotMatch(toast,/>닫기<\/button>/);
 assert.match(styles,/\.site-bottom-toast\.is-timed>button\{[\s\S]*?border:0/);
 assert.match(styles,/\.site-bottom-toast\.is-timed\{padding-left:28px;/);
 assert.match(styles,/@media\(max-width:700px\)\{\.site-bottom-toast\.is-timed\{padding-left:25px\}\}/);
 assert.match(styles,/@keyframes myrock-toast-depart/);
 assert.match(styles,/translate\(-50%,calc\(100% \+ 40px\)\)/);
});

test('unmigrated gallery, donations, finance and schedule notifications stay untouched',async()=>{
 const [gallery,donation,finance,schedule]=await Promise.all([
  read('src/PhotoGallery.tsx'),read('src/DonationManagement.tsx'),
  read('src/FinancePages.tsx'),read('src/ScheduleRoom.tsx'),
 ]);
 for(const source of [gallery,donation,finance])assert.match(source,/site-bottom-toast/);
 assert.match(schedule,/toast schedule-invite-toast/);
 assert.doesNotMatch(gallery,/TimedBottomToast/);
 assert.doesNotMatch(donation,/TimedBottomToast/);
 assert.doesNotMatch(finance,/TimedBottomToast/);
 assert.doesNotMatch(schedule,/TimedBottomToast/);
});
