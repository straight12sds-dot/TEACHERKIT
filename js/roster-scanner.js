import { parseNames, copyText, toast } from './util.js';
import { cleanRosterText, recognizeRoster } from './roster-ocr.js';

export function mountRosterScanner(el, { onCreate, onAppend }) {
  el.innerHTML = `
    <details class="card roster-scanner no-print">
      <summary><span class="roster-scan-icon" aria-hidden="true">📷</span><span><b>สแกนใบรายชื่อจากรูปภาพ</b><small>เลือกรูปหรือถ่ายรูป → ตรวจแก้รายชื่อ → สร้างห้องใหม่</small></span><span class="roster-scan-open" aria-hidden="true">เปิดตัวช่วย</span></summary>
      <div class="roster-scan-body stack">
        <p class="muted small">ใช้รูปใบรายชื่อที่ชัดและตั้งตรง ครอปให้เหลือเฉพาะคอลัมน์ชื่อ–นามสกุล เพื่อให้อ่านได้แม่นยำขึ้น</p>
        <div class="row">
          <button class="btn" type="button" data-ocr="choose">🖼️ เลือกรูปใบรายชื่อ</button>
          <button class="btn" type="button" data-ocr="camera">📷 ถ่ายรูป</button>
          <input type="file" accept="image/*" id="rosterPhoto" hidden>
          <input type="file" accept="image/*" capture="environment" id="rosterCamera" hidden>
          <label class="field roster-language" for="rosterLanguage">ภาษาในใบรายชื่อ<select id="rosterLanguage"><option value="tha+eng">ไทย + อังกฤษ</option><option value="tha">ไทย</option><option value="eng">อังกฤษ</option></select></label>
        </div>
        <div class="roster-image" id="rosterImage" hidden>
          <div class="roster-image-frame"><img id="rosterPreview" alt="ภาพใบรายชื่อที่เลือก"></div>
          <div class="row between"><span class="small muted" id="rosterFileName"></span><button class="btn btn-sm" type="button" data-ocr="rotate">↻ หมุนภาพ 90°</button></div>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="button" data-ocr="scan" disabled>🔍 เริ่มสแกนรายชื่อ</button>
          <button class="btn" type="button" data-ocr="cancel" hidden>ยกเลิกการสแกน</button>
          <label class="check"><input type="checkbox" id="rosterAppendScan" checked> เพิ่มผลสแกนภาพถัดไปต่อท้าย</label>
        </div>
        <div class="roster-progress" id="rosterProgress" hidden><progress max="100" value="0" aria-label="ความคืบหน้าการสแกน"></progress></div>
        <p class="roster-status small" id="rosterStatus" role="status" aria-live="polite" aria-atomic="true">อ่านภาพในเครื่อง ไม่อัปโหลดใบรายชื่อ · ครั้งแรกต้องต่ออินเทอร์เน็ตเพื่อโหลดตัวอ่านภาษา</p>
        <div class="field">
          <label for="rosterNames">รายชื่อที่สแกนได้ — ตรวจแก้ให้เหลือบรรทัดละ 1 คน</label>
          <textarea id="rosterNames" rows="7" placeholder="ผลสแกนจะแสดงตรงนี้ แก้ไขหรือลบหัวตารางได้ก่อนนำไปใช้" aria-describedby="rosterReviewNote rosterCount"></textarea>
          <span class="muted small" id="rosterReviewNote">ตัวอ่านอาจอ่านชื่อหรือวรรณยุกต์คลาดเคลื่อน กรุณาตรวจทุกชื่อและลบข้อมูลอื่นก่อนสร้างห้อง ระบบช่วยตัดเลขที่ด้านหน้า แต่จะไม่ลบชื่อซ้ำให้อัตโนมัติ</span>
          <span class="small" id="rosterCount">0 คน</span>
        </div>
        <div class="row"><button class="btn" type="button" data-ocr="copy" disabled>📋 คัดลอกรายชื่อ</button><button class="btn" type="button" data-ocr="append" disabled>เพิ่มในช่องรายชื่อห้องปัจจุบัน</button></div>
        <div class="roster-create">
          <label class="field" for="rosterClassName">ชื่อห้องใหม่<input id="rosterClassName" maxlength="60" placeholder="เช่น ม.2/3" autocomplete="off"></label>
          <button class="btn btn-primary" type="button" data-ocr="create" disabled>➕ สร้างห้องใหม่จากรายชื่อนี้</button>
        </div>
        <p class="muted small roster-create-note">การสร้างห้องใหม่จะเก็บรายชื่อแยกจากห้องเดิม ส่วนการเพิ่มในช่องรายชื่อยังต้องกด “บันทึก” ในฟอร์มห้องเรียน</p>
      </div>
    </details>`;

  const $ = selector => el.querySelector(selector);
  const names = $('#rosterNames');
  const status = $('#rosterStatus');
  const preview = $('#rosterPreview');
  let file = null, turns = 0, url = null, controller = null, active = true;

  function update() {
    const count = parseNames(names.value).length;
    $('#rosterCount').textContent = `${count} คน`;
    for (const action of ['copy', 'append', 'create']) $(`[data-ocr="${action}"]`).disabled = !count || !!controller;
    for (const action of ['choose', 'camera', 'rotate']) $(`[data-ocr="${action}"]`).disabled = !!controller;
    $('[data-ocr="scan"]').disabled = !file || !!controller;
    $('[data-ocr="cancel"]').hidden = !controller;
    $('#rosterLanguage').disabled = !!controller;
    $('#rosterProgress').hidden = !controller;
    names.setAttribute('aria-busy', String(!!controller));
  }

  function chooseFile(input) {
    const selected = input.files[0];
    input.value = '';
    if (!selected) return;
    if ((selected.type && !selected.type.startsWith('image/')) || selected.size > 20 * 1024 * 1024) {
      status.textContent = selected.size > 20 * 1024 * 1024 ? 'รูปใหญ่เกิน 20 MB กรุณาครอปรูปหรือเลือกรูปที่เล็กลง' : 'กรุณาเลือกไฟล์รูปภาพ เช่น JPG, PNG หรือ WebP';
      return;
    }
    if (url) URL.revokeObjectURL(url);
    file = selected; turns = 0;
    url = URL.createObjectURL(file);
    preview.src = url;
    paintPreview();
    $('#rosterImage').hidden = false;
    $('#rosterFileName').textContent = file.name;
    status.textContent = 'เลือกรูปแล้ว ตรวจภาพให้ตั้งตรง แล้วกด “เริ่มสแกนรายชื่อ”';
    update();
  }

  function paintPreview() {
    const frame = $('.roster-image-frame');
    const scale = turns % 2 && preview.clientWidth && preview.clientHeight
      ? Math.min(1, (frame.clientHeight - 16) / preview.clientWidth, (frame.clientWidth - 16) / preview.clientHeight) : 1;
    preview.style.transform = `rotate(${turns * 90}deg) scale(${scale})`;
  }
  preview.addEventListener('load', paintPreview);
  window.addEventListener('resize', paintPreview);

  async function scan() {
    if (!file || controller) return;
    const job = new AbortController();
    controller = job;
    const progress = $('#rosterProgress progress');
    progress.value = 0;
    status.textContent = 'กำลังเตรียมภาพและโหลดตัวอ่านภาษา…';
    update();
    try {
      const result = await recognizeRoster(file, {
        turns, language: $('#rosterLanguage').value, signal: job.signal,
        onProgress: ({ status: phase, progress: value }) => {
          if (!active || job.signal.aborted) return;
          if (phase === 'recognizing text') {
            const percent = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
            progress.value = percent;
            status.textContent = `กำลังอ่านรายชื่อ ${Math.floor(percent / 10) * 10}%…`;
          } else if (phase === 'loading language traineddata') {
            status.textContent = 'กำลังโหลดข้อมูลภาษาไทย/อังกฤษ ครั้งแรกอาจใช้เวลาสักครู่…';
          }
        },
      });
      if (!active || job.signal.aborted) return;
      const text = cleanRosterText(result.text);
      if (!text) { status.textContent = 'ยังอ่านข้อความไม่ได้ ลองใช้ภาพที่ชัดขึ้นหรือครอปเฉพาะรายชื่อ แล้วสแกนอีกครั้ง รายชื่อที่แก้ไว้ยังอยู่'; return; }
      const previous = $('#rosterAppendScan').checked ? names.value.trim() : '';
      names.value = previous ? `${previous}\n${text}` : text;
      status.textContent = 'สแกนเสร็จแล้ว กรุณาตรวจชื่อ ลบหัวตารางและข้อมูลอื่น ก่อนคัดลอกหรือสร้างห้อง';
      names.focus();
    } catch (error) {
      if (active) status.textContent = error.name === 'AbortError' ? 'ยกเลิกการสแกนแล้ว รายชื่อที่ตรวจแก้ไว้ยังอยู่' : error.message;
    } finally {
      if (controller === job) controller = null;
      if (active) update();
    }
  }

  const onChange = event => {
    if (['rosterPhoto', 'rosterCamera'].includes(event.target.id)) chooseFile(event.target);
  };
  const onClick = event => {
    const action = event.target.closest('[data-ocr]')?.dataset.ocr;
    if (action === 'choose') $('#rosterPhoto').click();
    if (action === 'camera') $('#rosterCamera').click();
    if (action === 'rotate' && file && !controller) { turns = (turns + 1) % 4; paintPreview(); }
    if (action === 'scan') scan();
    if (action === 'cancel') controller?.abort();
    const list = parseNames(names.value);
    if (!list.length || controller) return;
    if (action === 'copy') copyText(list.join('\n'));
    if (action === 'append') { onAppend(list); toast('เพิ่มในช่องรายชื่อแล้ว ตรวจอีกครั้งและกดบันทึก'); }
    if (action === 'create') {
      const name = $('#rosterClassName').value.trim();
      if (!name) { status.textContent = 'กรุณาใส่ชื่อห้องใหม่ก่อน'; $('#rosterClassName').focus(); return; }
      onCreate(name, list);
    }
  };
  const onNames = () => update();
  names.addEventListener('input', onNames);
  el.addEventListener('change', onChange);
  el.addEventListener('click', onClick);
  return () => {
    active = false;
    controller?.abort();
    if (url) URL.revokeObjectURL(url);
    names.removeEventListener('input', onNames);
    preview.removeEventListener('load', paintPreview);
    window.removeEventListener('resize', paintPreview);
    el.removeEventListener('change', onChange);
    el.removeEventListener('click', onClick);
  };
}
