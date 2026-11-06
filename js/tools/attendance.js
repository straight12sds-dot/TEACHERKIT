import { state, save, currentClass } from '../store.js';
import { esc, pageHead, noStudents, todayISO, thaiDate, download, toCSV, toast } from '../util.js';

const STATUS = [
  { k: 'P', label: 'มา', full: 'มาเรียน' },
  { k: 'L', label: 'สาย', full: 'มาสาย' },
  { k: 'E', label: 'ลา', full: 'ลา' },
  { k: 'A', label: 'ขาด', full: 'ขาดเรียน' },
];

export default {
  id: 'attendance',
  icon: '✅',
  title: 'เช็คชื่อเข้าเรียน',
  desc: 'บันทึก มา/สาย/ลา/ขาด รายวัน สรุปผล และส่งออกเป็น Excel',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('✅ เช็คชื่อเข้าเรียน') + noStudents(); return; }
    state.attendance[c.id] = state.attendance[c.id] || {};
    const book = state.attendance[c.id];
    let date = todayISO();

    el.innerHTML = `
      ${pageHead('✅ เช็คชื่อเข้าเรียน', `<button class="btn" data-act="csv">📊 ส่งออก Excel (CSV)</button>`)}
      <div class="grid grid-2">
        <div class="card stack">
          <div class="row between">
            <input type="date" id="date" value="${date}">
            <div class="row">
              <button class="btn btn-sm" data-act="all">✓ มาครบทุกคน</button>
              <button class="btn btn-sm btn-danger" data-act="clear">ล้างวันนี้</button>
            </div>
          </div>
          <div class="muted small" id="dlabel"></div>
          <div id="rows"></div>
        </div>
        <div class="stack">
          <div class="card stack">
            <h2>สรุปวันนี้</h2>
            <div class="stats" id="today"></div>
          </div>
          <div class="card stack">
            <h2>สรุปทั้งภาคเรียน <span class="muted small" id="days"></span></h2>
            <div class="table-wrap"><table id="summary"></table></div>
          </div>
        </div>
      </div>`;

    const rowsEl = el.querySelector('#rows');

    function drawRows() {
      const day = book[date] || {};
      el.querySelector('#dlabel').textContent = thaiDate(date);
      rowsEl.innerHTML = c.students.map((s, i) => `
        <div class="att-row">
          <span class="num">${i + 1}</span>
          <span>${esc(s.name)}</span>
          <div class="seg" data-sid="${s.id}">
            ${STATUS.map(st => `<button data-s="${st.k}" class="${day[s.id] === st.k ? 'on' : ''}" aria-pressed="${day[s.id] === st.k}">${st.label}</button>`).join('')}
          </div>
        </div>`).join('');
    }

    function drawStats() {
      const day = book[date] || {};
      const count = k => c.students.filter(s => day[s.id] === k).length;
      const none = c.students.filter(s => !day[s.id]).length;
      el.querySelector('#today').innerHTML =
        STATUS.map(st => `<div class="stat"><b>${count(st.k)}</b><span>${st.full}</span></div>`).join('') +
        `<div class="stat"><b>${none}</b><span>ยังไม่เช็ค</span></div>`;

      const dates = Object.keys(book).filter(dt => Object.keys(book[dt]).length).sort();
      el.querySelector('#days').textContent = `(${dates.length} วันที่บันทึก)`;
      el.querySelector('#summary').innerHTML = `
        <thead><tr><th>#</th><th>ชื่อ</th>${STATUS.map(st => `<th>${st.label}</th>`).join('')}<th>% มาเรียน</th></tr></thead>
        <tbody>${c.students.map((s, i) => {
          const n = Object.fromEntries(STATUS.map(st => [st.k, dates.filter(dt => book[dt][s.id] === st.k).length]));
          const checked = STATUS.reduce((a, st) => a + n[st.k], 0);
          const pct = checked ? Math.round(((n.P + n.L) / checked) * 100) : null;
          const warn = pct !== null && pct < 80;
          return `<tr><td class="num">${i + 1}</td><td>${esc(s.name)}</td>${STATUS.map(st => `<td>${n[st.k]}</td>`).join('')}
            <td style="${warn ? 'color:var(--bad);font-weight:600' : ''}">${pct === null ? '-' : pct + '%'}${warn ? ' ⚠️' : ''}</td></tr>`;
        }).join('')}</tbody>`;
    }

    const draw = () => { drawRows(); drawStats(); };

    el.addEventListener('click', e => {
      const btn = e.target.closest('.seg button');
      if (btn) {
        const sid = btn.parentElement.dataset.sid;
        book[date] = book[date] || {};
        if (book[date][sid] === btn.dataset.s) delete book[date][sid];
        else book[date][sid] = btn.dataset.s;
        save();
        btn.parentElement.querySelectorAll('button').forEach(b => {
          const on = book[date][sid] === b.dataset.s;
          b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
        });
        drawStats();
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'all') {
        book[date] = book[date] || {};
        c.students.forEach(s => { if (!book[date][s.id]) book[date][s.id] = 'P'; });
        save(); draw(); toast('ทำเครื่องหมาย "มา" ให้คนที่ยังไม่เช็คแล้ว');
      }
      if (act === 'clear' && confirm(`ล้างการเช็คชื่อของ ${thaiDate(date)}?`)) { delete book[date]; save(); draw(); }
      if (act === 'csv') {
        const dates = Object.keys(book).filter(dt => Object.keys(book[dt]).length).sort();
        const label = Object.fromEntries(STATUS.map(st => [st.k, st.label]));
        const rows = [
          ['เลขที่', 'ชื่อ-สกุล', ...dates, ...STATUS.map(st => `รวม${st.label}`)],
          ...c.students.map((s, i) => [
            i + 1, s.name,
            ...dates.map(dt => label[book[dt][s.id]] || ''),
            ...STATUS.map(st => dates.filter(dt => book[dt][s.id] === st.k).length),
          ]),
        ];
        download(`เช็คชื่อ-${c.name}-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      }
    });
    el.querySelector('#date').addEventListener('change', e => { date = e.target.value || todayISO(); draw(); });
    draw();
  },
};
