import { state, save, currentClass, toolData } from '../store.js';
import { esc, pageHead, noStudents, download, toCSV, todayISO, toast } from '../util.js';

const THAI = 'กขคงจ';
const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ'];

// รับได้ทั้ง 1234 / กขคง / abcd · ช่องว่าง , ไม่นับ · อักขระอื่น (เช่น - หรือ .) = ไม่ตอบ
export function normalize(s) {
  return [...String(s || '').replace(/[\s,]/g, '')].map(ch => {
    if (/[1-5]/.test(ch)) return ch;
    const t = THAI.indexOf(ch); if (t >= 0) return String(t + 1);
    const a = 'abcde'.indexOf(ch.toLowerCase()); if (a >= 0) return String(a + 1);
    return '-';
  }).join('');
}

// วิเคราะห์ข้อสอบแบบกลุ่มสูง-กลุ่มต่ำ (27% หรือครึ่งหนึ่งถ้ามีผู้สอบน้อยกว่า 20 คน)
export function analyze(key, rows) {
  const scored = rows.map(r => ({ ...r, score: [...key].reduce((a, k, i) => a + (r.ans[i] === k ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const N = scored.length;
  const g = N >= 20 ? Math.round(N * 0.27) : Math.floor(N / 2);
  const hi = scored.slice(0, g), lo = g ? scored.slice(-g) : [];
  const items = [...key].map((k, i) => {
    const H = hi.filter(r => r.ans[i] === k).length;
    const L = lo.filter(r => r.ans[i] === k).length;
    const p = g ? (H + L) / (2 * g) : null;
    const r = g ? (H - L) / g : null;
    const dist = [1, 2, 3, 4, 5].map(c => scored.filter(x => x.ans[i] === String(c)).length);
    let verdict = '-';
    if (p !== null) {
      if (r < 0) verdict = '❌ ตรวจเฉลย/ตัดทิ้ง';
      else if (p >= 0.2 && p <= 0.8 && r >= 0.2) verdict = '✅ ใช้ได้';
      else verdict = '⚠️ ควรปรับปรุง';
    }
    return { i, k, p, r, dist, correct: scored.filter(x => x.ans[i] === k).length, verdict };
  });
  return { scored, items, g };
}

export default {
  id: 'exam',
  icon: '🧮',
  title: 'ตรวจข้อสอบ & วิเคราะห์ข้อสอบ',
  desc: 'ใส่เฉลยและคำตอบนักเรียน ได้คะแนนทันที พร้อมค่าความยาก (p) อำนาจจำแนก (r)',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('🧮 ตรวจข้อสอบ & วิเคราะห์ข้อสอบ') + noStudents(); return; }
    const all = toolData('exam', {});
    all[c.id] = all[c.id] || { name: '', key: '', choices: 4, ans: {} };
    const d = all[c.id];

    el.innerHTML = `
      ${pageHead('🧮 ตรวจข้อสอบ & วิเคราะห์ข้อสอบ', `
        <button class="btn" data-act="grades">➡️ ส่งคะแนนไปหน้าคำนวณเกรด</button>
        <button class="btn" data-act="csv">📊 ส่งออก CSV</button>`)}
      <div class="card stack" style="margin-bottom:14px">
        <div class="row">
          <input id="ename" placeholder="ชื่อข้อสอบ เช่น สอบกลางภาค" value="${esc(d.name)}" style="flex:1;min-width:160px">
          <label>ตัวเลือก <select id="choices">${[2, 3, 4, 5].map(n => `<option ${d.choices === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <div class="field">
          <label for="key">เฉลย (พิมพ์ต่อกันได้เลย เช่น <b>1324</b> หรือ <b>กคขง</b>)</label>
          <input id="key" value="${esc(d.key)}" style="font-family:monospace;letter-spacing:2px" autocomplete="off">
          <span class="muted small" id="keyinfo"></span>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card stack">
          <h2>คำตอบนักเรียน</h2>
          <p class="muted small" style="margin:0">พิมพ์คำตอบเรียงข้อ ใช้ <b>-</b> แทนข้อที่ไม่ตอบ กด Enter เพื่อไปคนถัดไป</p>
          <div id="rows"></div>
        </div>
        <div class="stack">
          <div class="card stack"><h2>สถิติ</h2><div class="stats" id="stats"></div></div>
          <div class="card stack">
            <h2>วิเคราะห์รายข้อ</h2>
            <p class="muted small" style="margin:0">p = ค่าความยาก (0.20–0.80 เหมาะสม) · r = อำนาจจำแนก (≥ 0.20 ใช้ได้) · <span id="ginfo"></span></p>
            <div class="table-wrap"><table id="items"></table></div>
          </div>
        </div>
      </div>`;

    const $ = s => el.querySelector(s);
    const key = () => normalize(d.key);
    const rowsWithAns = () => c.students.filter(s => (d.ans[s.id] || '').trim()).map(s => ({ s, ans: normalize(d.ans[s.id]) }));
    const scoreOf = ans => [...key()].reduce((a, k, i) => a + (ans[i] === k ? 1 : 0), 0);

    function drawRows() {
      $('#rows').innerHTML = c.students.map((s, i) => `
        <div class="att-row" style="grid-template-columns:2.5ch minmax(0,1fr) minmax(0,1.3fr) 5ch">
          <span class="num">${i + 1}</span><span>${esc(s.name)}</span>
          <input data-sid="${s.id}" value="${esc(d.ans[s.id] || '')}" style="font-family:monospace;letter-spacing:2px;min-width:0" autocomplete="off" aria-label="คำตอบ ${esc(s.name)}">
          <b data-score="${s.id}" style="text-align:right"></b>
        </div>`).join('');
    }

    function update() {
      const k = key();
      const bad = [...k].filter(x => x === '-' || +x > d.choices).length;
      $('#keyinfo').innerHTML = k.length ? `${k.length} ข้อ${bad ? ` · <b style="color:var(--bad)">มี ${bad} ข้อที่เฉลยไม่ถูกต้อง</b>` : ''}` : 'ยังไม่ได้ใส่เฉลย';
      el.querySelectorAll('[data-score]').forEach(b => {
        const raw = d.ans[b.dataset.score] || '';
        if (!raw.trim() || !k.length) { b.textContent = ''; return; }
        const a = normalize(raw);
        b.textContent = scoreOf(a);
        const inp = el.querySelector(`input[data-sid="${b.dataset.score}"]`);
        inp.style.borderColor = a.length !== k.length ? 'var(--warn)' : '';
        inp.title = a.length !== k.length ? `ตอบ ${a.length} ข้อ แต่เฉลยมี ${k.length} ข้อ` : '';
      });
      const rows = rowsWithAns();
      if (!k.length || !rows.length) { $('#stats').innerHTML = '<div class="muted">ใส่เฉลยและคำตอบเพื่อดูผล</div>'; $('#items').innerHTML = ''; $('#ginfo').textContent = ''; return; }
      const { scored, items, g } = analyze(k, rows);
      const sc = scored.map(x => x.score);
      const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
      const sd = Math.sqrt(sc.reduce((a, b) => a + (b - mean) ** 2, 0) / sc.length);
      $('#stats').innerHTML = `
        <div class="stat"><b>${sc.length}</b><span>ผู้สอบ</span></div>
        <div class="stat"><b>${mean.toFixed(2)}</b><span>เฉลี่ย (เต็ม ${k.length})</span></div>
        <div class="stat"><b>${sd.toFixed(2)}</b><span>S.D.</span></div>
        <div class="stat"><b>${Math.max(...sc)} / ${Math.min(...sc)}</b><span>สูงสุด / ต่ำสุด</span></div>`;
      $('#ginfo').textContent = g ? `กลุ่มสูง/ต่ำ กลุ่มละ ${g} คน` : 'ต้องมีผู้สอบอย่างน้อย 2 คน';
      const ch = Array.from({ length: d.choices }, (_, i) => i);
      $('#items').innerHTML = `
        <thead><tr><th>ข้อ</th><th>เฉลย</th>${ch.map(i => `<th>${LETTERS[i]}</th>`).join('')}<th>p</th><th>r</th><th>ผล</th></tr></thead>
        <tbody>${items.map(it => `<tr>
          <td>${it.i + 1}</td><td><b>${LETTERS[+it.k - 1] || '?'}</b></td>
          ${ch.map(i => `<td style="${String(i + 1) === it.k ? 'color:var(--ok);font-weight:700' : ''}">${it.dist[i]}</td>`).join('')}
          <td>${it.p === null ? '-' : it.p.toFixed(2)}</td><td>${it.r === null ? '-' : it.r.toFixed(2)}</td><td class="small">${it.verdict}</td>
        </tr>`).join('')}</tbody>`;
    }

    el.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.sid) d.ans[t.dataset.sid] = t.value;
      else if (t.id === 'key') d.key = t.value;
      else if (t.id === 'ename') d.name = t.value;
      else return;
      save(); update();
    });
    el.addEventListener('change', e => { if (e.target.id === 'choices') { d.choices = +e.target.value; save(); update(); } });
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.dataset.sid) return;
      e.preventDefault();
      e.target.closest('.att-row').nextElementSibling?.querySelector('input')?.focus();
    });
    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const k = key();
      if ((act === 'csv' || act === 'grades') && (!k.length || !rowsWithAns().length)) { toast('ใส่เฉลยและคำตอบก่อน'); return; }
      if (act === 'csv') {
        const rows = [['เลขที่', 'ชื่อ-สกุล', 'คำตอบ', `คะแนน (${k.length})`],
          ...c.students.map((s, i) => { const raw = (d.ans[s.id] || '').trim(); return [i + 1, s.name, raw ? normalize(raw) : '', raw ? scoreOf(normalize(raw)) : '']; }),
          [], ['ข้อ', 'เฉลย', 'p', 'r', 'ผล'],
          ...analyze(k, rowsWithAns()).items.map(it => [it.i + 1, LETTERS[+it.k - 1] || '', it.p?.toFixed(2) ?? '', it.r?.toFixed(2) ?? '', it.verdict.replace(/^\S+\s/, '')])];
        download(`ตรวจข้อสอบ-${d.name || 'ข้อสอบ'}-${c.name}-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      }
      if (act === 'grades') {
        const name = d.name || 'ข้อสอบ';
        if (!confirm(`เพิ่มช่อง "${name}" (เต็ม ${k.length}) พร้อมคะแนนลงในหน้าคำนวณเกรดของ ${c.name}?`)) return;
        const g = state.grades[c.id] = state.grades[c.id] || {};
        g.parts = g.parts || [];
        g.scores = g.scores || {};
        g.parts.push({ name, max: k.length });
        const j = g.parts.length - 1;
        c.students.forEach(s => {
          const raw = (d.ans[s.id] || '').trim();
          if (!raw) return;
          g.scores[s.id] = g.scores[s.id] || [];
          g.scores[s.id][j] = scoreOf(normalize(raw));
        });
        save(); toast('ส่งคะแนนแล้ว ✓ ดูได้ที่ "คำนวณเกรด"');
      }
    });

    drawRows(); update();
  },
};
