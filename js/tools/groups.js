import { save, currentClass, toolData } from '../store.js';
import { esc, pageHead, noStudents, shuffle, copyText, COLORS } from '../util.js';

export default {
  id: 'groups',
  icon: '🧩',
  title: 'แบ่งกลุ่มอัตโนมัติ',
  desc: 'สุ่มแบ่งกลุ่มตามจำนวนกลุ่ม หรือจำนวนคนต่อกลุ่ม',
  render(el) {
    const c = currentClass();
    if (!c.students.length) { el.innerHTML = pageHead('🧩 แบ่งกลุ่มอัตโนมัติ') + noStudents(); return; }

    const data = toolData('groups', {});
    data[c.id] = data[c.id] || { mode: 'count', n: 4, result: null };
    const d = data[c.id];

    el.innerHTML = `
      ${pageHead('🧩 แบ่งกลุ่มอัตโนมัติ', `<button class="btn" data-act="copy">📋 คัดลอก</button><button class="btn" onclick="print()">🖨️ พิมพ์</button>`)}
      <div class="card row no-print" style="margin-bottom:16px">
        <select id="mode">
          <option value="count" ${d.mode === 'count' ? 'selected' : ''}>จำนวนกลุ่ม</option>
          <option value="size" ${d.mode === 'size' ? 'selected' : ''}>คนต่อกลุ่ม</option>
        </select>
        <input type="number" id="n" min="1" max="${c.students.length}" value="${d.n}">
        <button class="btn btn-primary" data-act="go">🔀 สุ่มแบ่งกลุ่ม</button>
        <span class="muted small">ทั้งหมด ${c.students.length} คน</span>
      </div>
      <div class="groups" id="out"></div>`;

    const out = el.querySelector('#out');
    const byId = new Map(c.students.map(s => [s.id, s]));

    function draw() {
      const groups = (d.result || []).map(g => g.map(id => byId.get(id)).filter(Boolean));
      if (!groups.length) { out.innerHTML = `<div class="empty-state card" style="grid-column:1/-1">ตั้งค่าแล้วกด "สุ่มแบ่งกลุ่ม"</div>`; return; }
      out.innerHTML = groups.map((g, i) => `
        <div class="group" style="--c:${COLORS[i % COLORS.length]}">
          <h3>กลุ่มที่ ${i + 1} <span class="muted small">(${g.length} คน)</span></h3>
          <ol>${g.map(s => `<li>${esc(s.name)}</li>`).join('')}</ol>
        </div>`).join('');
    }

    function go() {
      const n = Math.max(1, Math.min(c.students.length, parseInt(el.querySelector('#n').value, 10) || 1));
      d.mode = el.querySelector('#mode').value; d.n = n;
      const k = d.mode === 'count' ? n : Math.ceil(c.students.length / n);
      const groups = Array.from({ length: k }, () => []);
      // แจกวนทีละคน ทำให้จำนวนสมาชิกแต่ละกลุ่มต่างกันไม่เกิน 1 คน
      shuffle(c.students).forEach((s, i) => groups[i % k].push(s.id));
      d.result = groups;
      save(); draw();
    }

    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'go') go();
      if (act === 'copy') {
        const text = (d.result || []).map((g, i) => `กลุ่มที่ ${i + 1}\n` + g.map((id, j) => `${j + 1}. ${byId.get(id)?.name ?? ''}`).join('\n')).join('\n\n');
        copyText(text || 'ยังไม่ได้แบ่งกลุ่ม');
      }
    });
    draw();
  },
};
