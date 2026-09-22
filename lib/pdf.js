/* Source Download — Built-in Minimal PDF Document Builder.
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

  function uint8ArrayToBinaryString(uint8) {
    let binary = '';
    const chunk = 16384;
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, Math.min(i + chunk, uint8.length)));
    }
    return binary;
  }

  function binaryStringToUint8Array(binary) {
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function dataUrlToUint8(dataUrl) {
    const commaIdx = dataUrl.indexOf(',');
    const base64Data = dataUrl.slice(commaIdx + 1);
    const binary = atob(base64Data);
    return binaryStringToUint8Array(binary);
  }

  async function convertDataUrlToJpegBytes(dataUrl) {
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            bytes: dataUrlToUint8(dataUrl),
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        img.src = dataUrl;
      });
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        // Fill white background for transparency in PNG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            const jpegDataUrl = reader.result;
            resolve({
              bytes: dataUrlToUint8(jpegDataUrl),
              width: img.naturalWidth,
              height: img.naturalHeight
            });
          };
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.94);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function buildPdfBlob(jpegBytes, width, height) {
    // 72 points per inch. Standard A4 width = 595.28 pt
    const ptWidth = 595.28;
    const ptHeight = Math.round(ptWidth * (height / width) * 100) / 100;

    const contentStream = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentLen = contentStream.length;

    const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
    const obj4Prefix = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
    const obj4Suffix = '\nendstream\nendobj\n';
    const obj5 = `5 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`;

    const enc = new TextEncoder();
    const hBytes = enc.encode(header);
    const o1Bytes = enc.encode(obj1);
    const o2Bytes = enc.encode(obj2);
    const o3Bytes = enc.encode(obj3);
    const o4PreBytes = enc.encode(obj4Prefix);
    const o4SufBytes = enc.encode(obj4Suffix);
    const o5Bytes = enc.encode(obj5);

    const offsets = [];
    let cur = hBytes.length;

    offsets.push(cur); // obj 1
    cur += o1Bytes.length;

    offsets.push(cur); // obj 2
    cur += o2Bytes.length;

    offsets.push(cur); // obj 3
    cur += o3Bytes.length;

    offsets.push(cur); // obj 4
    cur += o4PreBytes.length + jpegBytes.length + o4SufBytes.length;

    offsets.push(cur); // obj 5
    cur += o5Bytes.length;

    const startXref = cur;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 0; i < 5; i++) {
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
    const trailerBytes = enc.encode(xref + trailer);

    return new Blob(
      [hBytes, o1Bytes, o2Bytes, o3Bytes, o4PreBytes, jpegBytes, o4SufBytes, o5Bytes, trailerBytes],
      { type: 'application/pdf' }
    );
  }

  async function createPdfBlobFromDataUrl(dataUrl) {
    const { bytes, width, height } = await convertDataUrlToJpegBytes(dataUrl);
    return buildPdfBlob(bytes, width, height);
  }

  globalScope.SourceDownloadPdf = {
    createPdfBlobFromDataUrl,
    buildPdfBlob
  };
})();
