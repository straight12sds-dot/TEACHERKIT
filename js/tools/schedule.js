import { save, toolData } from '../store.js';
import { esc, pageHead, toast } from '../util.js';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
const DAY_COLORS = ['#facc15', '#f472b6', '#4ade80', '#fb923c', '#60a5fa']; // สีประจำวันแบบไทย
const DEFAULT_PERIODS = [
  ['08:30', '09:20'], ['09:20', '10:10'], ['10:10', '11:00'], ['11:00', '11:50'],
  ['12:40', '13:30'], ['13:30', '14:20'], ['14:20', '15:10'], ['15:10', '16:00'],
].map(([start, end]) => ({ start, end }));

const toMin = t => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export default {
  id: 'schedule',
  icon: '📅',
  title: 'ตารางสอน',
  desc: 'ตารางสอนรายสัปดาห์ บอกคาบที่กำลังสอนและคาบถัดไปแบบเรียลไทม์',
  render(el) {
    const d = toolData('schedule', { periods: DEFAULT_PERIODS.map(p => ({ ...p })), cells: {} });

    el.innerHTML = `
      ${pageHead('📅 ตารางสอน', `<button class="btn" data-act="addp">➕ เพิ่มคาบ</button><button class="btn" onclick="print()">🖨️ พิมพ์</button>`)}
      <div class="stats no-print" id="now" style="margin-bottom:14px"></div>
      <div class="card">
        <div class="table-wrap"><table class="tt" id="tt"></table></div>
        <p class="muted small no-print" style="margin:10px 0 0">คลิกในช่องเพื่อพิมพ์ เช่น "ค21101 ม.1/1 ห้อง 302" · แก้เวลาคาบที่หัวตารางได้</p>
      </div>`;

    const tt = el.querySelector('#tt');
    const key = (day, p) => `${day}-${p}`;

    function drawTable() {
      tt.innerHTML = `
        <thead><tr><th>วัน / คาบ</th>${d.periods.map((p, i) => `
          <th><div>คาบ ${i + 1}</div>
            <div class="row no-wrap"><input type="time" data-ps="${i}" value="${p.start}" aria-label="เริ่มคาบ ${i + 1}"><input type="time" data-pe="${i}" value="${p.end}" aria-label="จบคาบ ${i + 1}"></div>
            ${d.periods.length > 1 ? `<button class="btn btn-sm btn-ghost btn-danger" data-delp="${i}">ลบ</button>` : ''}
          </th>`).join('')}</tr></thead>
        <tbody>${DAYS.map((day, di) => `
          <tr><th style="border-left:6px solid ${DAY_COLORS[di]}">${day}</th>
            ${d.periods.map((_, pi) => `<td><textarea rows="2" data-cell="${key(di, pi)}" aria-label="${day} คาบ ${pi + 1}">${esc(d.cells[key(di, pi)] || '')}</textarea></td>`).join('')}
          </tr>`).join('')}</tbody>`;
      highlight();
    }

    function current() {
      const now = new Date();
      const di = now.getDay() - 1; // 0 = จันทร์
      const m = now.getHours() * 60 + now.getMinutes();
      if (di < 0 || di > 4) return { di, cur: -1, next: -1 };
      const order = d.periods.map((p, i) => ({ i, s: toMin(p.start), e: toMin(p.end) })).sort((a, b) => a.s - b.s);
      const cur = order.find(p => m >= p.s && m < p.e);
      const next = order.find(p => p.s > m && (d.cells[key(di, p.i)] || '').trim());
      return { di, m, cur: cur ? cur.i : -1, next: next ? next.i : -1, curEnd: cur?.e };
    }

    function highlight() {
      const { di, m, cur, next, curEnd } = current();
      tt.querySelectorAll('td').forEach(td => { td.style.background = ''; });
      if (cur >= 0) {
        const cell = tt.querySelector(`[data-cell="${key(di, cur)}"]`);
        if (cell) cell.parentElement.style.background = 'var(--primary-soft)';
      }
      const text = i => esc(d.cells[key(di, i)] || '') || '<span class="muted">ว่าง</span>';
      el.querySelector('#now').innerHTML = di < 0 || di > 4
        ? `<div class="stat"><b>🎉</b><span>วันหยุด ไม่มีคาบสอน</span></div>`
        : `<div class="stat"><span>ตอนนี้ (${DAYS[di]})</span><b style="font-size:1.2rem">${cur >= 0 ? `คาบ ${cur + 1}: ${text(cur)}` : 'นอกเวลาคาบ'}</b>${cur >= 0 ? `<span>เหลืออีก ${curEnd - m} นาที</span>` : ''}</div>
           <div class="stat"><span>คาบสอนถัดไป</span><b style="font-size:1.2rem">${next >= 0 ? `คาบ ${next + 1} (${d.periods[next].start}): ${text(next)}` : 'ไม่มีแล้ววันนี้'}</b></div>`;
    }

    el.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.cell) { d.cells[t.dataset.cell] = t.value; save(); highlight(); }
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.ps != null) { d.periods[+t.dataset.ps].start = t.value; save(); highlight(); }
      if (t.dataset.pe != null) { d.periods[+t.dataset.pe].end = t.value; save(); highlight(); }
    });
    el.addEventListener('click', e => {
      const del = e.target.closest('[data-delp]');
      if (del) {
        const i = +del.dataset.delp;
        if (!confirm(`ลบคาบ ${i + 1}?`)) return;
        d.periods.splice(i, 1);
        // เลื่อนข้อมูลของคาบที่อยู่หลังคาบที่ลบ
        const cells = {};
        for (const [k, v] of Object.entries(d.cells)) {
          const [di, pi] = k.split('-').map(Number);
          if (pi === i) continue;
          cells[key(di, pi > i ? pi - 1 : pi)] = v;
        }
        d.cells = cells; save(); drawTable(); return;
      }
      if (e.target.closest('[data-act]')?.dataset.act === 'addp') {
        if (d.periods.length >= 12) { toast('เพิ่มได้สูงสุด 12 คาบ'); return; }
        const last = d.periods[d.periods.length - 1];
        const s = last ? toMin(last.end) : 510;
        const f = x => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
        d.periods.push({ start: f(s), end: f(s + 50) }); save(); drawTable();
      }
    });

    drawTable();
    const iv = setInterval(highlight, 30000);
    return () => clearInterval(iv);
  },
};
