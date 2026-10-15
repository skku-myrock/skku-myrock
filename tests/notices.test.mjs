import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import typescript from 'typescript';

const dataSource = await readFile(new URL('../src/noticesData.ts', import.meta.url), 'utf8');
const built = typescript.transpileModule(dataSource, {
  compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
}).outputText;
const { notices, findNotice } = await import('data:text/javascript;base64,' + Buffer.from(built).toString('base64'));
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('all four user-supplied notices have exact titles, date, category, and descending publication order', () => {
  assert.deepEqual(notices.map(({ title, category, publishedAt }) => [title, category, publishedAt]), [
    ['🎸중앙동아리 밴드 모여락 29.5기 신입부원 모집🎸', '공지', '2026-08-28'],
    ['2026학년도 2학기 29.5기 신입 보컬 모집 기한 및 오디션 방법 안내', '공지', '2026-08-21'],
    ['📢 2026 MYR 홈커밍데이 안내', '행사', '2026-08-18'],
    ['2026 모여락 여름 공연', '공연', '2026-07-11'],
  ]);
  assert.deepEqual(notices.map(post => post.date), [
    '2026. 08. 28.', '2026. 08. 21.', '2026. 08. 18.', '2026. 07. 11.',
  ]);
  assert.equal(new Set(notices.map(post => post.id)).size, 4);
  assert.ok(notices.every(post => findNotice(post.id) === post));
  assert.equal(findNotice('nonexistent-notice'), undefined);
});
test('each notice has a leading image placeholder, with no images downloaded yet', () => {
  assert.ok(notices.every(post => post.images.length >= 1));
  assert.ok(notices.every(post => post.images.every(src => src === null)));
  assert.match(app, /notice\.images\.map\(\(src, index\) =>/);
  assert.match(app, /<NoticeImageCarousel key=\{notice\.id\}/);
  assert.match(app, /notice-detail-images[\s\S]*?notice-detail-body/);
});
test('recruitment notice preserves schedule, classes, auditions, questions and contact info', () => {
  const post = notices[0];
  assert.ok(post.body.length > 2000, 'recruitment notice should retain full user-supplied text');
  for (const phrase of [
    '※ 모여락 29.5기 신입부원 모집※',
    '8/24(월)부터 9/17(목) 17시까지',
    '❗️클래스(레슨) ❗️',
    '❗️정기공연❗️',
    '❗️신입생 환영회 및 정기모임 ❗️',
    '❗️ MT ❗️',
    '*학사 일정에 따라 변동될 수 있습니다.*',
    '브로큰 발렌타인 - 알루미늄',
    '터치드 - 야경',
    '❓모여락 Q&A',
    '신입생 카톡방 개설 : 9/20 (일)',
    '보컬 테스트 톡방 개설 : 9/15 (화)',
    '@skku_m.y.rock',
    '010-6350-7007(Instagram:@florescence_328)',
  ]) assert.ok(post.body.includes(phrase), 'Missing recruitment section: ' + phrase);
});
test('vocal notice preserves audition times, song options, constraints and submission email', () => {
  const post = notices[1];
  for (const phrase of [
    '9/17(목) 17시 마감', '9/20(일), 9/21(월)',
    '학생회관 B1 ’화요뜨락‘',
    '🎼지정곡 안내', '브로큰발렌타인 - 알루미늄', '터치드 - 야경',
    '모든 테스트 과정은 녹화됩니다', '9/18(토) 23시 59분',
    '에코/리버브 등 효과는 전부 제거',
    'azure328@g.skku.edu', '010-6350-7007',
  ]) assert.ok(post.body.includes(phrase), 'Missing vocal notice section: ' + phrase);
});
test('homecoming notice preserves complete timetable and application deadlines', () => {
  const post = notices[2];
  for (const phrase of [
    'OB와 YB가 함께 공연', '2026년 9월 19일 토요일',
    '11:00~13:00 리허설', '13:00~14:00 점심 식사',
    '14:30~15:30 2026년도 활동 소개', '15:30~17:30 공연',
    '18:00~ 뒤풀이', '2026년 8월 15일 23시 59분까지',
    '08.15 (토) ~ 08.29 (토) 23시 59분까지',
    '학생회관 소강당 (예정)', '010-6350-7007',
  ]) assert.ok(post.body.includes(phrase), 'Missing homecoming notice section: ' + phrase);
});
test('summer concert notice preserves stage, ticket price and event date', () => {
  const post = notices[3];
  for (const phrase of [
    '무더운 여름 속', '밀려오는 리듬에', '7월 18일 17:00 – 20:00',
    '홍대 스윙홀', '서울 마포구 동교로 162-5 지하 1층',
    '사전예매: 2000원 / 현장예매: 4000원', '사전예매 | 프로필 링크',
  ]) assert.ok(post.body.includes(phrase), 'Missing concert notice section: ' + phrase);
});
test('home teaser, category list, search, direct detail routes and browser history stay in sync', () => {
  assert.match(app, /notices\.slice\(0,\s*3\)/);
  assert.match(app, /onClick=\{\(\) => openNotice\(post\.id\)\}/);
  assert.match(app, /const filtered = notices\.filter/);
  assert.match(app, /const noticeIdFromPath/);
  assert.match(app, /window\.location\.pathname\.match\(\/\^\\\/news/);
  assert.match(app, /window\.history\.pushState\(null, '', path\)/);
  assert.match(app, /setActiveNoticeId\(noticeIdFromPath\(\)\)/);
  assert.match(app, /page==='notice-detail'&&<NoticeDetail/);
  assert.match(app, /onClick=\{backToList\}/);
  assert.match(app, /notice\.body\.split\(\/\\n\\s\*\\n\/\)/);
  assert.doesNotMatch(app, /미리보기용 예시 공지입니다/);
});
test('article content is not fetched from a database and wraps original line breaks', () => {
  assert.doesNotMatch(dataSource, /firebase|firestore|fetch\(/i);
  assert.match(styles, /\.notice-detail-body p\s*\{[^}]*white-space:\s*pre-line;/s);
  assert.match(styles, /\.notice-detail-photo-placeholder\s*\{/);
  assert.match(styles, /@media \(max-width:\s*700px\)/);
});


test('only management roles see the writing action and direct compose routes enforce access', () => {
  assert.match(app, /function News\(\{ canWrite, onWrite, openNotice \}/);
  assert.match(app, /\{canWrite && <button type="button" className="button button-primary" onClick=\{onWrite\}>/);
  assert.match(app, /canWrite=\{Boolean\(user && !authPending && currentLevel\)\}/);
  assert.match(app, /page==='notice-compose'&&\(authPending \?/);
  assert.match(app, /user && currentLevel \? <NoticeComposer/);
  assert.match(app, /page === 'notice-compose' \? '\/news\/write'/);
  assert.match(app, /return match && match\[1\] !== 'write'/);
  assert.match(app, /return 'notice-compose'/);
  assert.doesNotMatch(app, /글쓰기는 추후 연결할 예정입니다/);
});
test('plain notice composer supports editable title, text blocks and inserted images without publishing', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  for (const token of ['공지사항 글쓰기', '제목', '본문', '이미지 추가', '본문 추가', '미리보기',
    'type="file"', 'accept="image/png,image/jpeg,image/webp,image/gif"', 'URL.createObjectURL',
    'URL.revokeObjectURL', 'moveBlock', 'removeBlock', '<textarea', '게시글은 저장되지 않습니다']) {
    assert.ok(composer.includes(token), 'Composer missing: ' + token);
  }
  assert.doesNotMatch(composer, /contentEditable|document\.execCommand|fontSize|fontWeight|setDoc\(|addDoc\(|updateDoc\(/);
  assert.match(styles, /\.notice-composer-blocks\s*\{/);
  assert.match(styles, /\.notice-composer-preview\s*\{/);
});


test('hardcoded notice authors are two each and only visible to permitted members', () => {
  assert.deepEqual(notices.map(post => post.author), ['나재원', '나재원', '김서연', '김서연']);
  assert.match(app, /canWrite && <span className="notice-author-cell">작성자<\/span>/);
  assert.match(app, /canWrite && <span className="notice-author-cell">\{post\.author\}<\/span>/);
  assert.match(app, /canViewAuthor && <span>작성자 \{notice\.author\}<\/span>/);
  assert.match(app, /canViewAuthor=\{Boolean\(user && !authPending && currentLevel\)\}/);
  assert.match(styles, /\.notice-table-head\.has-author,\.notice-table-row\.has-author\{grid-template-columns:90px minmax\(0,1fr\) 100px 90px\}/);
});
test('image editor accepts px dimensions, defaults to locked ratio and allows independent sizing when unlocked', async () => {
  const component = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/noticeImageSize.ts', import.meta.url), 'utf8');
  const js = typescript.transpileModule(source, {compilerOptions: {module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022}}).outputText;
  const { initialImageDimensions, resizeImageDimensions } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  assert.deepEqual(initialImageDimensions(1600, 800), {width: 800, height: 400});
  assert.deepEqual(initialImageDimensions(600, 1200), {width: 450, height: 900});
  assert.deepEqual(resizeImageDimensions({width: 800, height: 400}, 'width', 400, true), {width: 400, height: 200});
  assert.deepEqual(resizeImageDimensions({width: 800, height: 400}, 'height', 300, true), {width: 600, height: 300});
  assert.deepEqual(resizeImageDimensions({width: 800, height: 400}, 'width', 500, false), {width: 500, height: 400});
  assert.deepEqual(resizeImageDimensions({width: 800, height: 400}, 'height', 275, false), {width: 800, height: 275});
  assert.deepEqual(resizeImageDimensions({width: 800, height: 400}, 'width', 0, true), {width: 800, height: 400});
  for (const part of ['ratioLocked: true', 'ratioLocked: !block.ratioLocked', 'type="number"', 'value={block.width', 'value={block.height',
    'changeImageSize(block.id', 'role="group"', 'aria-pressed={block.ratioLocked}', '<Link size={19}', '<Link2Off size={19}', 'initialImageDimensions', 'aspectRatio:', 'onLoad={event => setNaturalSize']) {
    assert.ok(component.includes(part), 'Image sizing missing: ' + part);
  }
  assert.match(styles, /\.notice-composer-dimensions\s*\{/);
  assert.match(styles, /\.notice-composer-ratio-toggle\s*\{/);
  assert.match(styles, /\.notice-composer-image-stage>\.notice-composer-resized-image,\.notice-composer-preview-image>\.notice-composer-resized-image\{[^}]*max-height:none;/);
  assert.doesNotMatch(component, /uploadBytes|uploadString|addDoc|setDoc/);
});


test('editor and preview size selected images with the same viewport-responsive aspect ratio', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.equal(composer.split('width: block.width || 320').length - 1, 2);
  assert.equal(composer.split('aspectRatio: block.width && block.height ?').length - 1, 2);
  assert.equal(composer.split(": '4 / 3'").length - 1, 2);
  assert.equal(composer.split('className="notice-composer-resized-image"').length - 1, 2);
  assert.match(styles, /\.notice-composer-image-stage,\.notice-composer-preview-image\{[^}]*position:relative;[^}]*max-width:100%;[^}]*overflow:hidden/);
  assert.match(styles, /\.notice-composer-image-stage>\.notice-composer-resized-image,\.notice-composer-preview-image>\.notice-composer-resized-image\{[^}]*position:absolute;inset:0;[^}]*width:100%;height:100%;[^}]*max-height:none;[^}]*object-fit:fill/);
  assert.match(styles, /\.notice-composer-image img\s*\{[^}]*max-height:\s*440px;/s);
});


test('first recruitment notice has four swipeable empty slides, others remain single-image placeholders', async () => {
  assert.deepEqual(notices.map(post => post.images.length), [4, 1, 1, 1]);
  assert.ok(notices[0].images.every(image => image === null));
  const carousel = await readFile(new URL('../src/NoticeImageCarousel.tsx', import.meta.url), 'utf8');
  for (const marker of ['galleryFrame(slides)', 'slideDimensions(active)', 'onTouchStart', 'onTouchEnd',
    "event.key === 'ArrowLeft'", "event.key === 'ArrowRight'", 'notice-slide-arrow previous',
    'notice-slide-arrow next', 'notice-slide-pagination', 'notice-slide-dots', 'aria-live="polite"']) {
    assert.ok(carousel.includes(marker), 'Carousel missing ' + marker);
  }
  assert.match(styles, /\.notice-slide-viewport\{[^}]*max-width:100%;[^}]*touch-action:pan-y/);
  assert.match(styles, /\.notice-slide-media\{[^}]*position:absolute;top:50%;left:50%/);
  assert.match(styles, /\.notice-slide-media>\.notice-detail-photo-placeholder\{[^}]*height:100%;min-height:0;/);
});

test('gallery frame is sized to maximum width and height across all slides, independently of active slide', async () => {
  const code = await readFile(new URL('../src/noticeCarouselSizing.ts', import.meta.url), 'utf8');
  const js = typescript.transpileModule(code, { compilerOptions: {
    module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022,
  } }).outputText;
  const { galleryFrame, slideDimensions } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const wide = { width: 670, height: 220 };
  const tall = { width: 280, height: 900 };
  const sizes = [wide, tall, { width: 430, height: 570 }];
  assert.deepEqual(galleryFrame(sizes), { width: 670, height: 900 });
  assert.deepEqual(galleryFrame([...sizes].reverse()), { width: 670, height: 900 });
  assert.deepEqual(slideDimensions({ width: 400, height: 300 }), { width: 400, height: 300 });
  assert.deepEqual(slideDimensions({ width: 0, height: 0 }), { width: 320, height: 240 });
  assert.deepEqual(galleryFrame([]), { width: 1, height: 1 });
});

test('multi-selection is grouped into one carousel, preserves per-image resizing and has disabled publish shell', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /selected\.length > 1\s*\?\s*\{ id: nextId\.current\+\+, kind: 'gallery', images: newImages \}/);
  assert.match(composer, /block\.kind === 'gallery' \? <div className="notice-composer-gallery">/);
  assert.match(composer, /block\.kind === 'gallery'[\s\S]*?<NoticeImageCarousel key=\{block\.id\}/);
  assert.match(composer, /gallerySlides\(block\.images\)/);
  assert.match(composer, /image\.id === id \? \{ \.\.\.image, \.\.\.resizeImageDimensions/);
  assert.match(composer, /image\.id === id \? \{ \.\.\.image, ratioLocked: !image\.ratioLocked/);
  assert.match(composer, /removeSlide\(block\.id, image\.id\)/);
  assert.match(composer, /new Image\(\)/);
  assert.match(composer, /className="notice-composer-publish"/);
  assert.match(composer, /<button type="button" className="button button-primary" disabled title="발행 기능은 추후 연결됩니다.">발행 \(준비 중\)<\/button>/);
  assert.doesNotMatch(composer, /onClick=\{.*publish|uploadBytes|uploadString|setDoc\(|addDoc\(/);
});


test('append photos to an existing single image or slideshow, preserving per-image dimensions and order', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /function addImages\(event: ChangeEvent<HTMLInputElement>, targetBlockId\?: number\)/);
  assert.match(composer, /if \(block.kind === 'image'\) return \{ id: block.id, kind: 'gallery', images: \[block, \.\.\.newImages\] \}/);
  assert.match(composer, /if \(block.kind === 'gallery'\) return \{ \.\.\.block, images: \[\.\.\.block.images, \.\.\.newImages\] \}/);
  assert.match(composer, /selected.length \+ existingCount > 20/);
  assert.match(composer, /onClick=\{\(\)=>toggleImagePicker\(block.id\)\}/);
  assert.match(composer, /onChange=\{event=>addImages\(event,targetBlockId\)\}/);
  assert.match(composer, /슬라이드로 사진 추가/);
  assert.match(composer, /슬라이드에 사진 추가/);
  assert.match(composer, /naturalWidth: 0, naturalHeight: 0/);
});

test('gallery drag and accessible move buttons reorder underlying slides by stable image id', async () => {
  const code = await readFile(new URL('../src/noticeGalleryOrder.ts', import.meta.url), 'utf8');
  const js = typescript.transpileModule(code, { compilerOptions: {
    module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022,
  } }).outputText;
  const { reorderGalleryImages, shiftGalleryImage } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const images = [{id: 10, name:'A'}, {id: 20, name:'B'}, {id: 30, name:'C'}];
  assert.deepEqual(reorderGalleryImages(images, 10, 30).map(x=>x.id), [20,30,10]);
  assert.deepEqual(reorderGalleryImages(images, 30, 10).map(x=>x.id), [30,10,20]);
  assert.deepEqual(shiftGalleryImage(images,20,-1).map(x=>x.id), [20,10,30]);
  assert.deepEqual(shiftGalleryImage(images,20,1).map(x=>x.id), [10,30,20]);
  assert.deepEqual(shiftGalleryImage(images,10,-1),images);
  assert.deepEqual(reorderGalleryImages(images,10,999),images);
  assert.deepEqual(images.map(x=>x.id),[10,20,30]);
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /onDragStart=\{event => startSlideDrag\(event, block.id, image.id\)\}/);
  assert.match(composer, /onDrop=\{event => dropSlide\(event, block.id, image.id\)\}/);
  assert.match(composer, /moveGallerySlide\(block.id, image.id, -1\)/);
  assert.match(composer, /moveGallerySlide\(block.id, image.id, 1\)/);
  const carousel = await readFile(new URL('../src/NoticeImageCarousel.tsx', import.meta.url), 'utf8');
  assert.match(carousel, /slides.findIndex\(slide => slide.id === activeId\)/);
  assert.match(carousel, /setActiveId\(slide.id\)/);
});

test('restore initial insertion dimensions and original aspect ratio per single or gallery image', async () => {
  const source = await readFile(new URL('../src/noticeImageSize.ts', import.meta.url), 'utf8');
  const js = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.ESNext,
    target: typescript.ScriptTarget.ES2022 } }).outputText;
  const { initialImageDimensions, restoreInitialImageDimensions } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  assert.deepEqual(restoreInitialImageDimensions({width:300,height:200,naturalWidth:2400,naturalHeight:1600}),{width:800,height:533});
  assert.deepEqual(restoreInitialImageDimensions({width:500,height:500,naturalWidth:1200,naturalHeight:2400}),{width:450,height:900});
  assert.deepEqual(restoreInitialImageDimensions({width:200,height:100,naturalWidth:600,naturalHeight:400}),{width:600,height:400});
  assert.deepEqual(restoreInitialImageDimensions({width:400,height:160,naturalWidth:0,naturalHeight:0}),{width:400,height:160});
  const original = {width:320,height:180,naturalWidth:1920,naturalHeight:1080};
  assert.deepEqual(restoreInitialImageDimensions(original), initialImageDimensions(original.naturalWidth,original.naturalHeight));
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /function restoreImageSize\(id: number\)/);
  assert.match(composer, /restoreInitialImageDimensions\(image\), ratioLocked: true/);
  assert.match(composer, /disabled=\{!image.naturalWidth \|\| !image.naturalHeight\}/);
  assert.match(composer, /disabled=\{!block.naturalWidth \|\| !block.naturalHeight\}/);
  assert.equal(composer.split('원본 비율 복원').length - 1, 2);
  assert.equal(composer.split('최초 삽입 크기와 원본 비율로 복원').length - 1, 2);
  assert.doesNotMatch(composer, /원본 크기 복원|restoreOriginalDimensions/);
});


test('notice editor uses compact dimensions and hides the drag handle on mobile while retaining arrow reorder', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(styles, /\.notice-composer-dimensions input\{width:69px;min-width:0;height:32px;/);
  assert.match(styles, /@media\(max-width:520px\)\{\.notice-composer-dimensions\{gap:7px\}\.notice-composer-dimensions input\{width:57px;/);
  assert.match(styles, /\.notice-composer-ratio-toggle\{[^}]*width:32px;height:32px;/);
  assert.match(styles, /\.notice-composer-original-size\{[^}]*height:32px;/);
  assert.match(styles, /@media\(max-width:700px\)\{\.notice-composer-gallery-drag-handle\{display:none\}\}/);
  assert.match(styles, /\.notice-composer-dimensions input\[type=number\]\{appearance:textfield;/);
  assert.match(composer, /onClick=\{\(\) => moveGallerySlide\(block\.id, image\.id, -1\)\}/);
  assert.match(composer, /onClick=\{\(\) => moveGallerySlide\(block\.id, image\.id, 1\)\}/);
  assert.match(composer, /onDragStart=\{event => startSlideDrag\(event, block\.id, image\.id\)\}/);
  assert.match(composer, /<NoticeImageCarousel label="작성 중인 이미지 슬라이드"/);
});


test('mobile image controls are 28px high and slide filenames use a second truncated line', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /<strong className="notice-composer-gallery-file-label">/);
  assert.match(composer, /<span className="notice-composer-gallery-image-number">\{imageIndex \+ 1\}번째 이미지<\/span>/);
  assert.match(composer, /<span className="notice-composer-gallery-filename" title=\{image\.name\}>\{image\.name\}<\/span>/);
  assert.doesNotMatch(composer, /번째 이미지 · \{image\.name\}/);
  assert.match(styles, /\.notice-composer-gallery-filename\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
  assert.match(styles, /@media\(max-width:700px\)\{[\s\S]*?\.notice-composer-dimensions input\{height:28px;min-height:28px;[\s\S]*?\.notice-composer-ratio-toggle\{width:28px;height:28px;min-height:28px\}[\s\S]*?\.notice-composer-original-size\{height:28px;min-height:28px;/);
  assert.match(styles, /@media\(max-width:700px\)\{[\s\S]*?\.notice-composer-gallery-file-label\{flex-direction:column;align-items:flex-start;gap:1px\}[\s\S]*?\.notice-composer-gallery-filename\{flex:none;width:100%\}/);
  assert.match(styles, /@media\(max-width:700px\)\{\.notice-composer-gallery-drag-handle\{display:none\}\}/);
});
test('management notice date keeps explicitly styled typography alongside author names', () => {
  assert.match(app, /<span className="notice-date-cell">\{post\.date\}<\/span>/);
  assert.match(app, /canWrite && <span className="notice-author-cell">\{post\.author\}<\/span>/);
  assert.match(styles, /\.notice-table-row>\.notice-date-cell\{font-family:'Noto Sans KR',sans-serif;font-size:12px;font-weight:400;line-height:1\.6;[^}]*color:#a4afab;white-space:nowrap;text-align:right\}/);
});


test('notice registration date heading and values share centered alignment', () => {
  assert.match(app, /<span className="notice-date-cell">등록일<\/span>/);
  assert.match(app, /<span className="notice-date-cell">\{post\.date\}<\/span>/);
  assert.match(styles, /\.notice-table-head>\.notice-date-cell,\.notice-table-row>\.notice-date-cell\{text-align:center\}/);
  assert.match(styles, /\.notice-table-row>\.notice-date-cell\{[^}]*text-align:right\}/);
  assert.ok(styles.lastIndexOf('.notice-table-head>.notice-date-cell,.notice-table-row>.notice-date-cell{text-align:center}') >
    styles.lastIndexOf(".notice-table-row>.notice-date-cell{font-family:"), 'center alignment overrides the older right alignment');
  assert.match(styles, /\.notice-table-head\.has-author,\.notice-table-row\.has-author/);
});

test('desktop shows a centered dot between slide number and filename, while mobile hides it', async () => {
  const composer = await readFile(new URL('../src/NoticeComposer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /<span className="notice-composer-gallery-image-number">\{imageIndex \+ 1\}번째 이미지<\/span>/);
  assert.match(composer, /<span className="notice-composer-gallery-filename" title=\{image\.name\}>\{image\.name\}<\/span>/);
  assert.match(styles, /\.notice-composer-gallery-image-number::after\{content:" ·";white-space:pre\}/);
  assert.match(styles, /@media\(max-width:700px\)\{\.notice-composer-gallery-image-number::after\{content:none\}\}/);
  assert.doesNotMatch(styles, /\.notice-composer-gallery-image-number::after\{content:" \*"/);
  assert.match(styles, /\.notice-composer-gallery-filename\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
  assert.match(styles, /\.notice-composer-gallery-file-label\{flex-direction:column;align-items:flex-start;gap:1px\}/);
});


test('notice image insertion expands URL and multi-file controls but never uploads to the server',async()=>{
  const composer=await readFile(new URL('../src/NoticeComposer.tsx',import.meta.url),'utf8');
  assert.match(composer,/const \[newImagePickerOpen,setNewImagePickerOpen\]=useState\(false\)/);
  assert.match(composer,/const \[slidePickerId,setSlidePickerId\]=useState<number\|null>\(null\)/);
  assert.match(composer,/function imagePicker\(targetBlockId\?:number\)/);
  assert.match(composer,/type="url" placeholder="https:\/\/example.com\/photo.jpg"/);
  assert.match(composer,/URL 이미지 추가/);
  assert.match(composer,/파일 업로드/);
  assert.match(composer,/multiple/);
  assert.match(composer,/selected.length > 1/);
  assert.match(composer,/addUrlImage\(targetBlockId\)/);
  assert.match(composer,/setNewImagePickerOpen\(false\)/);
  assert.match(composer,/setSlidePickerId\(null\)/);
  assert.match(composer,/newImagePickerOpen&&imagePicker\(\)/);
  assert.match(composer,/slidePickerId===block.id&&imagePicker\(block.id\)/);
  const pickerOffset=composer.lastIndexOf('{newImagePickerOpen&&imagePicker()}');
  const buttonsOffset=composer.lastIndexOf('<div className="notice-composer-actions">');
  const publishOffset=composer.lastIndexOf('<div className="notice-composer-publish">');
  assert.ok(pickerOffset<buttonsOffset && buttonsOffset<publishOffset,
    'the new image picker should expand directly above the action buttons');
  assert.equal(composer.split('{newImagePickerOpen&&imagePicker()}').length-1,1);
  assert.match(styles,/\.notice-composer-image-picker\{/);
  assert.doesNotMatch(composer,/uploadAboutImage|\/api\/about\/image|uploadBytes|addDoc\(/);
});


test('new image picker has top spacing while existing slide picker remains unaffected', async () => {
  const composer=await readFile(new URL('../src/NoticeComposer.tsx',import.meta.url),'utf8');
  assert.match(composer,/targetBlockId===undefined\?'notice-composer-image-picker is-new-image':'notice-composer-image-picker'/);
  assert.match(styles,/\.notice-composer-image-picker\.is-new-image\{margin-top:16px\}/);
});
