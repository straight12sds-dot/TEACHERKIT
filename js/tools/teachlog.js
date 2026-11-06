import { save, currentClass, toolData, uid } from '../store.js';
import { esc, pageHead, todayISO, thaiDate, copyText, download, toCSV, toast } from '../util.js';

const FIELDS = [
  { k: 'result', label: 'ผลการจัดการเรียนรู้', ph: 'เช่น นักเรียน 30 จาก 35 คน (85.71%) ผ่านเกณฑ์ ด้านความรู้ (K) ... ทักษะ (P) ... คุณลักษณะ (A) ...' },
  { k: 'problem', label: 'ปัญหา / อุปสรรค', ph: 'เช่น นักเรียนบางส่วนยังคำนวณเศษส่วนไม่คล่อง เวลาไม่เพียงพอ' },
  { k: 'solution', label: 'แนวทางแก้ไข / พัฒนา', ph: 'เช่น สอนซ่อมเสริมช่วงพักกลางวัน จัดคู่บัดดี้ เพิ่มใบงานฝึกทักษะ' },
];

const blank = () => ({ id: '', date: todayISO(), cls: currentClass().name, subject: '', topic: '', plan: '', result: '', problem: '', solution: '' });

function asText(e) {
  return `บันทึกหลังการจัดการเรียนรู้
วันที่ ${thaiDate(e.date)}  ชั้น ${e.cls}
วิชา ${e.subject || '-'}  แผนที่ ${e.plan || '-'}
เรื่อง ${e.topic || '-'}

${FIELDS.map(f => `${f.label}\n${e[f.k] || '-'}`).join('\n\n')}`;
}

export default {
  id: 'teachlog',
  icon: '🗒️',
  title: 'บันทึกหลังสอน',
  desc: 'บันทึกผล ปัญหา แนวทางแก้ไข หลังสอนแต่ละคาบ เก็บเป็นหลักฐาน วPA พิมพ์/ส่งออกได้',
  render(el) {
    const d = toolData('teachlog', { list: [], last: {} });
    let form = { ...blank(), subject: d.last.subject || '', plan: d.last.plan || '' };

    el.innerHTML = `
      ${pageHead('🗒️ บันทึกหลังสอน', `<button class="btn" data-act="csv">📊 ส่งออก CSV</button>`)}
      <div class="grid grid-2">
        <form class="card stack no-print" id="form" autocomplete="off"></form>
        <div class="card stack">
          <div class="row between"><h2 style="margin:0">บันทึกที่ผ่านมา</h2><input id="q" placeholder="🔍 ค้นหา" style="width:150px"></div>
          <ul class="list" id="list"></ul>
        </div>
      </div>
      <div id="printout" class="card" hidden style="margin-top:14px;white-space:pre-wrap"></div>`;

    const $ = s => el.querySelector(s);

    function drawForm() {
      $('#form').innerHTML = `
        <h2>${form.id ? '✏️ แก้ไขบันทึก' : '➕ บันทึกใหม่'}</h2>
        <div class="row">
          <label class="field" style="flex:1">วันที่<input type="date" name="date" value="${esc(form.date)}"></label>
          <label class="field" style="flex:1">ชั้น/ห้อง<input name="cls" value="${esc(form.cls)}"></label>
        </div>
        <div class="row">
          <label class="field" style="flex:2">วิชา / รหัสวิชา<input name="subject" value="${esc(form.subject)}" placeholder="ค21101 คณิตศาสตร์"></label>
          <label class="field" style="flex:1">แผนที่<input name="plan" value="${esc(form.plan)}" placeholder="5"></label>
        </div>
        <label class="field">เรื่อง / หัวข้อที่สอน<input name="topic" value="${esc(form.topic)}"></label>
        ${FIELDS.map(f => `<label class="field">${f.label}<textarea name="${f.k}" rows="3" placeholder="${esc(f.ph)}">${esc(form[f.k])}</textarea></label>`).join('')}
        <div class="row">
          <button class="btn btn-primary" type="submit">💾 บันทึก</button>
          ${form.id ? '<button class="btn" type="button" data-act="cancel">ยกเลิกการแก้ไข</button>' : ''}
        </div>`;
    }

    function drawList() {
      const q = $('#q').value.trim().toLowerCase();
      const items = d.list.filter(e => !q || JSON.stringify(e).toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date));
      $('#list').innerHTML = items.length ? items.map(e => `
        <li style="flex-wrap:wrap" data-id="${e.id}">
          <div style="flex:1;min-width:180px"><b>${esc(e.topic || '(ไม่มีหัวข้อ)')}</b><br>
            <span class="muted small">${thaiDate(e.date)} · ${esc(e.cls)} · ${esc(e.subject)}${e.plan ? ` · แผนที่ ${esc(e.plan)}` : ''}</span></div>
          <div class="row">
            <button class="btn btn-sm" data-act="copy" title="คัดลอกข้อความ">📋</button>
            <button class="btn btn-sm" data-act="print" title="พิมพ์">🖨️</button>
            <button class="btn btn-sm" data-act="edit" title="แก้ไข">✏️</button>
            <button class="btn btn-sm btn-danger" data-act="del" title="ลบ">🗑️</button>
          </div>
        </li>`).join('') : `<li class="muted">${d.list.length ? 'ไม่พบรายการ' : 'ยังไม่มีบันทึก'}</li>`;
    }

    $('#form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      if (!fd.topic.trim() && !fd.result.trim()) { toast('กรอกหัวข้อหรือผลการจัดการเรียนรู้ก่อน'); return; }
      const entry = { ...form, ...fd, id: form.id || uid() };
      const i = d.list.findIndex(x => x.id === entry.id);
      if (i >= 0) d.list[i] = entry; else d.list.push(entry);
      d.last = { subject: entry.subject, plan: /^\d+$/.test(entry.plan) ? String(+entry.plan + 1) : '' };
      save(); toast('บันทึกแล้ว ✓');
      form = { ...blank(), subject: d.last.subject, plan: d.last.plan };
      drawForm(); drawList();
    });

    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      const entry = d.list.find(x => x.id === e.target.closest('[data-id]')?.dataset.id);
      if (act === 'cancel') { form = blank(); drawForm(); }
      if (act === 'edit' && entry) { form = { ...entry }; drawForm(); $('#form').scrollIntoView({ behavior: 'smooth' }); }
      if (act === 'del' && entry && confirm('ลบบันทึกนี้?')) { d.list = d.list.filter(x => x !== entry); save(); drawList(); }
      if (act === 'copy' && entry) copyText(asText(entry));
      if (act === 'print' && entry) {
        const p = $('#printout');
        p.textContent = asText(entry);
        p.hidden = false;
        // พิมพ์เฉพาะบันทึกที่เลือก
        const others = [...el.children].filter(x => x !== p);
        others.forEach(x => x.classList.add('no-print'));
        // Safari บนมือถือไม่รอให้พิมพ์เสร็จ จึงคืนค่าหน้าจอหลัง afterprint
        addEventListener('afterprint', () => { others.forEach(x => x.classList.remove('no-print')); p.hidden = true; }, { once: true });
        setTimeout(print, 50);
      }
      if (act === 'csv') {
        if (!d.list.length) { toast('ยังไม่มีบันทึก'); return; }
        const rows = [['วันที่', 'ชั้น', 'วิชา', 'แผนที่', 'เรื่อง', ...FIELDS.map(f => f.label)],
          ...[...d.list].sort((a, b) => a.date.localeCompare(b.date)).map(e => [e.date, e.cls, e.subject, e.plan, e.topic, ...FIELDS.map(f => e[f.k])])];
        download(`บันทึกหลังสอน-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      }
    });
    $('#q').addEventListener('input', drawList);

    drawForm(); drawList();
  },
};
