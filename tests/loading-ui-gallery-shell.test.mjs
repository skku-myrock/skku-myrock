import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('style A uses muted gallery color while style B remains unchanged',async()=>{
 const [gallery,style,base]=await Promise.all([read('src/styles/gallery.css'),read('src/styles/loading-ui.css'),read('src/styles/base.css')]);
 assert.match(gallery,/\.gallery-empty-state\{min-height:150px;padding:52px 15px;text-align:center;color:#9da7a4;font-size:13px/);
 assert.match(style,/\.loading-text\{min-height:150px;padding:52px 15px;margin:0;text-align:center;color:#9da7a4;font-size:13px/);
 assert.match(base,/\.empty-state p\{font-size:12px;color:#9da7a4/);
});
test('shimmer respects loading and error state without any spinner',async()=>{
 const [image,style,home,about]=await Promise.all([read('src/ImageShimmer.tsx'),read('src/styles/loading-ui.css'),read('src/pages/SitePages.tsx'),read('src/AboutManagement.tsx')]);
 assert.match(style,/@keyframes shimmer/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(image,/onLoad=\{\(\)=>setState\('ready'\)\}/);
 assert.match(image,/onError=\{\(\)=>setState\('error'\)\}/);
 assert.match(home,/ImageShimmer key=\{homeImage\}/);
 assert.match(home,/ImageShimmer key=\{content\.heroImage\}/);
 assert.match(home,/ImageShimmer key=\{officer\.photoUrl\}/);
 assert.match(about,/ImageShimmer key=\{content\.homeImage\}/);
 assert.match(about,/ImageShimmer key=\{content\.heroImage\}/);
 assert.doesNotMatch(style,/@keyframes spin|\.spinner/);
});
test('gallery pages read 12 newest albums per page and use true count',async()=>{
 const [gallery,api,server,db]=await Promise.all([read('src/PhotoGallery.tsx'),read('src/galleryApi.ts'),read('functions/api/gallery/albums.js'),read('functions/_lib/gallery.js')]);
 assert.match(api,/export async function getGalleryPage\(page:number/);
 assert.match(api,/page:String\(page\),category/);
 assert.match(server,/readGalleryPage\(env,/);
 assert.match(db,/export async function readGalleryPage\(env,/);
 assert.match(db,/runAggregationQuery/);
 assert.match(db,/fieldPath:'createdAt'/);
 assert.match(db,/offset:\(effectivePage-1\)\*pageSize,limit:pageSize/);
 assert.match(gallery,/const PAGE_SIZE=12;/);
 assert.match(gallery,/setTotalPages\(result.totalPages\)/);
 assert.match(gallery,/const PAGE_GROUP_SIZE=10;/);
 assert.match(gallery,/gallery-pagebar/);
 assert.doesNotMatch(gallery,/DEMO_PAGE_COUNT|페이지 이동은 UI 미리보기입니다/);
});
test('handover editor awaits all notes, A-type statuses cover key lists and busy buttons show wait cursor',async()=>{
 const [handover,notice,members,schedule,donations,expenses,css]=await Promise.all([
  read('src/HandoverNotes.tsx'),read('src/pages/SitePages.tsx'),read('src/MemberManager.tsx'),
  read('src/ScheduleRoom.tsx'),read('src/DonationManagement.tsx'),read('src/ExpenseManagement.tsx'),read('src/styles/loading-ui.css'),
 ]);
 assert.match(handover,/Promise\.all\(\[\.\.\.result\.positions\.map/);
 assert.match(handover,/작성 권한을 확인하는 중입니다/);
 assert.match(handover,/인수인계 목록을 불러오는 중입니다\./);
 assert.match(notice,/최근 공지를 불러오는 중입니다/);
 assert.match(notice,/공지사항 목록을 불러오는 중입니다/);
 assert.match(notice,/장비 목록을 불러오는 중입니다\./);
 assert.match(members,/부원 명단을 불러오는 중입니다\./);
 assert.match(schedule,/시간표를 불러오는 중입니다/);
 assert.match(donations,/익명자 명단을 불러오는 중입니다/);
 assert.match(expenses,/거래 내역을 불러오는 중입니다\./);
 assert.match(css,/cursor:wait!important/);
});
