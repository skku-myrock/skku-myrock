import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('global toast host uses timed bottom X design for all three tones',async()=>{
 const [app,toast,styles,helper]=await Promise.all([read('src/App.tsx'),read('src/TimedBottomToast.tsx'),read('src/styles/management.css'),read('src/toast.ts')]);
 assert.match(app,/window\.addEventListener\(MYROCK_TOAST_EVENT,listen\)/);
 assert.match(app,/activeToast&&<TimedBottomToast key=\{activeToast.id\}/);
 assert.match(helper,/export function showToast/);
 assert.match(helper,/export function useToastFeedback/);
 assert.match(toast,/tone\?:'success'\|'error'\|'warning'/);
 assert.match(toast,/setTimeout\(\(\)=>setLeaving\(true\),3000\)/);
 assert.match(toast,/<X size=\{17\}/);
 assert.match(styles,/\.site-bottom-toast\.is-warning/);
 assert.match(styles,/\.site-bottom-toast\.is-error/);
 assert.match(styles,/\.site-bottom-toast\.is-timed>button\{[\s\S]*?border:0/);
 assert.doesNotMatch(app,/\{toast&&<div className="toast"/);
});
test('CSV, handover, gallery, schedule, equipment and about use global feedback',async()=>{
 for(const path of ['src/DonationManagement.tsx','src/ExpenseManagement.tsx','src/HandoverNotes.tsx','src/MemberManager.tsx','src/EquipmentManager.tsx','src/NoticeComposer.tsx','src/AboutManagement.tsx','src/PhotoGallery.tsx','src/ScheduleRoom.tsx','src/GalleryUploadDialog.tsx']){
  const src=await read(path);
  assert.match(src,/useToastFeedback|showToast/);
  assert.doesNotMatch(src,/className="site-bottom-toast is-success"|toast schedule-invite-toast/);
 }
});
