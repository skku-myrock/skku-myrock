import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('mobile officer portraits use a 72 by 96 portrait frame within the same grid track',async()=>{
 const [css,about,loading]=await Promise.all([
  source('src/styles/management.css'),source('src/pages/SitePages.tsx'),source('src/styles/loading-ui.css')
 ]);
 assert.match(css,/\.leadership-grid \.leader-item\{\s*display:grid;\s*grid-template-columns:72px minmax\(0,1fr\)/);
 assert.match(css,/\.leadership-grid \.leader-item>\.leader-photo\{[\s\S]*?width:72px;[\s\S]*?height:96px;[\s\S]*?aspect-ratio:3\/4/);
 assert.match(css,/\.leadership-grid \.leader-item>\.leader-description\{\s*min-width:0;\s*max-width:100%/);
 assert.match(about,/className="leader-description"/);
 assert.match(loading,/\.leader-item>\.image-shimmer-frame\{object-fit:cover\}/);
});

test('account dropdown is constrained to right edge on mobile',async()=>{
 const [css,app]=await Promise.all([source('src/styles/management.css'),source('src/App.tsx')]);
 assert.match(css,/@media\(max-width:820px\)\{\s*\.header-actions \.account-wrapper>\.account-menu\{\s*left:auto;\s*right:0/);
 assert.match(css,/max-width:calc\(100vw - 36px\)/);
 assert.match(app,/className="more-menu account-menu"/);
});

test('gallery page bar fits 14 controls at 320px and one/two digits have equal width',async()=>{
 const [css,ui]=await Promise.all([source('src/styles/gallery.css'),source('src/PhotoGallery.tsx')]);
 assert.match(css,/\.gallery-pagebar\{gap:2px;flex-wrap:nowrap;/);
 assert.match(css,/\.gallery-pagebar>button\{\s*flex:0 0 18px;\s*width:18px;\s*min-width:18px;/);
 assert.match(css,/\.gallery-pagebar>button\[data-digits="3"\]/);
 assert.match(ui,/data-digits=\{String\(page\)\.length\}/);
 // 10 numbered pages + 4 page-navigation controls, each 18px wide;
 // 13 gaps of 2px = 278px, within a 320px phone's 284px container.
 assert.ok(14*18+13*2<=320-36);
});

test('mobile footer stays two-column while practical, then centers both rows',async()=>{
 const [css,app]=await Promise.all([source('src/styles/finance.css'),source('src/App.tsx')]);
 assert.match(css,/@media\(min-width:470px\) and \(max-width:620px\)/);
 assert.match(css,/\.site-footer \.footer-lower\{\s*grid-template-columns:minmax\(0,1fr\) max-content/);
 assert.match(css,/\.site-footer \.footer-contact-section\{\s*grid-column:2;grid-row:1/);
 assert.match(css,/@media\(max-width:469px\)/);
 assert.match(css,/\.site-footer \.footer-bottom\{\s*grid-column:1;grid-row:1;\s*justify-content:center;\s*align-items:center;\s*text-align:center/);
 assert.match(css,/\.site-footer \.footer-contact-section\{\s*grid-column:1;grid-row:2;\s*justify-self:center;\s*align-items:center;\s*text-align:center/);
 assert.match(app,/className="footer-contact-people"/);
});

test('notice author column truncates overlong names to an ellipsis',async()=>{
 const [css,ui]=await Promise.all([source('src/styles/notice-editor.css'),source('src/pages/SitePages.tsx')]);
 assert.match(css,/\.notice-table-row>\.notice-author-cell\{\s*display:block;\s*min-width:0;\s*max-width:100%;\s*overflow:hidden;\s*text-overflow:ellipsis;\s*white-space:nowrap/);
 assert.match(ui,/<span className="notice-author-cell">\{post.author\}<\/span>/);
});
