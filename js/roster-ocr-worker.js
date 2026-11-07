// Tesseract.js Apache-2.0; เวอร์ชันตรึงไว้ ไม่ส่งภาพ/ข้อความไปยัง CDN
// CDN ใช้ดาวน์โหลดโปรแกรมและข้อมูลภาษาเท่านั้น (cache โดย service worker)
self.onmessage = async ({ data: { image, language } }) => {
  let engine;
  const blobs = [];
  const loadScript = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('OCR runtime unavailable');
    const blob = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: 'application/javascript' }));
    blobs.push(blob);
    return blob;
  };
  try {
    // fetch ชัดเจนให้ service worker เก็บ runtime ได้ด้วย (importScripts ข้าม origin ไม่ถูก cache เสมอ)
    const [library, worker, core] = await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-lstm.wasm.js'),
    ]);
    importScripts(library);
    engine = await Tesseract.createWorker(language, 1, {
      workerPath: worker,
      workerBlobURL: false,
      corePath: `${core}#core.js`,
      langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
      logger: ({ status, progress }) => self.postMessage({ type: 'progress', status, progress }),
      errorHandler: () => {},
    });
    await engine.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const { data } = await engine.recognize(image);
    self.postMessage({ type: 'result', text: data.text });
  } catch {
    self.postMessage({ type: 'error' });
  } finally {
    await engine?.terminate();
    blobs.forEach(url => URL.revokeObjectURL(url));
    self.close();
  }
};
