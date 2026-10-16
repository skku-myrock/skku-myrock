import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('equipment status dot and text use the same centered flex row',async()=>{
 const css=await read('src/styles/base.css');
 assert.match(css,/\.equipment-info>\.equipment-status\{display:flex;width:max-content;min-height:16px;align-items:center;gap:7px;line-height:16px\}/);
 assert.match(css,/\.equipment-status::before\{[^}]*width:8px;height:8px;border-radius:50%/);
});

test('profile explains that staff should handle member information changes',async()=>{
 const pages=await read('src/pages/SitePages.tsx');
 assert.match(pages,/<h2>회원 정보<\/h2><\/div>\s*<p className="profile-help">정보 수정이 필요할 경우 운영진에게 연락 바랍니다\.<\/p>/);
});

test('privileged and OB members have visually disabled but warning-accessible delete controls',async()=>{
 const [manager,app,css,server]=await Promise.all([
  read('src/MemberManager.tsx'),read('src/App.tsx'),read('src/styles/base.css'),
  read('functions/api/members/delete.js'),
 ]);
 assert.match(manager,/member\.role !== 'member' \|\| member\.handoverAccess \|\| member\.protected/);
 assert.match(manager,/aria-disabled=\{member\.role !== 'member' \|\| member\.handoverAccess/);
 assert.match(manager,/notify\('권한이 부여된 인원은 삭제할 수 없습니다\. 먼저 권한을 해제해주세요\.'\)/);
 assert.match(manager,/onClick=\{\(\) => void removeMember\(member\)\}/);
 assert.match(app,/currentUid=\{user\.uid\} level=\{currentLevel!\} notify=\{notify\}/);
 assert.match(css,/\.member-danger\.member-danger-restricted/);
 assert.match(server,/document\?\.fields\?\.role\?\.stringValue !== 'member'/);
 assert.match(server,/document\?\.fields\?\.handoverAccess\?\.booleanValue === true/);
});
