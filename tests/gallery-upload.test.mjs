import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('only authenticated part leaders and higher see the gallery registration action',async()=>{
  const [app,pages,gallery]=await Promise.all([src('src/App.tsx'),src('src/pages/SitePages.tsx'),src('src/PhotoGallery.tsx')]);
  assert.match(app,/'gallery': <Gallery canRegister=\{Boolean\(user && !authPending && currentLevel\)\}\/>/);
  assert.match(pages,/<PhotoGallery canRegister=\{canRegister\} \/>/);
  assert.match(gallery,/\{canRegister && <button type="button" className="admin-only-action"/);
  assert.match(gallery,/\{canRegister && uploadOpen && <GalleryUploadDialog/);
  assert.doesNotMatch(gallery,/onRegister/);
});

test('upload modal supports files, drag-and-drop, previews, photo reordering, deletion and cleanup',async()=>{
  const dialog=await src('src/GalleryUploadDialog.tsx');
  for(const token of ['role="dialog" aria-modal="true"','gallery-upload-dropzone','onDragEnter={onAreaDragEnter}','onDrop={onAreaDrop}','type="file" multiple','function movePhoto','function dropPhoto','function removePhoto','draggable onDragStart','첫 번째 사진이 앨범 대표사진으로 사용됩니다'])assert.ok(dialog.includes(token),token);
  assert.match(dialog,/categoryOptions: PhotoCategory\[\] = \['공연', '행사', '일상'\]/);
  assert.match(dialog,/URL\.revokeObjectURL\(url\)/);
  assert.match(dialog,/onClick=\{\(\) => movePhoto\(photo\.id, -1\)\}/);
  assert.match(dialog,/onClick=\{\(\) => removePhoto\(photo\.id\)\}/);
});

test('reuses introduction image warning and JPG PNG WebP source validation, then persists WebP photos',async()=>{
  const [dialog,about,styles,compress]=await Promise.all([src('src/GalleryUploadDialog.tsx'),src('src/AboutManagement.tsx'),src('src/styles/management.css'),src('src/imageCompression.ts')]);
  assert.match(dialog,/import \{validateSourceImage\} from '\.\/imageCompression'/);
  assert.match(dialog,/validateSourceImage\(file\)/);
  assert.match(dialog,/image-compression-notice" role="note"/);
  const warning='업로드된 이미지는 원본을 대체하지 못하므로 원본 사진을 별도로 보관해 주세요.';
  assert.ok(dialog.includes(warning));
  assert.ok(about.includes(warning));
  assert.match(styles,/\.image-compression-notice\{/);
  assert.match(compress,/MAX_SOURCE_IMAGE_BYTES = 30_000_000/);
  assert.doesNotMatch(dialog,/image\/gif/);
  assert.match(dialog,/await uploadImagesBatch\(photos\.map\(photo=>photo\.file\),'gallery'\)/);
  assert.match(dialog,/await publishGalleryAlbum\(category,title\.trim\(\),urls\)/);
  assert.match(dialog,/disabled=\{busy\|\|!title\.trim\(\)\|\|photos\.length===0\}/);
  assert.match(dialog,/busyRef\.current/);
});
