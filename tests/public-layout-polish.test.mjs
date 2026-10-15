import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('page action bars share 22px offset from the page heading divider',async()=>{
  const [about,gallery]=await Promise.all([read('src/styles/management.css'),read('src/styles/gallery.css')]);
  assert.match(about,/\.about-admin-tools\{[^}]*margin-top:22px;min-height:40px\}/);
  assert.match(gallery,/\.gallery-section\.section-block\s*\{\s*margin-top:\s*22px;\s*\}/);
  assert.match(about,/\.about-admin-tools \+ \.about-intro\.section-block\{margin-top:20px\}/);
  assert.match(about,/\.about-admin-tools\{margin-top:18px\}/);
  assert.match(gallery,/@media\(max-width:620px\)\{\.gallery-section\.section-block\{margin-top:18px\}\}/);
});

test('portraits center photo placeholder label and preserve frame sizes',async()=>{
  const [management,base,pages]=await Promise.all([read('src/styles/management.css'),read('src/styles/base.css'),read('src/pages/SitePages.tsx')]);
  assert.match(management,/\.leader-item \.leader-photo\.placeholder\{display:flex;flex-direction:column;align-items:center;justify-content:center\}/);
  assert.match(base,/\.leader-item \.leader-photo \.placeholder-symbol \{ display: none; \}/);
  assert.match(pages,/<Placeholder label="사진" className="leader-photo" \/>/);
  assert.match(management,/\.leader-item \.leader-photo\{display:block;width:76px;min-width:76px;height:101px;min-height:101px/);
});

test('main and about image shadows become slightly deeper without changing cover behavior',async()=>{
  const management=await read('src/styles/management.css');
  assert.match(management,/\.home-hero-image,\.about-hero-image\{box-shadow:0 12px 30px rgba\(31,53,47,\.18\),0 3px 8px rgba\(31,53,47,\.09\)\}/);
  assert.match(management,/\.home-hero-image,\.about-intro>\.about-hero-image\{object-fit:cover\}/);
});
