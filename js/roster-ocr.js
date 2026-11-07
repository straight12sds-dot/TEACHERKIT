// OCR ไม่อ่านหรือเขียน store: ภาพและข้อความอยู่ในหน่วยความจำจนกว่าครูจะนำไปใช้
export function cleanRosterText(text) {
  return String(text).normalize('NFC').split(/\r?\n/).map(line => line
    .replace(/[\t|]+/g, ' ')
    .replace(/^\s*[•▪●–—-]+\s*/u, '')
    .trim()
    .replace(/^(?:[0-9๐-๙]+[.)\s:|/-]*)+/u, '')
    .replace(/^ด\s*[.．]?\s*([ชญ])\s*[.．]?\s*/u, (_, gender) => `ด.${gender}. `)
    .replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง)\s*/u, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
  ).filter(line => /[\p{L}\p{M}]/u.test(line)).join('\n');
}

function aborted(signal) {
  if (signal?.aborted) throw new DOMException('ยกเลิกการสแกนแล้ว', 'AbortError');
}

export async function prepareRosterImage(file, turns = 0, signal) {
  aborted(signal);
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      const abort = () => { image.src = ''; reject(new DOMException('ยกเลิกการสแกนแล้ว', 'AbortError')); };
      image.onload = () => { signal?.removeEventListener('abort', abort); resolve(); };
      image.onerror = () => { signal?.removeEventListener('abort', abort); reject(new Error('เปิดรูปนี้ไม่ได้ กรุณาใช้รูป JPG, PNG หรือ WebP')); };
      signal?.addEventListener('abort', abort, { once: true });
      image.src = url;
    });
    aborted(signal);
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 45000000) {
      throw new Error('ภาพมีขนาดใหญ่เกินไป กรุณาครอปให้เหลือเฉพาะรายชื่อก่อน');
    }
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(2, 2800 / longest);
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    const rotation = ((turns % 4) + 4) % 4;
    const canvas = document.createElement('canvas');
    canvas.width = (rotation % 2 ? height : width) + 32;
    canvas.height = (rotation % 2 ? width : height) + 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่สามารถเตรียมรูปสำหรับสแกนได้');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ocr-paper').trim();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotation * Math.PI / 2);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    canvas.width = canvas.height = 0;
    aborted(signal);
    if (!blob) throw new Error('เตรียมรูปไม่สำเร็จ กรุณาเลือกรูปอีกครั้ง');
    return blob.arrayBuffer();
  } finally {
    image.onload = image.onerror = null;
    URL.revokeObjectURL(url);
  }
}

export async function recognizeRoster(file, { turns = 0, language = 'tha+eng', onProgress = () => {}, signal } = {}) {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') throw new Error('เบราว์เซอร์นี้ไม่รองรับการสแกน กรุณาเปิดด้วย Chrome, Edge, Firefox หรือ Safari รุ่นใหม่');
  if (!['tha+eng', 'tha', 'eng'].includes(language)) throw new Error('ไม่รองรับภาษาที่เลือก');
  const image = await prepareRosterImage(file, turns, signal);
  aborted(signal);
  return new Promise((resolve, reject) => {
    // ครอบ engine ใน worker ของเราอีกชั้น เพื่อหยุดได้ทันทีแม้กำลังโหลดภาษา
    const worker = new Worker(new URL('./roster-ocr-worker.js', import.meta.url));
    const finish = (error, result) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(new DOMException('ยกเลิกการสแกนแล้ว', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error('สแกนใช้เวลานานเกินไป กรุณาตรวจอินเทอร์เน็ตหรือครอปรูปให้เล็กลง แล้วลองอีกครั้ง')), 180000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress(data);
      if (data.type === 'result') finish(null, data);
      if (data.type === 'error') finish(new Error('โหลดตัวอ่านหรือสแกนไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง'));
    };
    worker.onerror = event => {
      event.preventDefault();
      finish(new Error('เปิดตัวอ่านไม่ได้ กรุณาตรวจอินเทอร์เน็ตและใช้เบราว์เซอร์รุ่นใหม่ แล้วลองอีกครั้ง'));
    };
    worker.postMessage({ image, language }, [image]);
  });
}
