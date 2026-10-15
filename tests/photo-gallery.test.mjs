import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import typescript from 'typescript';

const source = await readFile(new URL('../src/galleryData.ts', import.meta.url), 'utf8');
const transpiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.ESNext,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;
const { photoAlbums } = await import('data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64'));
const component = await readFile(new URL('../src/PhotoGallery.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('all requested concerts, events and daily activity albums appear in order', () => {
  assert.deepEqual(photoAlbums.map(album => [album.category, album.title]), [
    ['공연', '2026. 01. 15. 모여락 x 아이코닉 연합공연 "White Noise"'],
    ['공연', '2026. 02. 08. 모여락 x 아망 연합공연'],
    ['공연', '2026. 05. 16. 모여락 2026 1학기 정기공연'],
    ['공연', '2026. 07. 18. 2026 모여락 여름 공연'],
    ['공연', '2026. 08. 22. 소리사랑 x 모여락 여름 연합공연 "Youth on Tape"'],
    ['공연', '2026. 08. 29. 신록 x 아망 x 모여락 연합공연'],
    ['행사', '2026년도 자/생/스 새내기 새로배움터'],
    ['행사', '2026년도 1학기 모여락 MT'],
    ['일상', '2026년도 1학기 정기공연 구성팀 합주 피드백 모습'],
    ['일상', '2026. 10. 10. 기타 클래스'],
  ]);
});
test('albums have stable mixed five-to-seven empty photo slots and unique keys', () => {
  assert.equal(new Set(photoAlbums.map(album => album.id)).size, 10);
  assert.deepEqual(photoAlbums.map(album => album.photos.length), [5, 6, 7, 5, 7, 6, 5, 7, 6, 5]);
  assert.deepEqual(new Set(photoAlbums.map(album => album.photos.length)), new Set([5, 6, 7]));
  assert.ok(photoAlbums.every(album => album.photos.every(src => src === null)));
  assert.deepEqual(['공연','행사','일상'].map(category => photoAlbums.filter(album => album.category === category).length), [6,2,2]);
});
test('gallery cover opens full view with thumbnail selection, carousel navigation and dots', () => {
  assert.match(component, /aria-label=\{album\.title \+ ', 사진 ' \+ album\.photos\.length \+ '장 전체보기'\}/);
  assert.match(component, /onClick=\{event => openAlbum\(album, event\)\}/);
  assert.match(component, /onClick=\{\(\) => goTo\(-1\)\}/);
  assert.match(component, /onClick=\{\(\) => goTo\(1\)\}/);
  assert.match(component, /onClick=\{\(\) => setPhotoIndex\(index\)\}/);
  assert.match(component, /gallery-photo-dots/);
  assert.match(component, /gallery-thumb-list/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /event\.key === 'ArrowRight'/);
  assert.match(component, /onTouchEnd=\{onTouchEnd\}/);
  assert.match(component, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(component, /gallery-album-action[^>]*>[^\n]*전체보기/);
  assert.doesNotMatch(app.match(/function Gallery\([\s\S]*?function Equipment/)?.[0] ?? '', /\.photo-item|미리보기/);
});
test('long album titles stay on one line with ellipsis and aligned action text', () => {
  assert.match(styles, /\.gallery-album-details\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/s);
  assert.match(styles, /\.gallery-album-details strong\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s);
  assert.match(styles, /\.gallery-album-grid\s*\{[^}]*align-items:\s*start;/s);
  assert.match(component, /<strong title=\{album\.title\}>\{album\.title\}<\/strong>/);
  assert.doesNotMatch(styles, /\.gallery-album-details\s*\{\s*flex-direction:\s*column;/);
});
test('lightbox keeps image stage stable and clips overflowing thumbnails to an invisible-scrollbar rail', () => {
  assert.match(styles, /\.gallery-lightbox-layout\s*\{[^}]*height:\s*clamp\(250px,\s*calc\(100dvh - 185px\),\s*620px\);/s);
  assert.match(styles, /\.gallery-photo-stage\s*\{[^}]*flex:\s*1 1 auto;[^}]*height:\s*0;[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.gallery-thumb-panel\s*\{[^}]*max-height:\s*100%;[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.gallery-thumb-list\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;[^}]*scrollbar-width:\s*none;/s);
  assert.match(styles, /\.gallery-thumb-list::-webkit-scrollbar\s*\{\s*display:\s*none;/);
  assert.match(styles, /@media \(max-width:\s*680px\)[\s\S]*?\.gallery-photo-stage\s*\{[^}]*height:\s*clamp\(190px,\s*43dvh,\s*420px\);/);
  assert.doesNotMatch(component, /gallery-viewer-hint|좌우 화살표 또는 사진을 밀어서/);
});
test('album placeholders and lightbox have separate styles from the old broken photo items', () => {
  assert.match(styles, /\.gallery-slot-empty\s*\{[\s\S]*?align-items:\s*center;/);
  assert.match(styles, /\.gallery-lightbox-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*150px;/);
  assert.match(styles, /\.gallery-lightbox-backdrop\s*\{/);
  assert.match(styles, /\.gallery-photo-dot\.active/);
  assert.match(styles, /\.gallery-thumb-button\.selected/);
  assert.match(styles, /@media \(max-width:\s*680px\)/);
});
