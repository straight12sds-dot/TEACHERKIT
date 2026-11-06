import { save, toolData } from '../store.js';
import { pageHead, toast, toggleFullscreen } from '../util.js';
import qrcode from '../vendor/qrcode.js';

// อักขระพิเศษในข้อมูล Wi-Fi ต้อง escape ตามมาตรฐาน
const wifiEsc = s => s.replace(/([\\;,:"])/g, '\\$1');

export default {
  id: 'qr',
  icon: '🔳',
  title: 'สร้าง QR Code',
  desc: 'แปลงลิงก์ ข้อความ หรือ Wi-Fi เป็น QR ให้นักเรียนสแกน ดาวน์โหลด/พิมพ์ได้',
  render(el) {
    const d = toolData('qr', { mode: 'text', text: '', ssid: '', pass: '', sec: 'WPA', caption: '', ec: 'M' });

    el.innerHTML = `
      ${pageHead('🔳 สร้าง QR Code', `
        <button class="btn" data-act="png">⬇️ ดาวน์โหลด PNG</button>
        <button class="btn" onclick="print()">🖨️ พิมพ์</button>
        <button class="btn" data-act="fs">⛶ เต็มจอ</button>`)}
      <div class="grid grid-2">
        <div class="card stack no-print">
          <div class="seg" id="modes">
            <button data-mode="text" data-s="P">🔗 ลิงก์ / ข้อความ</button>
            <button data-mode="wifi" data-s="P">📶 Wi-Fi</button>
          </div>
          <div class="field" data-for="text">
            <label for="text">ลิงก์หรือข้อความ</label>
            <textarea id="text" rows="4" placeholder="https://forms.gle/... หรือข้อความภาษาไทยก็ได้"></textarea>
          </div>
          <div class="stack" data-for="wifi">
            <div class="field"><label for="ssid">ชื่อ Wi-Fi (SSID)</label><input id="ssid"></div>
            <div class="field"><label for="pass">รหัสผ่าน</label><input id="pass"></div>
            <div class="field"><label for="sec">การเข้ารหัส</label>
              <select id="sec"><option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">ไม่มีรหัสผ่าน</option></select>
            </div>
          </div>
          <div class="field"><label for="caption">คำอธิบายใต้ QR (ไม่บังคับ)</label><input id="caption" placeholder="เช่น แบบทดสอบก่อนเรียน บทที่ 3" maxlength="80"></div>
          <div class="field"><label for="ec">ความทนทานต่อรอยเสียหาย</label>
            <select id="ec"><option value="L">ต่ำ (ลายละเอียดน้อยสุด)</option><option value="M">ปานกลาง</option><option value="Q">สูง</option><option value="H">สูงสุด</option></select>
          </div>
          <div class="muted small" id="info"></div>
        </div>
        <div class="card fs-target" id="fs" style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
          <canvas id="cv" style="width:min(100%,360px);height:auto;image-rendering:pixelated;background:#fff;border-radius:8px"></canvas>
          <div id="cap" style="font-size:1.3rem;font-weight:600"></div>
        </div>
      </div>`;

    const $ = s => el.querySelector(s);
    const cv = $('#cv');
    $('#text').value = d.text; $('#ssid').value = d.ssid; $('#pass').value = d.pass;
    $('#sec').value = d.sec; $('#caption').value = d.caption; $('#ec').value = d.ec;

    function payload() {
      if (d.mode === 'wifi') {
        if (!d.ssid) return '';
        return `WIFI:T:${d.sec};S:${wifiEsc(d.ssid)};${d.sec === 'nopass' ? '' : `P:${wifiEsc(d.pass)};`};`;
      }
      return d.text.trim();
    }

    function draw() {
      el.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === d.mode));
      el.querySelectorAll('[data-for]').forEach(x => { x.hidden = x.dataset.for !== d.mode; });
      $('#cap').textContent = d.caption || (d.mode === 'wifi' && d.ssid ? `Wi-Fi: ${d.ssid}` : '');
      const data = payload();
      const ctx = cv.getContext('2d');
      if (!data) {
        cv.width = cv.height = 0; cv.hidden = true;
        $('#info').textContent = d.mode === 'wifi' ? 'กรอกชื่อ Wi-Fi เพื่อสร้าง QR' : 'พิมพ์ลิงก์หรือข้อความเพื่อสร้าง QR';
        return;
      }
      let qr;
      try { qr = qrcode(0, d.ec); qr.addData(data); qr.make(); }
      catch { cv.hidden = true; $('#info').textContent = '⚠️ ข้อความยาวเกินไป ลองลดความยาว หรือลดระดับความทนทาน'; return; }
      cv.hidden = false;
      const n = qr.getModuleCount(), quiet = 4, scale = Math.max(4, Math.floor(1024 / (n + quiet * 2)));
      cv.width = cv.height = (n + quiet * 2) * scale;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
      $('#info').textContent = `ขนาด ${n}×${n} จุด · ${new TextEncoder().encode(data).length} ไบต์`;
    }

    el.addEventListener('input', e => {
      const id = e.target.id;
      if (['text', 'ssid', 'pass', 'caption'].includes(id)) { d[id] = e.target.value; save(); draw(); }
    });
    el.addEventListener('change', e => {
      const id = e.target.id;
      if (id === 'sec' || id === 'ec') { d[id] = e.target.value; save(); draw(); }
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.mode) { d.mode = b.dataset.mode; save(); draw(); }
      if (b.dataset.act === 'fs') toggleFullscreen($('#fs'));
      if (b.dataset.act === 'png') {
        if (cv.hidden) { toast('ยังไม่มี QR ให้ดาวน์โหลด'); return; }
        const a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = `qr-${(d.caption || 'teacherkit').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)}.png`;
        a.click();
      }
    });
    draw();
  },
};
