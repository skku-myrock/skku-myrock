import {readStyles} from './readStyles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [model,component,api,backend,styles]=await Promise.all([
 source('src/galleryData.ts'),source('src/PhotoGallery.tsx'),source('src/galleryApi.ts'),
 source('functions/_lib/gallery.js'),readStyles()
]);
test('temporary static gallery albums are removed and gallery is fetched from Firestore',()=>{
  assert.doesNotMatch(model,/2026-01-15-white-noise|fiveEmptyPhotos|photoAlbums/);
  assert.match(model,/PhotoCategory/);
  assert.match(model,/photos:readonly string\[\]/);
  assert.match(component,/getGalleryPage\(previewPage,filter\)/);
  assert.match(component,/setAlbums\(result.albums\)/);
  assert.match(component,/아직 등록된 갤러리 앨범이 없습니다/);
  assert.match(api,/export async function getGalleryPage\(page:number/);
  assert.match(backend,/FIRESTORE_ROOT\+'\/galleryAlbums'/);
});
test('gallery lightbox retains accessible navigation and responsive thumbnails',()=>{
  assert.match(component,/onClick=\{event => openAlbum\(album, event\)\}/);
  assert.match(component,/onClick=\{\(\) => goTo\(-1\)\}/);
  assert.match(component,/onClick=\{\(\) => goTo\(1\)\}/);
  assert.match(component,/onClick=\{\(\) => setPhotoIndex\(index\)\}/);
  assert.match(component,/gallery-photo-dots/);
  assert.match(component,/gallery-thumb-list/);
  assert.match(component,/aria-modal="true"/);
  assert.match(component,/event\.key === 'Escape'/);
  assert.match(component,/event\.key === 'ArrowRight'/);
  assert.match(component,/onTouchEnd=\{onTouchEnd\}/);
  assert.match(component,/document\.body\.style\.overflow = 'hidden'/);
  assert.match(component,/gallery-album-action[^>]*>[^\n]*전체보기/);
});
test('gallery cards preserve title ellipsis and constrained large-photo viewer',()=>{
  assert.match(styles,/\.gallery-album-details\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/s);
  assert.match(styles,/\.gallery-album-details strong\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s);
  assert.match(styles,/\.gallery-lightbox-layout\s*\{[^}]*height:\s*clamp\(250px,\s*calc\(100dvh - 185px\),\s*620px\);/s);
  assert.match(styles,/\.gallery-photo-stage\s*\{[^}]*flex:\s*1 1 auto;[^}]*height:\s*0;[^}]*min-height:\s*0;/s);
  assert.match(styles,/\.gallery-thumb-panel\s*\{[^}]*max-height:\s*100%;[^}]*overflow:\s*hidden;/s);
  assert.match(styles,/\.gallery-thumb-list\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;[^}]*scrollbar-width:\s*none;/s);
  assert.match(styles,/\.gallery-thumb-list::-webkit-scrollbar\s*\{\s*display:\s*none;/);
  assert.match(styles,/@media \(max-width:\s*680px\)[\s\S]*?\.gallery-photo-stage\s*\{[^}]*height:\s*clamp\(190px,\s*43dvh,\s*420px\);/);
});
test('photo slot, grid, image counts and preloading remain wired',()=>{
  assert.match(component,/className="gallery-album-cover"/);
  assert.match(component,/album\.photos\.length/);
  assert.match(component,/PhotoSlot kind="thumb"/);
  assert.match(component,/aria-label=\{album\.title \+ ', 사진 ' \+ album\.photos\.length \+ '장 전체보기'\}/);
  assert.match(component,/photoIndex\+offset\+count/);
  assert.match(styles,/\.gallery-album-grid\s*\{[^}]*align-items:\s*start;/s);
  assert.match(styles,/\.gallery-lightbox-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*150px;/s);
  assert.match(styles,/\.gallery-photo-dot\.active/);
});
