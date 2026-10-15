import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const src=await readFile(new URL('../src/imageCompression.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {prepareImageForUpload,validateSourceImage,MAX_SOURCE_IMAGE_BYTES,MAX_UPLOAD_IMAGE_BYTES}=
  await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('large still photographs are accepted, GIF uploads are completely rejected',()=>{
 assert.doesNotThrow(()=>validateSourceImage({type:'image/jpeg',size:22_000_000}));
 assert.doesNotThrow(()=>validateSourceImage({type:'image/png',size:MAX_SOURCE_IMAGE_BYTES}));
 assert.throws(()=>validateSourceImage({type:'image/png',size:MAX_SOURCE_IMAGE_BYTES+1}),/30MB/);
 assert.throws(()=>validateSourceImage({type:'image/gif',size:1000}),/JPG/);
 assert.throws(()=>validateSourceImage({type:'image/gif',size:MAX_UPLOAD_IMAGE_BYTES+1}),/JPG/);
 assert.throws(()=>validateSourceImage({type:'application/pdf',size:100}),/JPG/);
 assert.throws(()=>validateSourceImage({type:'image/png',size:0}),/JPG/);
});

test('already-small WebP is untouched and GIF cannot be prepared',async()=>{
 const gif=new File([new Uint8Array(1000)],'animation.gif',{type:'image/gif'});
 const photo=new File([new Uint8Array(1000)],'small.webp',{type:'image/webp'});
 await assert.rejects(prepareImageForUpload(gif),/JPG/);
 assert.equal(await prepareImageForUpload(photo),photo);
});

test('large PNG is resized and encoded to WebP before upload without server involvement',async()=>{
 const previousBitmap=globalThis.createImageBitmap,previousDoc=globalThis.document;
 let closed=false,requestedWidth=0,requestedHeight=0,drawCount=0;
 try{
   globalThis.createImageBitmap=async()=>({width:4000,height:3000,close(){closed=true}});
   globalThis.document={createElement:()=>({
     width:0,height:0,
     getContext(){return {clearRect(){},drawImage(){drawCount++;requestedWidth=this.canvasWidth;}};},
     toBlob(callback,type){assert.equal(type,'image/webp');callback(new Blob([new Uint8Array(700_000)],{type:'image/webp'}));}
   })};
   const original=new File([new Uint8Array(6_000_000)],'performance.png',{type:'image/png'});
   const result=await prepareImageForUpload(original);
   assert.equal(result.type,'image/webp');
   assert.equal(result.name,'performance.webp');
   assert.equal(result.size,700_000);
   assert.ok(drawCount>=1);
   assert.equal(closed,true);
 }finally{globalThis.createImageBitmap=previousBitmap;globalThis.document=previousDoc;}
});

test('cannot silently upload an oversized original when WebP is unavailable',async()=>{
 const previousBitmap=globalThis.createImageBitmap,previousDoc=globalThis.document;
 try{
   globalThis.createImageBitmap=async()=>({width:1000,height:1000,close(){}});
   globalThis.document={createElement:()=>({
     getContext(){return {clearRect(){},drawImage(){}};},
     toBlob(callback){callback(new Blob([new Uint8Array(100)],{type:'image/png'}));}
   })};
   const big=new File([new Uint8Array(5_100_000)],'large.png',{type:'image/png'});
   await assert.rejects(prepareImageForUpload(big),/WebP 압축/);
 }finally{globalThis.createImageBitmap=previousBitmap;globalThis.document=previousDoc;}
});

test('animated WebP preserves its frames rather than flattening into a still',async()=>{
 const header=new Uint8Array(24);
 for(const [offset,text] of [[0,'RIFF'],[8,'WEBPVP8X']])
   for(let i=0;i<text.length;i++)header[offset+i]=text.charCodeAt(i);
 header[20]=2;
 const original=new File([header,new Uint8Array(450_000)],'loop.webp',{type:'image/webp'});
 assert.equal(await prepareImageForUpload(original),original);
 const big=new File([header,new Uint8Array(5_100_000)],'loop.webp',{type:'image/webp'});
 await assert.rejects(prepareImageForUpload(big),/움직이는 WebP/);
});

test('batch upload compresses before enforcing 5MB GitHub API limit',async()=>{
 const uploader=await readFile(new URL('../src/imageUpload.ts',import.meta.url),'utf8');
 const about=await readFile(new URL('../src/AboutManagement.tsx',import.meta.url),'utf8');
 const notice=await readFile(new URL('../src/NoticeComposer.tsx',import.meta.url),'utf8');
 assert.match(uploader,/await prepareImageForUpload\(original\)/);
 assert.match(uploader,/file\.size>MAX_UPLOAD_IMAGE_BYTES/);
 assert.match(uploader,/body\.append\('folder',folder\)/);
 assert.match(about,/validateSourceImage\(file\)/);
 assert.match(notice,/selected\.forEach\(validateSourceImage\)/);
 for(const s of [about,notice]){
   assert.match(s,/원본 사진.*별도로 보관/);
   assert.doesNotMatch(s,/image\/gif|GIF 애니메이션/);
 }
 const api=await readFile(new URL('../functions/api/images/batch.js',import.meta.url),'utf8');
 assert.doesNotMatch(api,/image\/gif/);
});

test('small JPEG and PNG are converted to WebP even when already within upload size',async()=>{
 const previousBitmap=globalThis.createImageBitmap,previousDoc=globalThis.document;
 try{
   globalThis.createImageBitmap=async()=>({width:500,height:400,close(){}});
   globalThis.document={createElement:()=>({
     getContext(){return {clearRect(){},drawImage(){}};},
     toBlob(callback,type){callback(new Blob([new Uint8Array(800)],{type}));}
   })};
   for(const format of ['image/jpeg','image/png']){
     const original=new File([new Uint8Array(300)],'small.'+(format==='image/jpeg'?'jpg':'png'),{type:format});
     const actual=await prepareImageForUpload(original);
     assert.equal(actual.type,'image/webp');
     assert.match(actual.name,/\.webp$/);
   }
 }finally{globalThis.createImageBitmap=previousBitmap;globalThis.document=previousDoc;}
});
