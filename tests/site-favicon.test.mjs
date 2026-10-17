import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('browser favicon uses the same bundled transparent logo as the site header',async()=>{
 const [html,app,logo]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../src/App.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/logo-transparent.png',import.meta.url)),
 ]);
 assert.match(html,/<link rel="icon" type="image\/png" href="\/src\/logo-transparent\.png"\s*\/>/);
 assert.equal((html.match(/rel="icon"/g)||[]).length,1);
 assert.match(app,/import logo from '\.\/logo-transparent\.png'/);
 assert.deepEqual([...logo.subarray(0,8)],[137,80,78,71,13,10,26,10]);
});
