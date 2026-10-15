import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

async function audit(directory){
  const root=new URL('../'+directory+'/',import.meta.url);
  const entries=await readdir(root,{withFileTypes:true});
  let hits=[];
  for(const entry of entries){
    const path=directory+'/'+entry.name;
    if(entry.isDirectory())hits.push(...await audit(path));
    else if(/\.(?:js|ts|tsx)$/.test(entry.name)){
      const content=await readFile(new URL('../'+path,import.meta.url),'utf8');
      const normalized=content.replaceAll('MYROCK_IMAGES_PUBLIC_BASE_URL','IMAGES_PUBLIC_BASE_URL');
      const forbidden=/\bR2\b|\bMYROCK_IMAGES\b|\.MYROCK_IMAGES\b|\.put\(key,data,\{httpMetadata/;
      if(forbidden.test(normalized))hits.push(path);
    }
  }
  return hits;
}
test('client and server code contain no R2 bucket bindings or object operations',async()=>{
 assert.deepEqual([...await audit('src'),...await audit('functions')],[]);
});
test('public image URLs are GitHub Pages hosted and Firebase remains the data persistence layer',async()=>{
 const source=await readFile(new URL('../functions/api/images/batch.js',import.meta.url),'utf8');
 const about=await readFile(new URL('../functions/api/about/image.js',import.meta.url),'utf8');
 assert.match(source,/myrock-images/);
 assert.match(source,/GITHUB_IMAGES_TOKEN/);
 assert.doesNotMatch(about,/onRequestGet/);
 assert.match(about,/onRequestPost/);
});
