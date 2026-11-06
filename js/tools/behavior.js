import { save, currentClass, toolData } from '../store.js';
import { esc, pageHead, noStudents, beep, download, toCSV, todayISO, toast } from '../util.js';

const DEFAULT_REASONS = [
  { t: 'ตั้งใจเรียน', v: 1 }, { t: 'ตอบคำถาม', v: 1 }, { t: 'ช่วยเหลือเพื่อน', v: 1 },
  { t: 'ส่งงานตรงเวลา', v: 1 }, { t: 'จิตอาสา', v: 2 },
  { t: 'คุยเสียงดัง', v: -1 }, { t: 'มาสาย', v: -1 }, { t: 'ไม่ส่งงาน', v: -1 }, { t: 'ใช้มือถือในห้อง', v: -1 },
];

export default {
  id: 'behavior',
  icon: '⭐',
  title: 'คะแนนพฤติกรรม',
  desc: 'ให้ดาว/หักคะแนนรายคนพร้อมเหตุผล ใช้ประกอบคุณลักษณะอันพึงประสงค์',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('⭐ คะแนนพฤติกรรม') + noStudents(); return; }
    const all = toolData('behavior', {});
    all.reasons = all.reasons || DEFAULT_REASONS.map(r => ({ ...r }));
    all[c.id] = all[c.id] || { log: [] };
    const d = all[c.id];
    let reason = 0, sort = 'no';

    el.innerHTML = `
      ${pageHead('⭐ คะแนนพฤติกรรม', `
        <button class="btn" data-act="undo">↶ ย้อนกลับ</button>
        <button class="btn" data-act="csv">📊 ส่งออก CSV</button>
        <button class="btn btn-danger" data-act="reset">รีเซ็ต</button>`)}
      <div class="card stack" style="margin-bottom:14px">
        <div class="muted small">1) เลือกพฤติกรรม แล้ว 2) คลิกชื่อนักเรียน</div>
        <div class="chips" id="reasons"></div>
        <div class="row">
          <input id="newR" placeholder="เพิ่มพฤติกรรมใหม่" style="flex:1;min-width:140px">
          <input id="newV" type="number" value="1" aria-label="คะแนน">
          <button class="btn btn-sm" data-act="addr">เพิ่ม</button>
          <select id="sort" style="margin-left:auto"><option value="no">เรียงตามเลขที่</option><option value="hi">คะแนนมาก→น้อย</option><option value="lo">คะแนนน้อย→มาก</option></select>
        </div>
      </div>
      <div class="groups" id="cards"></div>
      <div class="card" style="margin-top:14px"><h2>ประวัติล่าสุด</h2><ul class="list" id="log"></ul></div>`;

    const total = sid => d.log.reduce((a, x) => a + (x.sid === sid ? x.v : 0), 0);

    function drawReasons() {
      el.querySelector('#reasons').innerHTML = all.reasons.map((r, i) => `
        <button class="chip" data-r="${i}" style="border:2px solid ${i === reason ? 'var(--primary)' : 'transparent'};cursor:pointer;font:inherit;color:${r.v > 0 ? 'var(--ok)' : 'var(--bad)'}">
          ${r.v > 0 ? '+' : ''}${r.v} ${esc(r.t)}</button>`).join('');
    }
    function drawCards() {
      let list = c.students.map((s, i) => ({ s, i, p: total(s.id) }));
      if (sort === 'hi') list.sort((a, b) => b.p - a.p);
      if (sort === 'lo') list.sort((a, b) => a.p - b.p);
      el.querySelector('#cards').innerHTML = list.map(({ s, i, p }) => `
        <button class="group" data-sid="${s.id}" style="--c:${p > 0 ? 'var(--ok)' : p < 0 ? 'var(--bad)' : 'var(--border)'};cursor:pointer;font:inherit;color:inherit;text-align:left">
          <div class="row between"><span><span class="num">${i + 1}</span> ${esc(s.name)}</span>
          <b style="font-size:1.4rem;color:${p > 0 ? 'var(--ok)' : p < 0 ? 'var(--bad)' : 'var(--muted)'}">${p > 0 ? '+' : ''}${p}</b></div>
        </button>`).join('');
    }
    function drawLog() {
      const byId = new Map(c.students.map(s => [s.id, s.name]));
      const items = d.log.slice(-15).reverse();
      el.querySelector('#log').innerHTML = items.length ? items.map(x => `
        <li><span class="muted small">${new Date(x.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
        <span style="flex:1">${esc(byId.get(x.sid) || '(ลบแล้ว)')} — ${esc(x.t)}</span>
        <b style="color:${x.v > 0 ? 'var(--ok)' : 'var(--bad)'}">${x.v > 0 ? '+' : ''}${x.v}</b></li>`).join('') : '<li class="muted">ยังไม่มีประวัติ</li>';
    }
    const draw = () => { drawReasons(); drawCards(); drawLog(); };

    el.addEventListener('click', e => {
      const r = e.target.closest('[data-r]');
      if (r) { reason = +r.dataset.r; drawReasons(); return; }
      const card = e.target.closest('[data-sid]');
      if (card) {
        const R = all.reasons[reason];
        if (!R) return;
        d.log.push({ sid: card.dataset.sid, v: R.v, t: R.t, at: Date.now() });
        if (d.log.length > 5000) d.log.splice(0, d.log.length - 5000);
        beep({ freq: R.v > 0 ? 990 : 300, dur: 0.1, vol: 0.12 });
        save(); drawCards(); drawLog(); return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'undo') { if (d.log.pop()) { save(); drawCards(); drawLog(); } else toast('ไม่มีรายการให้ย้อน'); }
      if (act === 'reset' && confirm('ลบคะแนนพฤติกรรมทั้งหมดของห้องนี้?')) { d.log = []; save(); draw(); }
      if (act === 'addr') {
        const t = el.querySelector('#newR').value.trim();
        const v = Math.trunc(+el.querySelector('#newV').value) || 1;
        if (!t) return;
        all.reasons.push({ t, v }); reason = all.reasons.length - 1;
        el.querySelector('#newR').value = '';
        save(); drawReasons();
      }
      if (act === 'csv') {
        const reasons = [...new Set(d.log.map(x => x.t))];
        const rows = [['เลขที่', 'ชื่อ-สกุล', ...reasons, 'คะแนนรวม'],
          ...c.students.map((s, i) => [i + 1, s.name,
            ...reasons.map(t => d.log.filter(x => x.sid === s.id && x.t === t).reduce((a, x) => a + x.v, 0)),
            total(s.id)])];
        download(`พฤติกรรม-${c.name}-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      }
    });
    el.querySelector('#sort').addEventListener('change', e => { sort = e.target.value; drawCards(); });
    draw();
  },
};
