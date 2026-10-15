import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import typescript from 'typescript';

async function draftLogic(){
  const source=await readFile(new URL('../src/anonymousRosterDraft.ts',import.meta.url),'utf8');
  const code=typescript.transpileModule(source,{compilerOptions:{
    module:typescript.ModuleKind.ESNext,target:typescript.ScriptTarget.ES2022
  }}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const kim={donorName:'김서연',studentId:'2025311096'};
const na={donorName:'나재원',studentId:'2025712558'};

test('pending anonymous exclusions stay in the displayed draft and only disappear on save',async()=>{
  const {activeAnonymousPeople,hasAnonymousRosterChanges}=await draftLogic();
  const saved=[kim,na],draft=[{...kim},{...na}];
  assert.equal(hasAnonymousRosterChanges(draft,saved,[]),false,'no changes disables save');
  assert.deepEqual(activeAnonymousPeople(draft,[0]),[na]);
  assert.equal(draft.length,2,'exclusion must not erase displayed rows');
  assert.equal(hasAnonymousRosterChanges(draft,saved,[0]),true,'pending exclusion enables save');
  assert.equal(hasAnonymousRosterChanges(draft,saved,[]),false,'undo returns to disabled state');
  assert.deepEqual(activeAnonymousPeople(draft,[0,1]),[]);
  assert.equal(hasAnonymousRosterChanges(draft,saved,[0,1]),true,'removing all persists empty roster');
  assert.equal(hasAnonymousRosterChanges([],[],[]),false);
});
test('new anonymous entries, formatting changes and undone drafts compute exact save state',async()=>{
  const {activeAnonymousPeople,hasAnonymousRosterChanges}=await draftLogic();
  const saved=[kim],blank={donorName:'',studentId:''};
  assert.equal(hasAnonymousRosterChanges([...saved,blank],saved,[]),true);
  assert.equal(hasAnonymousRosterChanges([...saved,blank],saved,[1]),false,'excluded unsaved row has no server change');
  assert.deepEqual(activeAnonymousPeople([...saved,blank],[1]),[kim]);
  assert.equal(hasAnonymousRosterChanges([{donorName:' 김서연 ',studentId:'2025311096'}],saved,[]),false);
  assert.equal(hasAnonymousRosterChanges([na],saved,[]),true);
});
test('anonymous roster save, strikeout, cursor and busy markers are wired to the intended screens',async()=>{
  const paths=['../src/DonationManagement.tsx','../src/ExpenseManagement.tsx',
    '../src/FinancePages.tsx','../src/MemberManager.tsx','../src/PasswordChange.tsx','../src/App.tsx'];
  const [donations,expenses,finance,members,password,app]=await Promise.all(paths.map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(donations,/hasAnonymousRosterChanges\(people,data.people,pendingExclusions\)/);
  assert.match(donations,/const cleaned=activeAnonymousPeople\(people,pendingExclusions\)/);
  assert.match(donations,/setPendingExclusions\(\[\]\)/);
  assert.match(donations,/is-pending-removal/);
  assert.match(donations,/setPendingExclusions\(previous=>previous.includes\(index\)\?previous.filter/);
  assert.match(donations,/pendingExclusions.includes\(index\)\?'제외 취소':'제외'/);
  assert.match(donations,/disabled=\{busy\|\|!peopleChanged\} aria-disabled=\{busy\|\|!peopleChanged\}/);
  assert.match(css,/\.finance-manager-people-save>\.button:disabled\{/);
  assert.match(css,/\.finance-manager-anonymous-row\.is-pending-removal \.finance-manager-anonymous-value strong/);
  assert.match(css,/text-decoration:line-through/);
  assert.match(css,/body:has\(\[data-async-busy="true"\]\),body:has\(\[data-async-busy="true"\]\) \*\{/);
  assert.match(css,/cursor:wait!important/);
  for(const [name,source] of Object.entries({donations,expenses,finance,members,password,app})){
    assert.match(source,/data-async-busy=\{/,'missing busy marker in '+name);
  }
  assert.match(app,/data-async-busy=\{rosterResetting\|\|financeResetting/);
  assert.match(css,/button:disabled\{cursor:default!important\}/);
});
