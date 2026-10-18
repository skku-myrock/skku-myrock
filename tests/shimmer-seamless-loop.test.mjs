import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('shimmer repeats one full gradient tile, so its loop boundary has no visual jump',async()=>{
 const css=await read('src/styles/loading-ui.css');
 const band=css.match(/\.image-shimmer-band\{([\s\S]*?)\}/)?.[1];
 const animation=css.match(/@keyframes shimmer\{([\s\S]*?)\}\s*\}/)?.[1];
 assert.ok(band,'missing common image shimmer band style');
 assert.match(band,/--shimmer-cycle:clamp\(380px,120vw,840px\)/);
 assert.match(band,/background-size:var\(--shimmer-cycle\) 100%/);
 assert.match(band,/background-repeat:repeat-x/);
 assert.match(band,/animation:shimmer 3\.2s linear infinite/);
 // Both ends of the gradient must be the same shade, so tiles join.
 assert.match(band,/background-image:linear-gradient\(90deg,\s*#eef2f0 0%,[\s\S]*#eef2f0 100%\)/);
 // Exactly one tile displacement and constant velocity guarantee a seamless loop.
 assert.match(css,/@keyframes shimmer\{\s*from\{background-position:0 0\}\s*to\{background-position:var\(--shimmer-cycle\) 0\}\s*\}/);
 assert.doesNotMatch(css,/background-position:(?:170%|-170%)/);
 assert.doesNotMatch(css,/shimmer 1\.7s/);
 // Motion preference remains respected for every image.
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.image-shimmer-band\{animation:none;/);
});

test('all image loading placeholders share the same shimmer animation',async()=>{
 const [image,about,style]=await Promise.all([
  read('src/ImageShimmer.tsx'),read('src/AboutManagement.tsx'),read('src/styles/loading-ui.css')
 ]);
 assert.match(image,/<span className="image-shimmer-band" aria-hidden="true"\/>/);
 assert.match(about,/className="image-shimmer-band" aria-hidden="true"/);
 assert.equal((style.match(/@keyframes shimmer\{/g)||[]).length,1);
});
