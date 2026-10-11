/* Source Download — streaming GIF encoder tests.
 * Run: node tools/gif_stream_test.js
 */
'use strict';

const path = require('path');
const assert = require('assert');

const gif = require(path.resolve(__dirname, '../lib/gif.js'));

function frame(w, h, seed) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = (i * 7 + seed * 40) & 255;
    data[i * 4 + 1] = (i * 3 + seed * 90) & 255;
    data[i * 4 + 2] = (i + seed * 13) & 255;
    data[i * 4 + 3] = 255;
  }
  return data;
}

(async () => {
  const W = 64, H = 40;
  const frames = [0, 1, 2, 3, 4].map((n) => frame(W, H, n));

  // 1. Same bytes as the batch encoder
  const batch = Buffer.from(await (await gif.createAnimatedGifBlob(frames.map((f) => f.slice()), W, H, 10)).arrayBuffer());
  const enc = gif.createGifEncoder(W, H, 10);
  for (const f of frames) enc.addFrame(f);
  const stream = Buffer.from(await enc.finish().arrayBuffer());
  assert(batch.equals(stream), 'streaming output must equal batch output');
  assert.strictEqual(enc.frameCount, 5);
  assert.strictEqual(enc.byteLength, stream.length, 'byteLength tracks output size');
  assert.strictEqual(stream.subarray(0, 6).toString(), 'GIF89a');
  assert.strictEqual(stream[stream.length - 1], 0x3b, 'trailer');

  // 2. Per-frame delay (skipped frames lengthen the previous one)
  const enc2 = gif.createGifEncoder(W, H, 10);
  enc2.addFrame(frames[0], 10);
  enc2.addFrame(frames[1], 30);
  const out2 = Buffer.from(await enc2.finish().arrayBuffer());
  const delays = [];
  for (let i = 0; i < out2.length - 5; i++) {
    if (out2[i] === 0x21 && out2[i + 1] === 0xf9 && out2[i + 2] === 0x04) delays.push(out2[i + 4] | (out2[i + 5] << 8));
  }
  assert.deepStrictEqual(delays, [10, 30], 'graphic control delays');

  // 3. Misuse is rejected
  assert.throws(() => gif.createGifEncoder(W, H).finish(), /No frames/);
  const enc3 = gif.createGifEncoder(W, H);
  enc3.addFrame(frames[0]);
  enc3.finish();
  assert.throws(() => enc3.addFrame(frames[1]), /already finished/);

  console.log('Streaming GIF encoder tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
