import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readStyles} from './readStyles.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const styles=await readStyles();
const landing=await read('src/SchedulePages.tsx');
const app=await read('src/App.tsx');
const api=await read('src/scheduleApi.ts');
const routes=await read('src/app/siteNavigation.ts');

test('real schedule list replaces all fixture schedules',()=>{
 assert.doesNotMatch(landing,/scheduleExamples|invitationExamples|예시 시간표 4개|PREVIEW/);
 assert.match(landing,/await Promise\.all\(\[listSchedules\(\),listInvitations\(\)\]\)/);
 assert.match(landing,/schedules\.map\(schedule=>/);
 assert.match(landing,/로그인하면 시간표와 받은 초대를 확인할 수 있습니다/);
 assert.match(app,/loggedIn=\{Boolean\(user && profile && !authPending\)\}/);
 assert.match(app,/'schedule-detail': activeScheduleId && user && profile && !authPending/);
 assert.match(app,/<ScheduleRoom key=\{activeScheduleId\}/);
 assert.doesNotMatch(app,/findSchedule\(|ScheduleDraft|ScheduleDetail schedule=/);
});

test('invitations show zero count, empty state and actionable accept/decline only to login',()=>{
 assert.match(landing,/초대 \{invitations\.length\}건/);
 assert.match(landing,/수락 대기중인 시간표가 없습니다/);
 assert.match(landing,/inv\.inviterName/);
 assert.match(landing,/inv\.title/);
 assert.match(landing,/await respondInvitation\(id,action\)/);
 assert.match(landing,/onClick=\{\(\)=>void act\(inv\.id,'accept'\)\}/);
 assert.match(landing,/onClick=\{\(\)=>void act\(inv\.id,'decline'\)\}/);
 assert.match(landing,/disabled=\{!loggedIn\|\|authPending\}/);
 assert.match(landing,/role="dialog" aria-modal="true"/);
 assert.match(landing,/event\.target===e\.currentTarget|e\.target===e\.currentTarget/);
 assert.match(api,/request<\{success:boolean;scheduleId:string\}>\('schedule-invitations\/'/);
 assert.doesNotMatch(landing,/초대한 사람 · \{invitation\.inviter\}/);
});
test('schedule routes preserve browser navigation and a route-change leave blocker',()=>{
 assert.match(routes,/export const schedulePath=\(id:string\)=>'\/schedule\/'/);
 assert.match(app,/useBlocker\(/);
 assert.match(app,/leaveGuardRef\.current\?\.\(\)/);
 assert.match(app,/registerLeaveGuard=\{registerEditorLeaveGuard\}/);
 assert.match(routes,/page:'schedule-create',path:'\/schedule\/create'/);
 assert.doesNotMatch(routes,/schedule-draft/);
});
test('time grid layout retains fixed left hour axis and visible 30-minute lines',()=>{
 assert.match(styles,/\.schedule-timetable-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
 assert.match(styles,/\.schedule-time-axis\s*\{[^}]*position:\s*sticky;[^}]*left:\s*0;/s);
 assert.match(styles,/\.schedule-time-slot\s*\{[^}]*flex:\s*0 0 20px;[^}]*height:\s*20px;/s);
 assert.match(styles,/\.schedule-time-slot\s*\{[^}]*border-top:\s*1px solid #cfded3;[^}]*border-right:\s*1px solid #cfded3;/s);
});

test('schedule landing omits the obsolete usage guide',()=>{
 assert.doesNotMatch(landing,/schedule-usage-guide|schedule-usage-heading|schedule-usage-list|시간표 사용 안내/);
 assert.doesNotMatch(styles,/\.schedule-usage-guide|\.schedule-usage-heading|\.schedule-usage-list/);
 assert.match(landing,/시간표 만들기/);
 assert.match(landing,/내가 참여한 시간표/);
 assert.match(landing,/초대 \{invitations\.length\}건/);
});
