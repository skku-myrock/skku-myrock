import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('album edit uses optimistic Firestore preconditions and a scoped field mask',async()=>{
  const source=await read('functions/_lib/gallery.js');
  assert.match(source,/validateUpdateTime\(input\?\.expectedUpdateTime\)/);
  assert.match(source,/currentDocument\.updateTime/);
  assert.match(source,/updateMask\.fieldPaths/);
  assert.match(source,/for\(const field of \['category','title','photos'\]\)/);
  assert.match(source,/response\.status===409\|\|response\.status===412/);
  assert.match(source,/export async function deleteGalleryAlbum/);
  assert.match(source,/method:'DELETE'/);
  assert.match(source,/return galleryFromDoc\(response\.data\)/);
});

test('edit and delete gallery requests authorize part leaders on server before mutating',async()=>{
  const route=await read('functions/api/gallery/[id].js');
  const head=await read('functions/_lib/gallery.js');
  assert.match(route,/export async function onRequestPatch/);
  assert.match(route,/export async function onRequestDelete/);
  assert.equal((route.match(/assertAccess\(request,env,'part_leader'\)/g)||[]).length,2);
  assert.equal((route.match(/secureOrigin\(request\)/g)||[]).length,2);
  assert.match(route,/await updateGalleryAlbum\(env,params\.id,input\)/);
  assert.match(route,/await deleteGalleryAlbum\(env,params\.id,input\?\.expectedUpdateTime\)/);
  assert.match(route,/deleteUnusedGalleryImages\(env,obsolete\)/);
  assert.match(route,/deleteUnusedGalleryImages\(env,prior\.photos\)/);
  assert.match(head,/validateAlbumId\(id\)/);
  assert.match(head,/currentDocument\.updateTime/);
});

test('obsolete gallery photos cleanup restricts origin and gallery UUID paths and rechecks references',async()=>{
  const code=await read('functions/_lib/githubImages.js');
  assert.match(code,/export async function deleteUnusedGalleryImages/);
  assert.match(code,/url\.origin===base\.origin/);
  assert.match(code,/gallery\\\/\[/);
  assert.match(code,/const albums=await listGalleryAlbums\(env\)/);
  assert.match(code,/const about=await getAbout\(env\)/);
  assert.match(code,/const notices=await listNotices\(env\)/);
  assert.match(code,/for\(const \[path,url\] of candidates\)if\(refs\.has\(url\)\)candidates\.delete\(path\)/);
  assert.match(code,/if\(existing\.truncated\)throw/);
  assert.match(code,/names\.has\(path\)/);
  assert.match(code,/force:false/);
});

test('gallery lightbox management controls respect role and expose editor and deletion',async()=>{
  const [viewer,editor,client,css]=await Promise.all([
    read('src/PhotoGallery.tsx'),read('src/GalleryUploadDialog.tsx'),
    read('src/galleryApi.ts'),read('src/styles/gallery.css')
  ]);
  assert.match(viewer,/\{canRegister&&<div className="gallery-manage-wrapper"/);
  assert.match(viewer,/aria-haspopup="true"/);
  assert.match(viewer,/수정하기/);
  assert.match(viewer,/삭제하기/);
  assert.match(viewer,/window\.confirm/);
  assert.match(viewer,/<GalleryUploadDialog initialAlbum=\{editingAlbum\}/);
  assert.match(viewer,/editingRef\.current/);
  assert.match(editor,/event\.stopPropagation\(\)/);
  assert.match(editor,/initialAlbum\?\.photos\.map/);
  assert.match(editor,/photo\.file\?uploaded\[next\+\+\]:photo\.url/);
  assert.match(editor,/await updateGalleryAlbum\(initialAlbum,category,title\.trim\(\),urls\)/);
  assert.match(client,/method:'PATCH'/);
  assert.match(client,/method:'DELETE'/);
  assert.match(client,/expectedUpdateTime:album\.updateTime/);
  assert.match(css,/\.gallery-toolbar \.admin-only-action\{align-self:flex-start\}/);
  assert.match(css,/\.gallery-manage-menu/);
});
