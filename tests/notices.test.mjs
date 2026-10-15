import {readStyles} from './readStyles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import typescript from 'typescript';
import {validateNotice} from '../functions/_lib/notices.js';

const source=async path=>path==='src/styles.css'?readStyles():readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,composer,model,backend,index,detail,batch,style]=await Promise.all(['src/App.tsx','src/NoticeComposer.tsx','src/noticesData.ts','functions/_lib/notices.js','functions/api/notices/index.js','functions/api/notices/[id].js','functions/api/images/batch.js','src/styles.css'].map(source));
const base={title:'새 공지',category:'공지',blocks:[{kind:'text',text:'본문'}]};

test('demo notices are removed and public page loads persisted notices',()=>{
  assert.doesNotMatch(model,/recruit-29-5|summer-concert-2026|homecoming-2026/);
  assert.match(model,/listNotices/);
  assert.match(app,/void listNotices\(\)/);
  assert.match(app,/notices\.slice\(0, 3\)/);
  assert.match(app,/notices\.filter/);
});

test('public sees notice author and only part leaders or above see management menu',()=>{
  assert.match(app,/<span className="notice-author-cell">작성자<\/span>/);
  assert.match(app,/<span className="notice-author-cell">\{post.author\}<\/span>/);
  assert.match(app,/<span>작성자 \{notice.author\}<\/span>/);
  assert.match(app,/canManage&&<div className="notice-manage-actions">/);
  assert.match(app,/수정하기/);
  assert.match(app,/삭제하기/);
  assert.match(app,/page==='notice-edit'/);
  assert.match(index,/assertAccess\(request,env,'part_leader'\)/);
  assert.match(detail,/assertAccess\(request,env,'part_leader'\)/);
  assert.match(detail,/onRequestDelete/);
});

test('notice payload validates block content, image URLs and slide size',()=>{
  assert.equal(validateNotice(base).blocks[0].text,'본문');
  assert.throws(()=>validateNotice({...base,title:''}),/제목/);
  assert.throws(()=>validateNotice({...base,category:'관리자'}),/분류/);
  assert.throws(()=>validateNotice({...base,blocks:[{kind:'text',text:''}]}),/내용/);
  assert.throws(()=>validateNotice({...base,blocks:[{kind:'image',url:'blob:evil',width:200,height:100}]}),/URL/);
  assert.throws(()=>validateNotice({...base,blocks:[{kind:'gallery',images:[]}]}),/슬라이드/);
  assert.equal(validateNotice({...base,blocks:[{kind:'image',url:'https://example.com/a.webp',width:320,height:240}]}).blocks[0].width,'320');
});

test('notice mutations preserve original author and publication date',()=>{
  assert.match(backend,/authorUid:caller.uid/);
  assert.match(backend,/author:old.author,authorUid:old.authorUid,publishedAt:old.publishedAt/);
  assert.match(backend,/currentDocument.updateTime/);
  assert.match(backend,/currentDocument.exists/);
  assert.match(backend,/deleteNotice/);
});

test('composer previews files locally, batches uploads only on publish and supports editing',()=>{
  for(const phrase of ['URL.createObjectURL','URL.revokeObjectURL','const [busy,setBusy]','uploadImagesBatch','onSaved(saved)','updateNotice(initial.id','createNotice(input)','변경 사항 저장','수정하기','발행','본문 추가','원본 비율 복원']){
    assert.ok(composer.includes(phrase),phrase);
  }
  assert.match(composer,/initial\?\.blocks\?\.length/);
  assert.match(composer,/localFiles\.current\.set\(url,file\)/);
  assert.match(composer,/uploaded\.current\.set/);
  assert.doesNotMatch(composer,/발행 \(준비 중\)|게시글은 저장되지 않습니다/);
});

test('batch images use only GitHub private repository and one commit',()=>{
  assert.match(batch,/assertAccess\(request,env,'part_leader'\)/);
  assert.match(batch,/GITHUB_IMAGES_TOKEN/);
  assert.match(batch,/myrock-images/);
  assert.match(batch,/git\/blobs/);
  assert.match(batch,/git\/trees/);
  assert.match(batch,/git\/commits/);
  assert.match(batch,/force:false/);
  assert.match(batch,/files.length>12/);
  assert.doesNotMatch(model,/GITHUB_IMAGES_TOKEN/);
});

test('image sizing and slide order utilities remain correct',async()=>{
  const mod=async name=>{
    const code=await source('src/'+name+'.ts');
    const js=typescript.transpileModule(code,{compilerOptions:{module:typescript.ModuleKind.ESNext,target:typescript.ScriptTarget.ES2022}}).outputText;
    return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  };
  const {initialImageDimensions,resizeImageDimensions}=await mod('noticeImageSize');
  const {reorderGalleryImages}=await mod('noticeGalleryOrder');
  assert.deepEqual(initialImageDimensions(1600,800),{width:800,height:400});
  assert.deepEqual(resizeImageDimensions({width:800,height:400},'width',400,true),{width:400,height:200});
  assert.deepEqual(reorderGalleryImages([{id:1},{id:2},{id:3}],1,3).map(x=>x.id),[2,3,1]);
  assert.match(style,/notice-composer-image-picker\.is-new-image\{margin-top:16px\}/);
});

test('original pixel ratio is used even when displayed dimensions were rounded',async()=>{
  const source=await readFile(new URL('../src/noticeImageSize.ts',import.meta.url),'utf8');
  const js=typescript.transpileModule(source,{compilerOptions:{module:typescript.ModuleKind.ESNext,target:typescript.ScriptTarget.ES2022}}).outputText;
  const {resizeImageDimensions}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const initial={width:800,height:533,naturalWidth:4032,naturalHeight:3024};
  assert.deepEqual(resizeImageDimensions(initial,'height',300,true),{width:400,height:300});
  assert.deepEqual(resizeImageDimensions({...initial,width:400,height:300},'width',500,true),{width:500,height:375});
  assert.deepEqual(resizeImageDimensions({...initial,width:500,height:375},'height',300,true),{width:400,height:300});
});
test('notice dimension input is editable while focused and commits on blur only',async()=>{
  const composer=await readFile(new URL('../src/NoticeComposer.tsx',import.meta.url),'utf8');
  const css=await readStyles();
  assert.match(composer,/dimensionDrafts/);
  assert.match(composer,/onBlur=\{event=>commitDimension\(/);
  assert.match(composer,/onChange=\{event=>setDimensionDrafts\(/);
  assert.match(composer,/dimensionWarning\(image.id\)/);
  assert.match(composer,/dimensionWarning\(block.id\)/);
  assert.match(composer,/uploadImagesBatch\(pending.map\(url=>localFiles.current.get\(url\)!\),'notices'\)/);
  assert.match(css,/\.notice-dimension-error\{/);
  assert.match(css,/\.notice-table-row small\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
});
test('image upload API accepts only site and notices folders',async()=>{
  const api=await readFile(new URL('../functions/api/images/batch.js',import.meta.url),'utf8');
  const client=await readFile(new URL('../src/imageUpload.ts',import.meta.url),'utf8');
  assert.match(api,/folder!=='site'&&folder!=='notices'/);
  assert.match(api,/const path=folder\+'\/'/);
  assert.match(client,/body.append\('folder',folder\)/);
});
