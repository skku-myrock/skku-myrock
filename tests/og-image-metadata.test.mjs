import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the homepage exposes a public 1200x630 Open Graph logo image', async () => {
  const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const image = await readFile(new URL('../public/og-image.png', import.meta.url));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
  assert.match(page, /<meta property="og:type" content="website"\s*\/>/);
  assert.match(page, /<meta property="og:url" content="https:\/\/skku-myrock\.pages\.dev\/"\s*\/>/);
  assert.match(page, /<meta property="og:image" content="https:\/\/skku-myrock\.pages\.dev\/og-image\.png"\s*\/>/);
  assert.match(page, /<meta property="og:image:width" content="1200"\s*\/>/);
  assert.match(page, /<meta property="og:image:height" content="630"\s*\/>/);
  assert.match(page, /<meta name="twitter:card" content="summary_large_image"\s*\/>/);
  assert.match(page, /<meta name="twitter:image" content="https:\/\/skku-myrock\.pages\.dev\/og-image\.png"\s*\/>/);
  assert.match(page, /<meta property="og:description" /);
  assert.match(page, /<meta property="og:image:alt" /);
});
