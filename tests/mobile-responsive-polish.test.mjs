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

test('mobile gallery keeps ten equal-width page numbers with smaller navigation controls',async()=>{
 const [css,ui]=await Promise.all([source('src/styles/gallery.css'),source('src/PhotoGallery.tsx')]);
 assert.match(css,/\.gallery-pagebar\{gap:2px;flex-wrap:nowrap;/);
 assert.match(css,/\.gallery-pagebar>button\{\s*box-sizing:border-box;\s*flex:0 0 24px;\s*width:24px;\s*min-width:24px;/);
 assert.match(css,/\.gallery-pagebar>button:is\(:first-child,:nth-child\(2\),:nth-last-child\(2\),:last-child\)/);
 assert.match(css,/@media\(max-width:359px\)/);
 assert.match(css,/\.gallery-pagebar>button\[data-digits="3"\]/);
 assert.match(ui,/const PAGE_GROUP_SIZE=10;/);
 assert.match(ui,/data-digits=\{String\(page\)\.length\}/);
 assert.ok(10*20+4*19<=320-36);
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

test('only stacked centered officer names adopt copyright typography',async()=>{
 const css=await source('src/styles/finance.css');
 const narrow=css.slice(css.lastIndexOf('@media(max-width:469px)'));
 assert.match(narrow,/\.footer-contact-people span\{\s*color:#a0aaa6;\s*font-size:10px;\s*font-weight:400;\s*line-height:normal;/);
 const officerRule=narrow.slice(narrow.indexOf('.footer-contact-people span{'));
 assert.doesNotMatch(officerRule,/\.footer-bug-report\{[^}]*font-size:10px/);
 assert.match(css,/@media\(min-width:470px\) and \(max-width:620px\)/);
});

test('notice author column truncates overlong names to an ellipsis',async()=>{
 const [css,ui]=await Promise.all([source('src/styles/notice-editor.css'),source('src/pages/SitePages.tsx')]);
 assert.match(css,/\.notice-table-row>\.notice-author-cell\{\s*display:block;\s*min-width:0;\s*max-width:100%;\s*overflow:hidden;\s*text-overflow:ellipsis;\s*white-space:nowrap/);
 assert.match(ui,/<span className="notice-author-cell">\{post.author\}<\/span>/);
});
