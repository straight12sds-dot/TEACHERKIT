import { pageHead, beep, toggleFullscreen } from '../util.js';

const fmt = ms => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};
const fmtSw = ms => {
  const t = Math.floor(ms / 10);
  const m = Math.floor(t / 6000), s = Math.floor((t % 6000) / 100), cs = t % 100;
  const p = n => String(n).padStart(2, '0');
  return `${p(m)}:${p(s)}.${p(cs)}`;
};

export default {
  id: 'timer',
  icon: '⏱️',
  title: 'จับเวลา',
  desc: 'นับถอยหลังพร้อมเสียงเตือน และนาฬิกาจับเวลา เต็มจอได้',
  render(el) {
    let mode = 'down';
    let total = 5 * 60 * 1000;   // เวลาที่ตั้ง
    let remain = total;          // เวลาที่เหลือ (นับถอยหลัง) / เวลาที่ผ่าน (จับเวลา)
    let elapsed = 0;
    let startAt = 0, running = false, iv = 0;

    el.innerHTML = `
      ${pageHead('⏱️ จับเวลา', `<button class="btn" data-act="fs">⛶ เต็มจอ</button>`)}
      <div class="card stack fs-target" id="fs">
        <div class="row" style="justify-content:center">
          <div class="seg" id="modes">
            <button data-mode="down" class="on" data-s="P">⏳ นับถอยหลัง</button>
            <button data-mode="up" data-s="P">⏱️ จับเวลา</button>
          </div>
        </div>
        <div style="text-align:center"><div class="big-time" id="time">05:00</div></div>
        <div class="progress" id="prog"><div style="width:100%"></div></div>
        <div class="row" style="justify-content:center">
          <button class="btn btn-primary btn-lg" data-act="toggle" id="toggle">▶ เริ่ม</button>
          <button class="btn btn-lg" data-act="reset">↺ รีเซ็ต</button>
        </div>
        <div id="setup" class="stack">
          <div class="row" style="justify-content:center">
            ${[1, 2, 3, 5, 10, 15, 20, 30].map(m => `<button class="btn" data-min="${m}">${m} นาที</button>`).join('')}
          </div>
          <div class="row" style="justify-content:center">
            <label>กำหนดเอง:</label>
            <input type="number" id="mm" min="0" max="999" value="5" aria-label="นาที"> นาที
            <input type="number" id="ss" min="0" max="59" value="0" aria-label="วินาที"> วินาที
            <button class="btn" data-act="set">ตั้งเวลา</button>
          </div>
        </div>
      </div>`;

    const timeEl = el.querySelector('#time');
    const bar = el.querySelector('#prog > div');
    const toggleBtn = el.querySelector('#toggle');

    function paint() {
      if (mode === 'down') {
        const left = running ? remain - (performance.now() - startAt) : remain;
        timeEl.textContent = fmt(left);
        bar.style.width = `${total ? Math.max(0, left / total) * 100 : 0}%`;
        timeEl.classList.toggle('ending', left <= 10000 && left > 0);
        if (running && left <= 0) finish();
      } else {
        const e = running ? elapsed + (performance.now() - startAt) : elapsed;
        timeEl.textContent = fmtSw(e);
      }
    }
    // ใช้ setInterval แทน requestAnimationFrame เพื่อให้เสียงเตือนดังแม้สลับไปแท็บอื่น
    function loop() { clearInterval(iv); paint(); iv = setInterval(paint, mode === 'up' ? 31 : 100); }

    function finish() {
      running = false; remain = 0;
      clearInterval(iv);
      timeEl.textContent = '00:00';
      timeEl.classList.remove('ending'); timeEl.classList.add('done');
      toggleBtn.textContent = '▶ เริ่ม';
      beep({ freq: 880, dur: 0.25, times: 4, gap: 0.15, type: 'square', vol: 0.15 });
    }

    function start() {
      if (mode === 'down' && remain <= 0) return;
      running = true; startAt = performance.now();
      timeEl.classList.remove('done');
      toggleBtn.textContent = '⏸ หยุด';
      beep({ freq: 660, dur: 0.06, vol: 0.1 });
      loop();
    }
    function pause() {
      if (!running) return;
      const dt = performance.now() - startAt;
      if (mode === 'down') remain = Math.max(0, remain - dt); else elapsed += dt;
      running = false; clearInterval(iv);
      toggleBtn.textContent = '▶ ต่อ';
      paint();
    }
    function reset() {
      running = false; clearInterval(iv);
      remain = total; elapsed = 0;
      timeEl.classList.remove('done', 'ending');
      toggleBtn.textContent = '▶ เริ่ม';
      paint();
    }
    function setTime(ms) { total = Math.max(1000, ms); reset(); }

    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.min) setTime(+b.dataset.min * 60000);
      if (b.dataset.mode) {
        mode = b.dataset.mode;
        el.querySelectorAll('#modes button').forEach(x => x.classList.toggle('on', x === b));
        el.querySelector('#setup').hidden = mode === 'up';
        el.querySelector('#prog').style.visibility = mode === 'up' ? 'hidden' : 'visible';
        reset();
      }
      const act = b.dataset.act;
      if (act === 'toggle') running ? pause() : start();
      if (act === 'reset') reset();
      if (act === 'set') setTime(((+el.querySelector('#mm').value || 0) * 60 + (+el.querySelector('#ss').value || 0)) * 1000);
      if (act === 'fs') toggleFullscreen(el.querySelector('#fs'));
    });

    const onKey = e => {
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); running ? pause() : start(); }
      if (e.key === 'r' || e.key === 'R') reset();
    };
    document.addEventListener('keydown', onKey);
    paint();
    return () => { running = false; clearInterval(iv); document.removeEventListener('keydown', onKey); };
  },
};
