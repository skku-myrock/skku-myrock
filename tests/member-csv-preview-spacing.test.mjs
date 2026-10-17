import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(name)=>readFile(new URL('../'+name,import.meta.url),'utf8');

test('CSV file confirmation text has bottom spacing before the member preview table',async()=>{
 const [component,css]=await Promise.all([
  read('src/MemberManager.tsx'),read('src/styles/base.css'),
 ]);
 assert.match(component,/<p className="form-hint member-csv-preview-hint">파일: \{fileName\} · 아래 회원을 모두 확인해 주세요\. 이미 가입한 학번은 덮어쓰지 않고 건너뜁니다\.<\/p>/);
 assert.match(component,/<div className="member-preview-scroll">/);
 assert.match(css,/\.member-csv-preview-hint\{margin-bottom:16px\}/);
 assert.match(css,/\.form-hint\{color:#9aa5a1;font-size:11px;margin:17px 0 0\}/);
});
