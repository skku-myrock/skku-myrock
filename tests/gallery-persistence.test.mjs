import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateGalleryAlbum,galleryFromDoc} from '../functions/_lib/gallery.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
const base='https://myrock-images.pages.dev/';
const url=base+'gallery/'+id+'.webp';
const valid={category:'공연',title:'정기 공연',photos:[url]};

test('album validation permits only correct WebP gallery image URLs',()=>{
  assert.deepEqual(validateGalleryAlbum(valid,base),valid);
  assert.equal(validateGalleryAlbum({...valid,title:'  무대  '},base).title,'무대');
  const invalid=[
    {...valid,category:'전체'}, {...valid,title:' '}, {...valid,title:'a'.repeat(151)},
    {...valid,photos:[]}, {...valid,photos:Array.from({length:51},()=>url)},
    {...valid,photos:[url,url]}, {...valid,photos:[base+'site/'+id+'.webp']},
    {...valid,photos:[base+'notices/'+id+'.webp']},
    {...valid,photos:[base+'gallery/'+id+'.jpg']},
    {...valid,photos:['https://other.example/gallery/'+id+'.webp']},
    {...valid,photos:[url+'?q=x']},
  ];
  for(const row of invalid)assert.throws(()=>validateGalleryAlbum(row,base));
});

test('Firestore albums deserialize into the public gallery data model',()=>{
  const doc={name:'projects/sample/databases/(default)/documents/galleryAlbums/'+id,
    fields:{category:{stringValue:'공연'},title:{stringValue:'정기 공연'},
    createdAt:{stringValue:'2026-10-16T00:00:00Z'},photos:{arrayValue:{values:[{stringValue:url}]}}}};
  assert.deepEqual(galleryFromDoc(doc),{id,category:'공연',title:'정기 공연',photos:[url],createdAt:'2026-10-16T00:00:00Z'});
});

test('gallery API enforces current operator authorization and protects non-gallery assets',async()=>{
  const [index,purge,image,client,resetClient,github]=await Promise.all([
    read('functions/api/gallery/albums.js'),read('functions/api/gallery/purge.js'),
    read('functions/api/images/batch.js'),read('src/galleryApi.ts'),
    read('src/App.tsx'),read('functions/_lib/githubImages.js')
  ]);
  assert.match(index,/assertAccess\(request,env,'part_leader'\)/);
  assert.match(purge,/assertAccess\(request,env,'president'\)/);
  assert.match(purge,/if\(!caller\.superadmin\)reject/);
  assert.match(purge,/input\?\.confirmation!==RESET_GALLERY_CONFIRMATION/);
  assert.match(purge,/deleteGalleryPage\(env,BATCH_SIZE\)/);
  assert.match(purge,/clearImageFolder\(env,'gallery'\)/);
  assert.match(purge,/BATCH_SIZE=20/);
  assert.match(image,/folder!=='site'&&folder!=='notices'&&folder!=='gallery'/);
  assert.match(image,/const extensions=\{'image\/webp':'webp'\}/);
  assert.match(github,/new Set\(\['site','notices','gallery'\]\)/);
  assert.match(client,/fetch\('\/api\/gallery\/albums'/);
  assert.ok(resetClient.indexOf('>에셋 초기화</button>')<resetClient.indexOf('>갤러리 초기화</button>'));
  assert.ok(resetClient.indexOf('>에셋 초기화<Trash2')<resetClient.indexOf('>갤러리 초기화<Trash2'));
});

test('gallery upload and display use actual data rather than fixtures',async()=>{
  const [gallery,dialog,model,css,app]=await Promise.all([
    read('src/PhotoGallery.tsx'),read('src/GalleryUploadDialog.tsx'),
    read('src/galleryData.ts'),read('src/styles/management.css'),read('src/App.tsx')]);
  assert.doesNotMatch(model,/fiveEmptyPhotos|2026-01-15-white-noise|photoAlbums/);
  assert.match(gallery,/listGalleryAlbums\(\)/);
  assert.match(dialog,/uploadImagesBatch\(newPhotos\.map\(photo=>photo\.file!\),'gallery'\)/);
  assert.match(dialog,/publishGalleryAlbum\(category,title\.trim\(\),urls\)/);
  assert.match(css,/\.home-hero-image,\.about-intro>\.about-hero-image\{object-fit:cover\}/);
  assert.match(app,/변경 사항을 저장했습니다\. 이미지 업로드까지 시간이 걸릴 수 있습니다\./);
});
