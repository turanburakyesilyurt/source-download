/* Source Download — Built-in Pure Vanilla Animated GIF Encoder.
 * Generates standard GIF89a animations with 15-bit median-cut color quantization
 * and high-performance integer-keyed LZW compression.
 * Zero external runtime dependencies.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
(function () {
  'use strict';

  const globalScope = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : {};
  /**
   * Fast median-cut color quantizer.
   * Maps 32-bit RGBA pixels to a 256-color palette using a 15-bit histogram lookup.
   */
  function quantizeMedianCut(rgbaArray, maxColors = 256) {
    const pixelCount = rgbaArray.length / 4;
    const histo = new Uint32Array(32768); // 32x32x32 5-bit color space

    for (let i = 0; i < rgbaArray.length; i += 4) {
      const r5 = rgbaArray[i] >> 3;
      const g5 = rgbaArray[i + 1] >> 3;
      const b5 = rgbaArray[i + 2] >> 3;
      histo[(r5 << 10) | (g5 << 5) | b5]++;
    }

    const colors = [];
    for (let key = 0; key < 32768; key++) {
      if (histo[key] > 0) {
        colors.push({
          r: (key >> 10) & 31,
          g: (key >> 5) & 31,
          b: key & 31,
          count: histo[key],
        });
      }
    }

    if (colors.length <= maxColors) {
      const palette = [];
      const lut = new Uint8Array(32768);
      colors.forEach((c, idx) => {
        palette.push((c.r << 3) | 4, (c.g << 3) | 4, (c.b << 3) | 4);
        lut[(c.r << 10) | (c.g << 5) | c.b] = idx;
      });
      while (palette.length < maxColors * 3) palette.push(0);
      return { palette, lut };
    }

    const boxes = [{ colors, count: pixelCount }];
    while (boxes.length < maxColors) {
      let bestIdx = -1;
      let maxRange = -1;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (b.colors.length <= 1) continue;
        let minR = 31, maxR = 0, minG = 31, maxG = 0, minB = 31, maxB = 0;
        for (const c of b.colors) {
          if (c.r < minR) minR = c.r; if (c.r > maxR) maxR = c.r;
          if (c.g < minG) minG = c.g; if (c.g > maxG) maxG = c.g;
          if (c.b < minB) minB = c.b; if (c.b > maxB) maxB = c.b;
        }
        const range = Math.max(maxR - minR, maxG - minG, maxB - minB);
        if (range > maxRange) {
          maxRange = range;
          bestIdx = i;
        }
      }
      if (bestIdx === -1 || maxRange === 0) break;

      const boxToSplit = boxes.splice(bestIdx, 1)[0];
      let minR = 31, maxR = 0, minG = 31, maxG = 0, minB = 31, maxB = 0;
      for (const c of boxToSplit.colors) {
        if (c.r < minR) minR = c.r; if (c.r > maxR) maxR = c.r;
        if (c.g < minG) minG = c.g; if (c.g > maxG) maxG = c.g;
        if (c.b < minB) minB = c.b; if (c.b > maxB) maxB = c.b;
      }
      const rRange = maxR - minR;
      const gRange = maxG - minG;
      const bRange = maxB - minB;
      const channel = (gRange >= rRange && gRange >= bRange) ? 'g' : (rRange >= bRange ? 'r' : 'b');

      boxToSplit.colors.sort((a, b) => a[channel] - b[channel]);
      const half = Math.floor(boxToSplit.colors.length / 2);
      boxes.push(
        { colors: boxToSplit.colors.slice(0, half) },
        { colors: boxToSplit.colors.slice(half) }
      );
    }

    const palette = [];
    const lut = new Uint8Array(32768);
    boxes.forEach((box, idx) => {
      let sumR = 0, sumG = 0, sumB = 0, total = 0;
      for (const c of box.colors) {
        sumR += c.r * c.count;
        sumG += c.g * c.count;
        sumB += c.b * c.count;
        total += c.count;
      }
      const avgR = total ? Math.round(sumR / total) : 0;
      const avgG = total ? Math.round(sumG / total) : 0;
      const avgB = total ? Math.round(sumB / total) : 0;
      palette.push((avgR << 3) | 4, (avgG << 3) | 4, (avgB << 3) | 4);
      for (const c of box.colors) {
        lut[(c.r << 10) | (c.g << 5) | c.b] = idx;
      }
    });

    while (palette.length < maxColors * 3) palette.push(0);
    return { palette, lut };
  }

  /**
   * Fast integer-keyed LZW compressor for GIF image data blocks.
   */
  function lzwEncode(minCodeSize, pixels) {
    const out = [];
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;

    const dict = new Map();
    function resetDict() {
      dict.clear();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    }
    resetDict();

    let curAccum = 0;
    let curBits = 0;
    function writeBits(code) {
      curAccum |= (code << curBits);
      curBits += codeSize;
      while (curBits >= 8) {
        out.push(curAccum & 0xff);
        curAccum >>= 8;
        curBits -= 8;
      }
    }

    writeBits(clearCode);
    let prefix = pixels[0];

    for (let i = 1; i < pixels.length; i++) {
      const c = pixels[i];
      const key = (prefix << 8) | c;
      const code = dict.get(key);
      if (code !== undefined) {
        prefix = code;
      } else {
        writeBits(prefix);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeBits(clearCode);
          resetDict();
        }
        prefix = c;
      }
    }
    writeBits(prefix);
    writeBits(eoiCode);
    if (curBits > 0) out.push(curAccum & 0xff);

    const subBlocks = [];
    let idx = 0;
    while (idx < out.length) {
      const chunkSize = Math.min(255, out.length - idx);
      subBlocks.push(chunkSize);
      for (let c = 0; c < chunkSize; c++) {
        subBlocks.push(out[idx + c]);
      }
      idx += chunkSize;
    }
    subBlocks.push(0);
    return new Uint8Array(subBlocks);
  }

  /**
   * Encodes an array of RGBA frames into an animated GIF Blob.
   * @param {Array<ImageData|{data: Uint8ClampedArray, width: number, height: number}>} frames
   * @param {number} width
   * @param {number} height
   * @param {number} delayCentisec Frame delay in 1/100ths of a second (10 = 100ms = 10fps)
   * @param {Function} [onProgress] Optional callback (completedFrames, totalFrames) => void
   * @returns {Promise<Blob>}
   */
  async function createAnimatedGifBlob(frames, width, height, delayCentisec = 10, onProgress = null) {
    if (!frames || frames.length === 0) {
      throw new Error('No frames provided for GIF encoding.');
    }

    const chunks = [];
    let currentChunk = new Uint8Array(65536);
    let currentPos = 0;

    function flushChunk() {
      if (currentPos > 0) {
        chunks.push(currentChunk.subarray(0, currentPos));
        currentChunk = new Uint8Array(65536);
        currentPos = 0;
      }
    }

    function writeByte(b) {
      if (currentPos >= currentChunk.length) {
        flushChunk();
      }
      currentChunk[currentPos++] = b & 0xff;
    }

    function writeWord(w) {
      writeByte(w & 0xff);
      writeByte((w >> 8) & 0xff);
    }

    function writeStr(s) {
      for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i));
    }

    function writeBytes(bytes) {
      if (!bytes || bytes.length === 0) return;
      const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
      if (u8.length > 512) {
        flushChunk();
        chunks.push(u8);
      } else {
        for (let i = 0; i < u8.length; i++) {
          writeByte(u8[i]);
        }
      }
    }

    const firstData = frames[0].data || frames[0];
    const firstQ = quantizeMedianCut(firstData, 256);

    // 1. GIF Header & Logical Screen Descriptor with Global Color Table
    writeStr('GIF89a');
    writeWord(width);
    writeWord(height);
    writeByte(0xf7); // GCT Flag: 1, 8-bit color resolution, GCT size 256 (0xF7)
    writeByte(0);    // Background color index
    writeByte(0);    // Pixel aspect ratio

    // Global Color Table (768 bytes)
    for (let c = 0; c < 768; c++) {
      writeByte(firstQ.palette[c] || 0);
    }

    // 2. Netscape Loop Extension (infinite loop)
    writeByte(0x21); writeByte(0xff); writeByte(0x0b);
    writeStr('NETSCAPE2.0');
    writeByte(0x03); writeByte(0x01);
    writeWord(0); // Loop forever
    writeByte(0);

    // 3. Write Frames
    const totalPixels = width * height;
    for (let fIdx = 0; fIdx < frames.length; fIdx++) {
      if (typeof onProgress === 'function') {
        try { onProgress(fIdx, frames.length); } catch {}
      }
      // Cooperative multitasking: yield to event loop every 2 frames
      if (fIdx > 0 && fIdx % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const frame = frames[fIdx];
      const data = frame.data || frame;
      const { palette, lut } = (fIdx === 0) ? firstQ : quantizeMedianCut(data, 256);
      const indexedPixels = new Uint8Array(totalPixels);

      for (let i = 0, p = 0; i < data.length && p < totalPixels; i += 4, p++) {
        const r5 = data[i] >> 3;
        const g5 = data[i + 1] >> 3;
        const b5 = data[i + 2] >> 3;
        indexedPixels[p] = lut[(r5 << 10) | (g5 << 5) | b5];
      }

      // Graphic Control Extension
      writeByte(0x21); writeByte(0xf9); writeByte(0x04);
      writeByte(0x04); // Disposal method 1 (do not dispose / overwrite)
      writeWord(delayCentisec); // Delay time in 10ms units
      writeByte(0); // Transparent color index
      writeByte(0);

      // Image Descriptor
      writeByte(0x2c); // ','
      writeWord(0); writeWord(0); // Left, Top
      writeWord(width); writeWord(height);
      writeByte(0x87); // Local Color Table flag: 1, 8 bits (256 colors)

      // Local Color Table (768 bytes)
      for (let c = 0; c < 768; c++) {
        writeByte(palette[c] || 0);
      }

      // LZW minimum code size
      writeByte(8);

      // LZW Sub-blocks
      const lzwBlocks = lzwEncode(8, indexedPixels);
      writeBytes(lzwBlocks);
      frames[fIdx] = null; // Free frame buffer immediately
    }

    if (typeof onProgress === 'function') {
      try { onProgress(frames.length, frames.length); } catch {}
    }

    // 4. GIF Trailer
    writeByte(0x3b); // ';'
    flushChunk();

    return new Blob(chunks, { type: 'image/gif' });
  }

  const api = {
    createAnimatedGifBlob,
    quantizeMedianCut,
    lzwEncode
  };

  globalScope.SourceDownloadGif = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
