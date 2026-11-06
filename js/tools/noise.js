import { save, toolData } from '../store.js';
import { pageHead, beep, toggleFullscreen } from '../util.js';

export default {
  id: 'noise',
  icon: '🔊',
  title: 'วัดระดับเสียงในห้อง',
  desc: 'ใช้ไมโครโฟนแสดงระดับเสียง เตือนเมื่อห้องเสียงดังเกินไป',
  render(el) {
    const d = toolData('noise', { limit: 60, alarm: true });
    let stream = null, ctx = null, raf = 0, smooth = 0, lastAlarm = 0, over = 0;

    el.innerHTML = `
      ${pageHead('🔊 วัดระดับเสียงในห้อง', `<button class="btn" data-act="fs">⛶ เต็มจอ</button>`)}
      <div class="card stack fs-target" id="fs" style="text-align:center">
        <div class="face" id="face">🤫</div>
        <div id="msg" style="font-size:1.4rem;font-weight:600">กด "เริ่มวัดเสียง" และอนุญาตให้ใช้ไมโครโฟน</div>
        <div class="meter"><div class="fill" id="fill"></div><div class="limit" id="limitLine"></div></div>
        <div class="row" style="justify-content:center">
          <button class="btn btn-primary btn-lg" data-act="toggle" id="toggle">🎤 เริ่มวัดเสียง</button>
        </div>
        <div class="row" style="justify-content:center">
          <label for="limit">ระดับที่ยอมรับได้</label>
          <input type="range" id="limit" min="10" max="95" value="${d.limit}" style="width:220px">
          <label class="check"><input type="checkbox" id="alarm" ${d.alarm ? 'checked' : ''}> เสียงเตือน</label>
        </div>
        <p class="muted small">เสียงถูกประมวลผลในเครื่องเท่านั้น ไม่มีการบันทึกหรือส่งออกไปไหน</p>
      </div>`;

    const fill = el.querySelector('#fill');
    const face = el.querySelector('#face');
    const msg = el.querySelector('#msg');
    const limitLine = el.querySelector('#limitLine');
    const toggleBtn = el.querySelector('#toggle');
    const setLimitLine = () => { limitLine.style.left = `${d.limit}%`; };
    setLimitLine();

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch {
        msg.textContent = '⚠️ ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาตการเข้าถึงในเบราว์เซอร์';
        return;
      }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      toggleBtn.textContent = '⏹ หยุด';
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        // แปลงเป็นสเกล 0-100 แบบลอการิทึม (ประมาณ -60dB..0dB)
        const db = 20 * Math.log10(rms || 1e-8);
        const level = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
        smooth = smooth * 0.85 + level * 0.15;
        paint(smooth);
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    function paint(v) {
      fill.style.width = `${v}%`;
      const ratio = v / d.limit;
      if (ratio < 0.75) { fill.style.background = 'var(--ok)'; face.textContent = '😊'; msg.textContent = 'เงียบดีมาก เยี่ยม!'; over = 0; }
      else if (ratio < 1) { fill.style.background = 'var(--warn)'; face.textContent = '😐'; msg.textContent = 'เริ่มดังแล้วนะ'; over = 0; }
      else {
        fill.style.background = 'var(--bad)'; face.textContent = '😱'; msg.textContent = 'เสียงดังเกินไป! เบาลงหน่อย';
        over++;
        const now = performance.now();
        if (d.alarm && over > 30 && now - lastAlarm > 3000) { lastAlarm = now; beep({ freq: 440, dur: 0.3, times: 2, type: 'triangle', vol: 0.2 }); }
      }
    }

    function stop() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
      ctx?.close().catch(() => {});
      stream = ctx = null;
      toggleBtn.textContent = '🎤 เริ่มวัดเสียง';
      fill.style.width = '0'; face.textContent = '🤫';
    }

    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'toggle') stream ? stop() : start();
      if (act === 'fs') toggleFullscreen(el.querySelector('#fs'));
    });
    el.querySelector('#limit').addEventListener('input', e => { d.limit = +e.target.value; setLimitLine(); save(); });
    el.querySelector('#alarm').addEventListener('change', e => { d.alarm = e.target.checked; save(); });
    return stop;
  },
};
