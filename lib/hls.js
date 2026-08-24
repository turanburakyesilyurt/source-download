/*
 * Source Download — minimal HLS (m3u8) merger.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * A from-scratch, dependency-free implementation for the most common HLS
 * case: a plain (unencrypted) MPEG-TS stream split into a playlist of
 * segments. The panel's video player cannot play m3u8 directly (no hls.js,
 * and we refuse to grow the bundle or add third-party code), so instead we
 * parse the playlist, fetch every segment in order and concatenate them into
 * a single .ts file the user can open in VLC or any media player.
 *
 * Supported:
 *   - master playlists (#EXT-X-STREAM-INF) — the highest-bandwidth variant wins
 *   - media playlists with #EXTINF durations
 *   - fMP4 streams that use #EXT-X-MAP (init segment is prepended)
 *   - relative and absolute segment URLs
 *
 * Not supported (reported as errors): AES-128 encryption (#EXT-X-KEY),
 * because decrypting requires the key + IV handling that would drag in
 * crypto complexity far beyond the scope of a download helper.
 *
 * Exposed globally as `SourceDownloadHls` and usable from both browser and
 * Node.js. The network fetchers are injected so this module stays pure and
 * fully testable:
 *
 *   combine(manifestUrl, { text(url), bytes(url) }, onProgress)
 *     -> Promise<{ bytes: Uint8Array, mime: "video/mp2t"|"video/mp4",
 *                  segments: number, live: boolean }>
 */
(function (root) {
  'use strict';

  // Master playlist: collect { bandwidth, resolution, url } per variant.
  function parseMaster(text, baseUrl) {
    const streams = [];
    const lines = String(text || '').split(/\r?\n/);
    let info = null;
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith('#EXT-X-STREAM-INF')) {
        const bw = /BANDWIDTH=(\d+)/.exec(l);
        const res = /RESOLUTION=(\d+x\d+)/.exec(l);
        info = { bandwidth: bw ? +bw[1] : 0, resolution: res ? res[1] : '' };
      } else if (info && l && !l.startsWith('#')) {
        info.url = new URL(l, baseUrl).href;
        streams.push(info);
        info = null;
      }
    }
    return streams;
  }

  // Media playlist: return { segments: [{url, duration}], mapUri, encrypted, endlist }.
  function parseMedia(text, baseUrl) {
    const segments = [];
    const lines = String(text || '').split(/\r?\n/);
    let duration = 0;
    let mapUri = null;
    let encrypted = false;
    let endlist = false;
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith('#EXT-X-KEY')) {
        if (/METHOD\s*=\s*AES-128/.test(l)) encrypted = true;
      } else if (l.startsWith('#EXT-X-MAP')) {
        const m = /URI\s*=\s*"([^"]+)"/.exec(l);
        if (m) mapUri = new URL(m[1], baseUrl).href;
      } else if (l.startsWith('#EXTINF')) {
        const m = /#EXTINF\s*:\s*([\d.]+)/.exec(l);
        duration = m ? parseFloat(m[1]) : 0;
      } else if (l === '#EXT-X-ENDLIST') {
        endlist = true;
      } else if (l && !l.startsWith('#')) {
        segments.push({ url: new URL(l, baseUrl).href, duration });
        duration = 0;
      }
    }
    return { segments, mapUri, encrypted, endlist };
  }

  // Enough parallelism to hide latency without hammering the origin.
  var SEGMENT_CONCURRENCY = 6;

  function concatBytes(parts) {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }

  // Given a manifest URL and injected fetchers, resolve the media playlist and
  // download every segment, returning the merged bytes.
  async function combine(manifestUrl, fetchers, onProgress) {
    if (!fetchers || typeof fetchers.text !== 'function' || typeof fetchers.bytes !== 'function') {
      throw new Error('HLS: fetchers { text, bytes } are required');
    }
    let playlistUrl = manifestUrl;
    const manifest = await fetchers.text(manifestUrl);
    if (!manifest) throw new Error('HLS: could not download the playlist');
    if (manifest.includes('#EXT-X-STREAM-INF')) {
      const streams = parseMaster(manifest, manifestUrl);
      if (!streams.length) throw new Error('HLS: master playlist contains no variants');
      streams.sort((a, b) => b.bandwidth - a.bandwidth);
      playlistUrl = streams[0].url;
    }
    const media = await fetchers.text(playlistUrl);
    if (!media) throw new Error('HLS: could not download the media playlist');
    const parsed = parseMedia(media, playlistUrl);
    if (!parsed.segments.length) throw new Error('HLS: playlist contains no segments');
    if (parsed.encrypted) throw new Error('HLS: stream is AES-128 encrypted and cannot be merged');
    const mime = parsed.mapUri ? 'video/mp4' : 'video/mp2t';

    const parts = [];
    if (parsed.mapUri) {
      const init = await fetchers.bytes(parsed.mapUri);
      if (!init) throw new Error('HLS: could not download the init segment');
      parts.push(init);
    }

    // Segments are fetched a few at a time — a long stream one-at-a-time is
    // dominated by round-trip latency — but they are stored by index, so the
    // merged file keeps the playlist's order.
    const count = parsed.segments.length;
    const fetched = new Array(count);
    let cursor = 0;
    let done = 0;
    let failure = null;

    const pump = async () => {
      while (cursor < count && !failure) {
        const i = cursor++;
        let seg = null;
        try {
          seg = await fetchers.bytes(parsed.segments[i].url);
        } catch (e) {
          seg = null;
        }
        if (!seg) {
          if (!failure) failure = new Error('HLS: segment ' + (i + 1) + ' of ' + count + ' could not be downloaded');
          return;
        }
        fetched[i] = seg;
        done++;
        if (onProgress) onProgress(done / count);
      }
    };

    const lanes = Math.min(SEGMENT_CONCURRENCY, count);
    await Promise.all(Array.from({ length: lanes }, pump));
    if (failure) throw failure;

    for (let i = 0; i < count; i++) parts.push(fetched[i]);
    return { bytes: concatBytes(parts), mime, segments: count, live: !parsed.endlist };
  }

  root.SourceDownloadHls = { combine: combine, parseMaster: parseMaster, parseMedia: parseMedia };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { combine: combine, parseMaster: parseMaster, parseMedia: parseMedia };
  }
})(typeof self !== 'undefined' ? self : globalThis);
