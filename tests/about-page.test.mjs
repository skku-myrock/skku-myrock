import {readStyles} from './readStyles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
const styles=await readStyles();
const defaults=await readFile(new URL('../src/aboutContent.ts',import.meta.url),'utf8');
const editor=await readFile(new URL('../src/AboutManagement.tsx',import.meta.url),'utf8');

test('default introduction retains eight leaders and original two milestones',()=>{
  for(const name of ['김서연','신희수','배은성','허지원','정해준','김하은','추서현','김민현'])
    assert.ok(defaults.includes("name:'"+name+"'"),name);
  assert.match(defaults,/cohortLabel:'28기 운영진 소개'/);
  assert.match(defaults,/1998년/);
  assert.match(defaults,/모여락 창단/);
  assert.match(defaults,/2023년/);
  assert.match(defaults,/중앙동아리 승격/);
});
test('public about screen loads persisted introduction and leaves social links intact',()=>{
  assert.match(app,/function About\(\{ navigate, canEdit \}/);
  assert.match(app,/void getAbout\(\)\.then/);
  assert.match(app,/content\.officers\.map\(officer/);
  assert.match(app,/content\.history\.map\(item/);
  assert.match(app,/content\.cohortLabel/);
  assert.match(app,/content\.heroImage\?<img/);
  assert.match(app,/officer\.photoUrl\?<img/);
  assert.match(styles,/\.leader-item img\.leader-photo\{/);
  assert.match(app,/href="https:\/\/www\.instagram\.com\/skku_m\.y\.rock\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(app,/href="https:\/\/www\.youtube\.com\/@SKKUMYRock"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});
test('protected editor supports leader management, photo upload, history and save',()=>{
  assert.match(app,/page==='about-manage'/);
  assert.match(app,/user&&canManageDonations\?<AboutManagement/);
  assert.match(app,/canEdit=\{Boolean\(user&&!authPending&&canManageDonations\)\}/);
  assert.match(app,/navigate\('about-manage'\)/);
  assert.match(editor,/getAboutManagement\(\)/);
  assert.match(editor,/saveAbout\(next,version\)/);
  assert.match(editor,/uploadImagesBatch\(/);
  for(const label of ['동아리 소개 사진','메인 페이지 사진','운영진 명단','운영진 추가','연혁 추가','사진 URL','이미지 URL','변경 사항 저장'])
    assert.ok(editor.includes(label),label);
  assert.match(styles,/\.about-manage-fields\{/);
});


test('about management save feedback is a bottom popup and the deploy-only R2 hint is hidden',async()=>{
  const editor=await readFile(new URL('../src/AboutManagement.tsx',import.meta.url),'utf8');
  assert.match(editor,/site-bottom-toast/);
  assert.match(editor,/role=\{error\?'alert':'status'\}/);
  assert.match(editor,/onClick=\{\(\)=>\{setError\(''\);setMessage\(''\);\}\}/);
  assert.doesNotMatch(editor,/파일 업로드에는 Cloudflare R2 MYROCK_IMAGES 바인딩이 필요합니다/);
  assert.match(styles,/\.site-bottom-toast\{position:fixed/);
});

test('homepage and introduction images have distinct labels and fields',()=>{
  assert.match(defaults,/homeImage:''/);
  assert.match(app,/homeImage\?<img className="home-hero-image"/);
  assert.match(app,/alt="동아리 소개 사진"/);
  assert.match(editor,/type:'home'/);
  assert.match(editor,/메인 페이지 사진/);
});


test('legacy R2 object reads are not part of the new image path',async()=>{
  const legacy=await readFile(new URL('../functions/api/about/image.js',import.meta.url),'utf8');
  const server=await readFile(new URL('../functions/_lib/aboutContent.js',import.meta.url),'utf8');
  assert.doesNotMatch(legacy,/MYROCK_IMAGES|\.get\(key\)|onRequestGet/);
  assert.match(legacy,/onRequestPost/);
  assert.doesNotMatch(server,/key=about\\\//);
});
