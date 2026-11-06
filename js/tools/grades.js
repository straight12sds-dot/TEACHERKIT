import { state, save, currentClass } from '../store.js';
import { esc, pageHead, noStudents, download, toCSV, todayISO } from '../util.js';

// เกณฑ์มาตรฐานตามหลักสูตรแกนกลางฯ (ปรับได้)
const DEFAULT_SCALE = [
  { g: '4', min: 80 }, { g: '3.5', min: 75 }, { g: '3', min: 70 }, { g: '2.5', min: 65 },
  { g: '2', min: 60 }, { g: '1.5', min: 55 }, { g: '1', min: 50 }, { g: '0', min: 0 },
];

export function toGrade(pct, scale) {
  for (const s of scale) if (pct >= s.min) return s.g;
  return scale[scale.length - 1].g;
}

export default {
  id: 'grades',
  icon: '📝',
  title: 'คำนวณเกรด',
  desc: 'กรอกคะแนนเก็บ/สอบ ตัดเกรด 0–4 อัตโนมัติ ดูสถิติและส่งออก',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('📝 คำนวณเกรด') + noStudents(); return; }

    state.grades[c.id] = state.grades[c.id] || {};
    const d = state.grades[c.id];
    d.parts = d.parts || [{ name: 'คะแนนเก็บ', max: 70 }, { name: 'สอบปลายภาค', max: 30 }];
    d.scale = d.scale || DEFAULT_SCALE.map(x => ({ ...x }));
    d.scores = d.scores || {}; // studentId -> [numbers]

    el.innerHTML = `
      ${pageHead('📝 คำนวณเกรด', `<button class="btn" data-act="csv">📊 ส่งออก Excel (CSV)</button><button class="btn" onclick="print()">🖨️ พิมพ์</button>`)}
      <div class="grid grid-2" style="margin-bottom:14px">
        <div class="card stack no-print">
          <div class="row between"><h2 style="margin:0">ส่วนของคะแนน</h2><button class="btn btn-sm" data-act="addpart">➕ เพิ่มช่อง</button></div>
          <div id="parts" class="stack"></div>
          <div class="muted small" id="totalmax"></div>
        </div>
        <div class="card stack">
          <h2>การกระจายของเกรด</h2>
          <div class="bars" id="bars"></div>
          <div class="stats" id="stats"></div>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap"><table id="tbl"></table></div>
        <details class="no-print" style="margin-top:14px">
          <summary class="muted">⚙️ ปรับเกณฑ์การตัดเกรด (ร้อยละขั้นต่ำ)</summary>
          <div class="row" id="scale" style="margin-top:10px"></div>
        </details>
      </div>`;

    const totalMax = () => d.parts.reduce((a, p) => a + (+p.max || 0), 0);
    const sumOf = sid => {
      const arr = d.scores[sid] || [];
      let filled = false;
      const sum = d.parts.reduce((a, _, i) => { const v = arr[i]; if (v !== '' && v != null && !isNaN(v)) { filled = true; return a + +v; } return a; }, 0);
      return filled ? sum : null;
    };

    function drawParts() {
      el.querySelector('#parts').innerHTML = d.parts.map((p, i) => `
        <div class="row">
          <input data-pname="${i}" value="${esc(p.name)}" style="flex:1;min-width:120px" aria-label="ชื่อช่องคะแนน">
          <label>เต็ม <input type="number" data-pmax="${i}" min="1" value="${p.max}"></label>
          ${d.parts.length > 1 ? `<button class="btn btn-sm btn-danger" data-delpart="${i}" title="ลบช่อง">✕</button>` : ''}
        </div>`).join('');
      el.querySelector('#totalmax').textContent = `คะแนนเต็มรวม ${totalMax()} คะแนน`;
      el.querySelector('#scale').innerHTML = d.scale.slice(0, -1).map((s, i) => `
        <label class="chip">เกรด ${s.g} ≥ <input type="number" data-scale="${i}" min="0" max="100" value="${s.min}" style="width:64px"> %</label>`).join('') +
        `<button class="btn btn-sm" data-act="resetscale">ค่าเริ่มต้น</button>`;
    }

    function drawTable() {
      el.querySelector('#tbl').innerHTML = `
        <thead><tr><th>#</th><th>ชื่อ</th>${d.parts.map(p => `<th>${esc(p.name)}<br><span class="small">(${p.max})</span></th>`).join('')}<th>รวม</th><th>%</th><th>เกรด</th></tr></thead>
        <tbody>${c.students.map((s, i) => `
          <tr data-sid="${s.id}">
            <td class="num">${i + 1}</td><td>${esc(s.name)}</td>
            ${d.parts.map((p, j) => `<td><input type="number" min="0" max="${p.max}" step="0.5" data-j="${j}" value="${d.scores[s.id]?.[j] ?? ''}" aria-label="${esc(p.name)} ${esc(s.name)}"></td>`).join('')}
            <td class="tot"></td><td class="pct"></td><td class="grade"></td>
          </tr>`).join('')}</tbody>`;
      updateResults();
    }

    function updateResults() {
      const tm = totalMax() || 1;
      const dist = Object.fromEntries(d.scale.map(s => [s.g, 0]));
      const totals = [];
      el.querySelectorAll('#tbl tbody tr').forEach(tr => {
        const sum = sumOf(tr.dataset.sid);
        const cells = { tot: tr.querySelector('.tot'), pct: tr.querySelector('.pct'), grade: tr.querySelector('.grade') };
        if (sum === null) { cells.tot.textContent = cells.pct.textContent = cells.grade.textContent = '-'; cells.grade.className = 'grade'; return; }
        const pct = (sum / tm) * 100;
        const g = toGrade(pct, d.scale);
        dist[g]++; totals.push(sum);
        cells.tot.textContent = +sum.toFixed(2);
        cells.pct.textContent = pct.toFixed(1);
        cells.grade.textContent = g;
        cells.grade.className = `grade ${g === '0' ? 'grade-0' : ''}`;
        tr.querySelectorAll('input').forEach(inp => {
          const over = +inp.value > +inp.max;
          inp.style.borderColor = over ? 'var(--bad)' : '';
          inp.title = over ? 'เกินคะแนนเต็ม' : '';
        });
      });
      const maxN = Math.max(1, ...Object.values(dist));
      el.querySelector('#bars').innerHTML = d.scale.map(s => `
        <div class="bar"><span>${dist[s.g]}</span><i style="height:${(dist[s.g] / maxN) * 100}%;${s.g === '0' ? 'background:var(--bad)' : ''}"></i><b>${s.g}</b></div>`).join('');
      const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
      const pass = totals.filter(t => toGrade((t / tm) * 100, d.scale) !== '0').length;
      el.querySelector('#stats').innerHTML = `
        <div class="stat"><b>${totals.length ? avg.toFixed(1) : '-'}</b><span>คะแนนเฉลี่ย</span></div>
        <div class="stat"><b>${totals.length ? Math.max(...totals) : '-'}</b><span>สูงสุด</span></div>
        <div class="stat"><b>${totals.length ? Math.min(...totals) : '-'}</b><span>ต่ำสุด</span></div>
        <div class="stat"><b>${totals.length ? Math.round((pass / totals.length) * 100) + '%' : '-'}</b><span>ผ่านเกณฑ์</span></div>`;
    }

    el.addEventListener('input', e => {
      const t = e.target;
      const tr = t.closest('tr[data-sid]');
      if (tr && t.dataset.j != null) {
        const sid = tr.dataset.sid;
        d.scores[sid] = d.scores[sid] || [];
        d.scores[sid][+t.dataset.j] = t.value === '' ? '' : +t.value;
        save(); updateResults(); return;
      }
      if (t.dataset.pname != null) { d.parts[+t.dataset.pname].name = t.value; save(); }
      if (t.dataset.pmax != null) { d.parts[+t.dataset.pmax].max = Math.max(0, +t.value || 0); save(); el.querySelector('#totalmax').textContent = `คะแนนเต็มรวม ${totalMax()} คะแนน`; updateResults(); }
      if (t.dataset.scale != null) { d.scale[+t.dataset.scale].min = +t.value || 0; save(); updateResults(); }
    });
    // เมื่อแก้ชื่อ/คะแนนเต็มเสร็จ ค่อยวาดหัวตารางใหม่ (ไม่ให้เคอร์เซอร์หลุดระหว่างพิมพ์)
    el.addEventListener('change', e => { if (e.target.dataset.pname != null || e.target.dataset.pmax != null) drawTable(); });

    // กด Enter เพื่อเลื่อนลงช่องถัดไป (เหมือน Excel)
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target.dataset.j == null) return;
      e.preventDefault();
      const next = e.target.closest('tr').nextElementSibling?.querySelector(`input[data-j="${e.target.dataset.j}"]`);
      next?.focus(); next?.select();
    });

    el.addEventListener('click', e => {
      const del = e.target.closest('[data-delpart]');
      if (del) {
        const i = +del.dataset.delpart;
        if (!confirm(`ลบช่อง "${d.parts[i].name}" และคะแนนในช่องนี้?`)) return;
        d.parts.splice(i, 1);
        Object.values(d.scores).forEach(arr => arr.splice(i, 1));
        save(); drawParts(); drawTable(); return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'addpart') { d.parts.push({ name: `ช่องที่ ${d.parts.length + 1}`, max: 10 }); save(); drawParts(); drawTable(); }
      if (act === 'resetscale') { d.scale = DEFAULT_SCALE.map(x => ({ ...x })); save(); drawParts(); updateResults(); }
      if (act === 'csv') {
        const tm = totalMax() || 1;
        const rows = [
          ['เลขที่', 'ชื่อ-สกุล', ...d.parts.map(p => `${p.name} (${p.max})`), `รวม (${totalMax()})`, 'ร้อยละ', 'เกรด'],
          ...c.students.map((s, i) => {
            const sum = sumOf(s.id);
            return [i + 1, s.name, ...d.parts.map((_, j) => d.scores[s.id]?.[j] ?? ''),
              sum ?? '', sum === null ? '' : ((sum / tm) * 100).toFixed(2), sum === null ? '' : toGrade((sum / tm) * 100, d.scale)];
          }),
        ];
        download(`เกรด-${c.name}-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      }
    });

    drawParts(); drawTable();
  },
};
