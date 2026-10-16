import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('profile session text and password change guidance match the requested copy',async()=>{
 const [profile,password]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/PasswordChange.tsx')]);
 assert.match(profile,/본인의 세션을 선택해주세요\. 세션은 중복으로 선택할 수 있습니다\./);
 assert.doesNotMatch(profile,/참여하는 세션을 모두 선택할 수 있습니다/);
 assert.match(password,/<p className="profile-help">최소 6자 이상의 비밀번호를 사용해주세요\.<\/p>/);
 assert.match(password,/현재 비밀번호를 잊었거나 로그인에 문제가 생기면 운영진에게 문의해 주세요\.<\/p>/);
 assert.doesNotMatch(password,/자동 이메일 재설정은 지원하지 않습니다/);
 assert.doesNotMatch(password,/현재 비밀번호로 재인증한 다음 원하는 비밀번호로 변경할 수 있습니다/);
});

test('notice count is removed while load-more stays conditional and right-aligned',async()=>{
 const [pages,css]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/styles/notices.css')]);
 assert.doesNotMatch(pages,/불러온 공지사항 \{filtered\.length\}건/);
 assert.match(pages,/\{hasMore&&<div className="list-bottom notice-list-bottom"><button type="button" className="outline-action" disabled=\{moreLoading\} onClick=\{onLoadMore\}>/);
 assert.match(css,/\.notice-list-bottom \{ justify-content: flex-end; \}/);
});
