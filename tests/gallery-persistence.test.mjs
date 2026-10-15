import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateGalleryAlbum} from '../functions/_lib/gallery.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const uuid='11111111-1111-4111-8111-111111111111';
const base='https://myrock-images.pages.dev/';
const photo=base+'gallery/'+uuid+'.webp';
const valid={category:'공연',title:'정기 공연',photos:[photo]};

test('gallery metadata accepts only valid albums with images hosted under gallery/ as WebP',()=>{
  assert.deepEqual(validateGalleryAlbum(valid,base),valid);
  assert.deepEqual(validateGalleryAlbum({...valid,title:'  공연  '},base).title,'공연');
  for(const input of [
    {...valid,category:'전체'}, {...valid,title:' '}, {...valid,title:'a'.repeat(151)},
    {...valid,photos:[]}, {...valid,photos:Array.from({length:51},()=>photo)},
    {...valid,photos:[photo,photo]}, {...valid,photos:[base+'site/'+uuid+'.webp']},
    {...valid,photos:[base+'notices/'+uuid+'.webp']},
    {...valid,photos:[base+'gallery/'+uuid+'.jpg']},
    {...valid,photos:['https://other.example/gallery/'+uuid+'.webp']},
    {...valid,photos:[photo+'?token=x']},
    {...valid,photos:['javascript:alert(1)']},
  ])assert.throws(()=>validateGalleryAlbum(input,base),undefined,JSON.stringify(input).slice(0,130));
});

test('gallery storage page deletion is incremental and checks Firestore updateTime',async()=>{
  let code=await read('functions/_lib/gallery.js');
  code=code.replace("import {FIRESTORE_ROOT,docFields,toFields,reject} from './shared.js';",