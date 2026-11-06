import { save, currentClass, toolData, uid } from '../store.js';
import { esc, pageHead, noStudents, download, toCSV, todayISO, thaiDate, copyText } from '../util.js';

const ST = [
  { k: 'S', label: 'ส่งแล้ว', icon: '✅', s: 'P' },
  { k: 'L', label: 'ส่งช้า', icon: '🕒', s: 'L' },
  { k: 'X', label: 'ยกเว้น', icon: '➖', s: 'E' },
];

export default {
  id: 'homework',
  icon: '📚',
  title: 'ติดตามการส่งงาน',
  desc: 'เช็คว่าใครส่งงาน/ค้างงาน คัดลอกรายชื่อคนค้างส่งไปแจ้งใน LINE ได้ทันที',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('📚 ติดตามการส่งงาน') + noStudents(); return; }
    const all = toolData('homework', {});
    all[c.id] = all[c.id] || { list: [], st: {} };
    const d = all[c.id];
    let cur = d.list[d.list.length - 1]?.id || null;

    el.innerHTML = `
      ${pageHead('📚 ติดตามการส่งงาน', `<button class="btn" data-act="csv">📊 ส่งออก CSV</button>`)}
      <div class="card row" style="margin-bottom:14px">
        <input id="hname" placeholder="ชื่องาน เช่น แบบฝึกหัดบทที่ 2" style="flex:1;min-width:180px">
        <label>กำหนดส่ง <input type="date" id="hdue" value="${todayISO()}"></label>
        <button class="btn btn-primary" data-act="add">➕ เพิ่มงาน</button>
      </div>
      <div class="grid grid-2">
        <div class="card stack" id="detail"></div>
        <div class="card stack"><h2>ภาพรวมทุกงาน</h2><div class="table-wrap"><table id="overview"></table></div></div>
      </div>`;

    const missing = aid => c.students.filter(s => !d.st[aid]?.[s.id]);

    function drawDetail() {
      const a = d.list.find(x => x.id === cur);
      const box = el.querySelector('#detail');
      if (!a) { box.innerHTML = '<div class="empty-state">เพิ่มงานชิ้นแรกด้านบน</div>'; return; }
      const st = d.st[a.id] || {};
      const late = a.due && todayISO() > a.due;
      const miss = missing(a.id);
      box.innerHTML = `
        <div class="row between">
          <select id="pick" style="flex:1;min-width:0">${d.list.map(x => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          <button class="btn btn-sm btn-danger" data-act="del">ลบงานนี้</button>
        </div>
        <div class="muted small">กำหนดส่ง ${a.due ? thaiDate(a.due) : '-'} ${late ? '· <b style="color:var(--bad)">เลยกำหนดแล้ว</b>' : ''}</div>
        <div class="stats">
          <div class="stat"><b>${c.students.length - miss.length}</b><span>ส่ง/ยกเว้น</span></div>
          <div class="stat"><b style="color:${miss.length ? 'var(--bad)' : 'var(--ok)'}">${miss.length}</b><span>ยังไม่ส่ง</span></div>
        </div>
        <div class="row"><button class="btn btn-sm" data-act="copy" ${miss.length ? '' : 'disabled'}>📋 คัดลอกรายชื่อคนที่ยังไม่ส่ง</button></div>
        <div>${c.students.map((s, i) => `
          <div class="att-row"><span class="num">${i + 1}</span><span>${esc(s.name)}</span>
            <div class="seg" data-sid="${s.id}">${ST.map(x => `<button data-k="${x.k}" data-s="${x.s}" class="${st[s.id] === x.k ? 'on' : ''}">${x.label}</button>`).join('')}</div>
          </div>`).join('')}</div>`;
    }

    function drawOverview() {
      const tbl = el.querySelector('#overview');
      if (!d.list.length) { tbl.innerHTML = '<tr><td class="muted">ยังไม่มีงาน</td></tr>'; return; }
      const icon = Object.fromEntries(ST.map(x => [x.k, x.icon]));
      tbl.innerHTML = `
        <thead><tr><th>#</th><th>ชื่อ</th>${d.list.map((a, i) => `<th title="${esc(a.name)}">${i + 1}</th>`).join('')}<th>ค้าง</th></tr></thead>
        <tbody>${c.students.map((s, i) => {
          const n = d.list.filter(a => !d.st[a.id]?.[s.id]).length;
          return `<tr><td class="num">${i + 1}</td><td>${esc(s.name)}</td>${d.list.map(a => `<td>${icon[d.st[a.id]?.[s.id]] || '❌'}</td>`).join('')}
            <td style="${n ? 'color:var(--bad);font-weight:700' : ''}">${n}</td></tr>`;
        }).join('')}</tbody>`;
    }
    const draw = () => { drawDetail(); drawOverview(); };

    el.addEventListener('click', e => {
      const b = e.target.closest('.seg button');
      if (b) {
        const sid = b.parentElement.dataset.sid;
        d.st[cur] = d.st[cur] || {};
        if (d.st[cur][sid] === b.dataset.k) delete d.st[cur][sid]; else d.st[cur][sid] = b.dataset.k;
        save(); draw(); return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'add') {
        const name = el.querySelector('#hname').value.trim() || `งานที่ ${d.list.length + 1}`;
        const a = { id: uid(), name, due: el.querySelector('#hdue').value };
        d.list.push(a); cur = a.id;
        el.querySelector('#hname').value = '';
        save(); draw();
      }
      if (act === 'del') {
        const a = d.list.find(x => x.id === cur);
        if (a && confirm(`ลบงาน "${a.name}"?`)) {
          d.list = d.list.filter(x => x.id !== cur); delete d.st[cur];
          cur = d.list[d.list.length - 1]?.id || null; save(); draw();
        }
      }
      if (act === 'copy') {
        const a = d.list.find(x => x.id === cur);
        const miss = missing(cur);
        copyText(`📢 ${c.name} — รายชื่อนักเรียนที่ยังไม่ส่ง "${a.name}"${a.due ? ` (กำหนดส่ง ${thaiDate(a.due)})` : ''}\n` +
          miss.map(s => `${c.students.indexOf(s) + 1}. ${s.name}`).join('\n') + `\nรวม ${miss.length} คน กรุณาส่งโดยเร็ว 🙏`);
      }
      if (act === 'csv') {
        const lab = Object.fromEntries(ST.map(x => [x.k, x.label]));
        const rows = [['เลขที่', 'ชื่อ-สกุล', ...d.list.map(a => a.name), 'ค้างส่ง'],
          ...c.students.map((s, i) => [i + 1, s.name, ...d.list.map(a => lab[d.st[a.id]?.[s.id]] || 'ยังไม่ส่ง'),
            d.list.filter(a => !d.st[a.id]?.[s.id]).length])];
        download(`การส่งงาน-${c.name}-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      }
    });
    el.addEventListener('change', e => { if (e.target.id === 'pick') { cur = e.target.value; drawDetail(); } });
    el.addEventListener('keydown', e => { if (e.target.id === 'hname' && e.key === 'Enter') el.querySelector('[data-act=add]').click(); });
    draw();
  },
};
