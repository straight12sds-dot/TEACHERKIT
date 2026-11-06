import { state, save, currentClass } from '../store.js';
import { esc, pageHead, noStudents, shuffle, toast } from '../util.js';

export default {
  id: 'seating',
  icon: '🪑',
  title: 'ผังที่นั่ง',
  desc: 'สุ่มจัดที่นั่ง คลิกสลับที่ได้ พิมพ์ติดหน้าห้อง',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('🪑 ผังที่นั่ง') + noStudents(); return; }

    const guessCols = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(c.students.length * 1.4))));
    state.seating[c.id] = state.seating[c.id] || { rows: Math.ceil(c.students.length / guessCols), cols: guessCols, seats: [] };
    const d = state.seating[c.id];
    const byId = new Map(c.students.map(s => [s.id, s]));
    let selected = null;

    el.innerHTML = `
      ${pageHead(`🪑 ผังที่นั่ง · ${esc(c.name)}`, `<button class="btn" onclick="print()">🖨️ พิมพ์</button>`)}
      <div class="card row no-print" style="margin-bottom:14px">
        <label>แถว <input type="number" id="rows" min="1" max="20" value="${d.rows}"></label>
        <label>คอลัมน์ <input type="number" id="cols" min="1" max="12" value="${d.cols}"></label>
        <button class="btn btn-primary" data-act="shuffle">🔀 สุ่มที่นั่ง</button>
        <button class="btn" data-act="order">เรียงตามเลขที่</button>
        <span class="muted small">คลิกที่นั่ง 2 ที่เพื่อสลับกัน</span>
      </div>
      <div class="card">
        <div class="board">กระดาน / หน้าห้อง</div>
        <div class="seats" id="seats"></div>
      </div>`;

    const seatsEl = el.querySelector('#seats');

    function normalize() {
      const n = d.rows * d.cols;
      // ตัดนักเรียนที่ถูกลบออก และเติมนักเรียนใหม่ที่ยังไม่มีที่นั่ง
      d.seats = d.seats.slice(0, n).map(id => (id && byId.has(id) ? id : null));
      while (d.seats.length < n) d.seats.push(null);
      const seated = new Set(d.seats.filter(Boolean));
      const missing = c.students.filter(s => !seated.has(s.id));
      for (const s of missing) {
        const i = d.seats.indexOf(null);
        if (i === -1) break;
        d.seats[i] = s.id;
      }
      return missing.length - d.seats.filter(x => x === null).length;
    }

    function draw() {
      const notFit = c.students.length - d.seats.filter(Boolean).length;
      seatsEl.style.gridTemplateColumns = `repeat(${d.cols}, minmax(70px, 1fr))`;
      seatsEl.innerHTML = d.seats.map((id, i) => {
        const s = id && byId.get(id);
        return `<div class="seat ${s ? '' : 'empty'} ${selected === i ? 'sel' : ''}" data-i="${i}" role="button" tabindex="0">${s ? `<span><span class="muted small">${c.students.indexOf(s) + 1}</span><br>${esc(s.name)}</span>` : 'ว่าง'}</div>`;
      }).join('');
      if (notFit > 0) toast(`ที่นั่งไม่พอ ขาดอีก ${notFit} ที่ — เพิ่มแถวหรือคอลัมน์`);
    }

    function fill(list) {
      d.seats = Array(d.rows * d.cols).fill(null);
      list.slice(0, d.seats.length).forEach((s, i) => { d.seats[i] = s.id; });
      selected = null; save(); draw();
    }

    el.addEventListener('click', e => {
      const seat = e.target.closest('.seat');
      if (seat) {
        const i = +seat.dataset.i;
        if (selected === null) selected = i;
        else { [d.seats[selected], d.seats[i]] = [d.seats[i], d.seats[selected]]; selected = null; save(); }
        draw(); return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'shuffle') fill(shuffle(c.students));
      if (act === 'order') fill(c.students);
    });
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('seat')) { e.preventDefault(); e.target.click(); } });
    el.addEventListener('change', e => {
      if (e.target.id === 'rows') d.rows = Math.max(1, Math.min(20, +e.target.value || 1));
      if (e.target.id === 'cols') d.cols = Math.max(1, Math.min(12, +e.target.value || 1));
      if (e.target.id === 'rows' || e.target.id === 'cols') { normalize(); save(); draw(); }
    });

    normalize(); save(); draw();
  },
};
