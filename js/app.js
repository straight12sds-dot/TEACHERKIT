import { state, onChange, setCurrent, currentClass } from './store.js';
import { $, esc, uiIcon } from './util.js';

import classes from './tools/classes.js';
import picker from './tools/picker.js';
import groups from './tools/groups.js';
import timer from './tools/timer.js';
import attendance from './tools/attendance.js';
import grades from './tools/grades.js';
import scoreboard from './tools/scoreboard.js';
import noise from './tools/noise.js';
import seating from './tools/seating.js';
import random from './tools/random.js';
import qr from './tools/qr.js';
import schedule from './tools/schedule.js';
import behavior from './tools/behavior.js';
import homework from './tools/homework.js';
import exam from './tools/exam.js';
import teachlog from './tools/teachlog.js';

export const TOOLS = [picker, groups, timer, attendance, homework, grades, exam, behavior, schedule, teachlog, scoreboard, noise, seating, random, qr];
const ROUTES = Object.fromEntries([...TOOLS, classes].map(t => [t.id, t]));

const app = $('#app');
let cleanup = null;

$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  app.focus({ preventScroll: true });
  app.scrollIntoView({ block: 'start' });
});

// หมวดหมู่ใช้สำหรับการแสดงผลเท่านั้น ไม่เปลี่ยนข้อมูลของเครื่องมือ
const CATEGORIES = [
  { id: 'all', title: 'ทั้งหมด' },
  { id: 'activities', title: 'กิจกรรมในห้อง', tools: ['picker', 'groups', 'timer', 'scoreboard', 'noise', 'random'] },
  { id: 'students', title: 'ดูแลนักเรียน', tools: ['attendance', 'homework', 'behavior', 'seating', 'classes'] },
  { id: 'teaching', title: 'งานสอนและประเมินผล', tools: ['grades', 'exam', 'schedule', 'teachlog'] },
  { id: 'extras', title: 'เครื่องมือเสริม', tools: ['qr'] },
];

function renderHome() {
  const c = currentClass();
  const allTools = [...TOOLS, classes];
  const categoryFor = id => CATEGORIES.find(category => category.tools?.includes(id));
  app.innerHTML = `
    <div class="home-heading">
      <div><p class="eyebrow">YOUR TEACHING WORKSPACE</p><h1>วันนี้ สอนให้ง่ายขึ้นอีกนิด <span aria-hidden="true">✦</span></h1></div>
      <span class="local-badge">${uiIcon('shield')} ไม่ต้องสมัคร ใช้ได้เลย</span>
    </div>
    <section class="hero" aria-label="เริ่มต้นคาบเรียน">
      <div class="hero-copy">
        <span class="hero-eyebrow">${uiIcon('spark')} ผู้ช่วยคู่ใจ ในทุกวันสอน</span>
        <h2>เรื่องจัดการห้องเรียน<br> ให้เราช่วยคุณครู</h2>
        <p>รวมเครื่องมือที่ครูใช้บ่อยไว้ในที่เดียว<br class="hide-sm"> ลดเวลาเตรียม เพิ่มเวลาให้กับการสอน</p>
        <a class="btn btn-primary" href="#/attendance">${uiIcon('check')} เริ่มเช็คชื่อเข้าเรียน ${uiIcon('arrow')}</a>
      </div>
      <div class="class-overview">
        <div class="class-overview-top"><span class="class-overview-icon">${uiIcon('people')}</span><span class="class-status"><i></i> ห้องเรียนปัจจุบัน</span></div>
        <h3>${esc(c.name)}</h3>
        <p><strong>${c.students.length}</strong> นักเรียนในห้อง <span aria-hidden="true">·</span> <span>พร้อมเริ่มคาบเรียน</span></p>
        <div class="class-overview-bottom"><span class="class-hint">เปลี่ยนห้องได้ที่แถบด้านบน</span><a href="#/classes" aria-label="จัดการห้องเรียน ${esc(c.name)}">จัดการห้อง ${uiIcon('arrow')}</a></div>
      </div>
    </section>

    <nav class="quick-actions" aria-label="เริ่มใช้งานด่วน">
      <span class="quick-label">เริ่มใช้ได้ทันที</span>
      <a href="#/picker">${uiIcon('shuffle')} สุ่มชื่อนักเรียน ${uiIcon('arrow')}</a>
      <a href="#/timer">${uiIcon('clock')} จับเวลากิจกรรม ${uiIcon('arrow')}</a>
      <a href="#/groups">${uiIcon('people')} แบ่งกลุ่มนักเรียน ${uiIcon('arrow')}</a>
    </nav>

    <section class="catalog" aria-labelledby="toolsHeading">
      <div class="catalog-heading">
        <div><h2 id="toolsHeading">เครื่องมือสำหรับคุณครู <span class="count-badge">${allTools.length}</span></h2><p>เลือกผู้ช่วยให้เหมาะกับคาบเรียนของคุณ</p></div>
        <label class="tool-search" for="toolSearch">${uiIcon('search')}<span class="sr-only">ค้นหาเครื่องมือ</span><input type="search" id="toolSearch" placeholder="ค้นหาเครื่องมือ เช่น สุ่มชื่อ" autocomplete="off"><button type="button" id="clearSearch" aria-label="ล้างคำค้นหา" hidden>${uiIcon('close')}</button></label>
      </div>
      <div class="category-filters" role="group" aria-label="หมวดหมู่เครื่องมือ">
        ${CATEGORIES.map(category => `<button class="category-filter" type="button" data-category="${category.id}" aria-pressed="${category.id === 'all'}">${category.title}</button>`).join('')}
      </div>
      <p class="catalog-count" id="toolCount" role="status" aria-live="polite" aria-atomic="true">แสดง ${allTools.length} เครื่องมือ</p>
      <div class="tools" id="toolGrid">
        ${allTools.map(t => `
          <a class="tool" href="#/${t.id}" data-tool="${t.id}" data-tool-category="${categoryFor(t.id).id}">
            <div class="tool-top"><div class="ico" aria-hidden="true">${t.icon}</div><span class="tool-arrow">${uiIcon('arrow')}</span></div>
            <h3>${t.title}</h3>
            <p>${t.desc}</p>
            <span class="tool-category">${categoryFor(t.id).title}</span>
          </a>`).join('')}
      </div>
      <div class="search-empty" id="toolEmpty" hidden>
        <span class="empty-icon">${uiIcon('search')}</span><h3>ยังไม่พบเครื่องมือที่ค้นหา</h3><p>ลองใช้คำสั้น ๆ หรือเลือกดูเครื่องมือทั้งหมด</p><button class="btn" type="button" id="resetFilters">ดูเครื่องมือทั้งหมด</button>
      </div>
    </section>
    <div class="home-tip">${uiIcon('shield')}<p><b>ข้อมูลของคุณครู อยู่กับคุณครู</b> ทุกอย่างบันทึกในเบราว์เซอร์นี้ สำรองไฟล์เก็บไว้ได้ที่ <a href="#/classes">จัดการห้องเรียน</a></p></div>`;

  const search = $('#toolSearch', app);
  const clear = $('#clearSearch', app);
  const filters = [...app.querySelectorAll('[data-category]')];
  const cards = [...app.querySelectorAll('[data-tool]')];
  let category = 'all';
  function filterTools() {
    const query = search.value.trim().toLocaleLowerCase('th');
    let count = 0;
    cards.forEach((card, i) => {
      const tool = allTools[i];
      const matches = (category === 'all' || card.dataset.toolCategory === category) &&
        `${tool.title} ${tool.desc} ${tool.id}`.toLocaleLowerCase('th').includes(query);
      card.hidden = !matches;
      if (matches) count++;
    });
    clear.hidden = !search.value;
    $('#toolCount', app).textContent = `แสดง ${count} จาก ${allTools.length} เครื่องมือ`;
    $('#toolEmpty', app).hidden = count > 0;
    filters.forEach(button => button.setAttribute('aria-pressed', button.dataset.category === category));
  }
  search.addEventListener('input', filterTools);
  filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.category; filterTools(); }));
  clear.addEventListener('click', () => { search.value = ''; filterTools(); search.focus(); });
  $('#resetFilters', app).addEventListener('click', () => { category = 'all'; search.value = ''; filterTools(); search.focus(); });
  document.title = 'TEACHERKIT — สุดยอดเครื่องมือสำหรับครู';
}

function route() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  const tool = ROUTES[id];
  app.dataset.view = tool?.id || 'home';
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === app.dataset.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (!tool) renderHome();
  else {
    // สร้างกล่องใหม่ทุกครั้ง เพื่อไม่ให้ event listener ของหน้าเก่าค้าง
    const view = document.createElement('div');
    app.replaceChildren(view);
    cleanup = tool.render(view) || null;
    const heading = view.querySelector('.page-head h1');
    if (heading) heading.insertAdjacentHTML('afterend', `<p class="page-description">${esc(tool.desc)}</p>`);
    document.title = `${tool.title} · TEACHERKIT`;
  }
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

// ตัวเลือกห้องเรียนบนแถบด้านบน
const sel = $('#classSelect');
function renderClassSelect() {
  sel.innerHTML = state.classes.map(c =>
    `<option value="${c.id}" ${c.id === state.currentId ? 'selected' : ''}>${esc(c.name)} (${c.students.length})</option>`
  ).join('');
}
sel.addEventListener('change', () => { setCurrent(sel.value); route(); });
onChange(renderClassSelect);

// โหมดมืด/สว่าง
const THEME_KEY = 'teacherkit:theme';
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const button = $('#themeToggle');
  const label = t === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';
  button.innerHTML = uiIcon(t === 'dark' ? 'sun' : 'moon');
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(t === 'dark'));
}
let theme;
try { theme = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
applyTheme(theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
});

window.addEventListener('hashchange', route);
renderClassSelect();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

