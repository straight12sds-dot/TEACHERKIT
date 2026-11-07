import { state, save, currentClass, addClass, deleteClass, setCurrent, uid, exportAll, importAll } from '../store.js';
import { esc, parseNames, pageHead, toast, download, todayISO } from '../util.js';
import { mountRosterScanner } from '../roster-scanner.js';

export default {
  id: 'classes',
  icon: '👥',
  title: 'จัดการห้องเรียน',
  desc: 'เพิ่มห้อง สแกนใบรายชื่อจากรูป วางรายชื่อจาก Excel สำรอง/นำเข้าข้อมูล',
  render(el) {
    let cleanupScanner = null;
    function draw() {
      cleanupScanner?.();
      const c = currentClass();
      el.innerHTML = `
        ${pageHead('👥 จัดการห้องเรียน', `<button class="btn btn-primary" data-act="new">➕ เพิ่มห้องใหม่</button>`)}
        <div id="rosterScanner"></div>
        <div class="grid grid-2">
          <div class="card stack">
            <h2>ห้องเรียนทั้งหมด</h2>
            <ul class="list">
              ${state.classes.map(k => `
                <li>
                  <button class="btn btn-sm ${k.id === c.id ? 'btn-primary' : ''}" data-use="${k.id}">${k.id === c.id ? '✓ กำลังใช้' : 'ใช้ห้องนี้'}</button>
                  <span style="flex:1">${esc(k.name)} <span class="muted small">· ${k.students.length} คน</span></span>
                </li>`).join('')}
            </ul>
            <hr style="border:0;border-top:1px solid var(--border)">
            <h2>สำรองข้อมูล</h2>
            <p class="muted small">ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ควรสำรองไว้เป็นไฟล์ หรือใช้ย้ายไปเครื่องอื่น</p>
            <div class="row">
              <button class="btn" data-act="export">💾 ส่งออกไฟล์สำรอง</button>
              <label class="btn">📂 นำเข้าไฟล์สำรอง<input type="file" accept=".json,application/json" hidden data-act="import"></label>
            </div>
          </div>

          <div class="card stack">
            <div class="field">
              <label for="cname">ชื่อห้อง</label>
              <input id="cname" value="${esc(c.name)}" maxlength="60">
            </div>
            <div class="field">
              <label for="cnames">รายชื่อนักเรียน (บรรทัดละ 1 คน — คัดลอกคอลัมน์จาก Excel มาวางได้เลย)</label>
              <textarea id="cnames" rows="14" placeholder="ด.ช. สมชาย ใจดี&#10;ด.ญ. สมหญิง รักเรียน">${esc(c.students.map(s => s.name).join('\n'))}</textarea>
              <span class="muted small" id="count"></span>
            </div>
            <div class="row between">
              <button class="btn btn-primary" data-act="save">💾 บันทึก</button>
              <div class="row">
                <button class="btn" data-act="sort">ก-ฮ เรียงชื่อ</button>
                <button class="btn btn-danger" data-act="delete">🗑️ ลบห้องนี้</button>
              </div>
            </div>
          </div>
        </div>`;
      const ta = el.querySelector('#cnames');
      const count = el.querySelector('#count');
      const upd = () => { count.textContent = `${parseNames(ta.value).length} คน`; };
      ta.addEventListener('input', upd); upd();
      cleanupScanner = mountRosterScanner(el.querySelector('#rosterScanner'), {
        onAppend(names) {
          ta.value = [ta.value.trim(), names.join('\n')].filter(Boolean).join('\n');
          ta.dispatchEvent(new Event('input'));
          ta.focus();
        },
        onCreate(name, names) {
          addClass(name, names);
          draw();
          toast(`สร้างห้อง ${name} พร้อมรายชื่อ ${names.length} คนแล้ว`);
          el.querySelector('#cnames').focus();
        },
      });
    }

    function saveCurrent() {
      const c = currentClass();
      c.name = el.querySelector('#cname').value.trim() || 'ไม่มีชื่อ';
      const names = parseNames(el.querySelector('#cnames').value);
      // คงรหัสเดิมของนักเรียนที่ชื่อไม่เปลี่ยน เพื่อไม่ให้ข้อมูลเช็คชื่อ/คะแนนหาย
      const pool = new Map();
      c.students.forEach(s => { if (!pool.has(s.name)) pool.set(s.name, []); pool.get(s.name).push(s); });
      c.students = names.map(n => (pool.get(n)?.shift()) || { id: uid(), name: n });
      save();
    }

    el.addEventListener('click', e => {
      const use = e.target.closest('[data-use]');
      if (use) { setCurrent(use.dataset.use); draw(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new') {
        const name = prompt('ชื่อห้องใหม่ (เช่น ม.2/3)', '');
        if (name !== null) { addClass(name.trim()); draw(); el.querySelector('#cnames').focus(); }
      } else if (act === 'save') {
        saveCurrent(); draw(); toast('บันทึกแล้ว ✓');
      } else if (act === 'sort') {
        const ta = el.querySelector('#cnames');
        ta.value = parseNames(ta.value).sort((a, b) => a.localeCompare(b, 'th')).join('\n');
        ta.dispatchEvent(new Event('input'));
      } else if (act === 'delete') {
        if (confirm(`ลบห้อง "${currentClass().name}" และข้อมูลทั้งหมดของห้องนี้?`)) { deleteClass(currentClass().id); draw(); toast('ลบแล้ว'); }
      } else if (act === 'export') {
        download(`teacherkit-backup-${todayISO()}.json`, exportAll(), 'application/json');
      }
    });

    el.addEventListener('change', async e => {
      if (e.target.dataset.act !== 'import') return;
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (confirm('นำเข้าจะเขียนทับข้อมูลทั้งหมดในเครื่องนี้ ดำเนินการต่อ?')) { importAll(text); draw(); toast('นำเข้าสำเร็จ ✓'); }
      } catch { toast('ไฟล์ไม่ถูกต้อง'); }
    });

    draw();
    return () => cleanupScanner?.();
  },
};

