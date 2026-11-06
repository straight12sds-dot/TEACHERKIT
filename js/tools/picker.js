import { save, currentClass, toolData } from '../store.js';
import { esc, pageHead, noStudents, randInt, pick, beep, toggleFullscreen } from '../util.js';

export default {
  id: 'picker',
  icon: '🎯',
  title: 'สุ่มชื่อนักเรียน',
  desc: 'สุ่มเรียกชื่อแบบลุ้น ๆ เลือกไม่ให้ซ้ำคนเดิมได้',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('🎯 สุ่มชื่อนักเรียน') + noStudents(); return; }

    const data = toolData('picker', {});
    data[c.id] = data[c.id] || { used: [], noRepeat: true, sound: true };
    const d = data[c.id];
    const valid = new Set(c.students.map(s => s.id));
    d.used = d.used.filter(id => valid.has(id));
    let timer = null;

    el.innerHTML = `
      ${pageHead('🎯 สุ่มชื่อนักเรียน', `<button class="btn" data-act="fs">⛶ เต็มจอ</button>`)}
      <div class="stack">
        <div class="fs-target stack" id="fs">
          <div class="stage"><div class="big-name" id="name">กดปุ่มเพื่อสุ่ม</div></div>
          <div class="row" style="justify-content:center">
            <button class="btn btn-primary btn-lg" data-act="spin">🎲 สุ่มเลย! <span class="muted small" style="color:inherit;opacity:.8">(Space)</span></button>
          </div>
        </div>
        <div class="card stack">
          <div class="row between">
            <div class="row">
              <label class="check"><input type="checkbox" id="norep" ${d.noRepeat ? 'checked' : ''}> ไม่สุ่มซ้ำคนเดิม</label>
              <label class="check"><input type="checkbox" id="sound" ${d.sound ? 'checked' : ''}> เสียง</label>
            </div>
            <div class="row">
              <span class="muted small" id="left"></span>
              <button class="btn btn-sm" data-act="reset">↺ เริ่มรอบใหม่</button>
            </div>
          </div>
          <div class="chips" id="chips"></div>
        </div>
      </div>`;

    const nameEl = el.querySelector('#name');
    const drawChips = () => {
      const used = new Set(d.used);
      el.querySelector('#chips').innerHTML = c.students.map(s => `<span class="chip ${used.has(s.id) ? 'used' : ''}">${esc(s.name)}</span>`).join('');
      el.querySelector('#left').textContent = d.noRepeat ? `เหลือ ${c.students.length - d.used.length} / ${c.students.length} คน` : '';
    };

    function spin() {
      if (timer) return;
      let pool = d.noRepeat ? c.students.filter(s => !d.used.includes(s.id)) : c.students;
      if (!pool.length) { d.used = []; pool = c.students; }
      const winner = pool[randInt(0, pool.length - 1)];
      nameEl.className = 'big-name spinning';
      let i = 0;
      const steps = 22;
      const tick = () => {
        i++;
        if (i < steps) {
          nameEl.textContent = pick(c.students).name;
          if (d.sound) beep({ freq: 500 + i * 15, dur: 0.03, vol: 0.08 });
          timer = setTimeout(tick, 40 + i * i * 0.4);
        } else {
          timer = null;
          nameEl.textContent = winner.name;
          nameEl.className = 'big-name win';
          if (d.sound) beep({ freq: 1046, dur: 0.18, times: 2, gap: 0.05 });
          if (d.noRepeat) d.used.push(winner.id);
          save(); drawChips();
        }
      };
      tick();
    }

    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'spin') spin();
      if (act === 'reset') { d.used = []; save(); drawChips(); nameEl.className = 'big-name'; nameEl.textContent = 'กดปุ่มเพื่อสุ่ม'; }
      if (act === 'fs') toggleFullscreen(el.querySelector('#fs'));
    });
    el.querySelector('#norep').addEventListener('change', e => { d.noRepeat = e.target.checked; save(); drawChips(); });
    el.querySelector('#sound').addEventListener('change', e => { d.sound = e.target.checked; save(); });
    const onKey = e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); spin(); } };
    document.addEventListener('keydown', onKey);
    drawChips();
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  },
};
